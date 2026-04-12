module Api
  module V1
    class MealPlansController < ApplicationController
      class RecipeNotFound < StandardError; end

      before_action :authenticate!
      include HouseholdScoped

      # GET /api/v1/meal_plans/:week_start
      #
      # :week_start must be an ISO-format date (YYYY-MM-DD). The request can
      # supply any date within the week and the controller canonicalises it
      # to the Monday. Meal plans are lazy — the first visit to a week
      # materialises the row so the frontend can immediately hang entries
      # off it.
      def show
        plan = load_or_create_plan
        return unless authorize!(plan, :show?)
        render json: { data: serialize_plan(plan) }
      end

      # POST /api/v1/meal_plans/:week_start/entries
      #
      # Body: {
      #   entry: {...},
      #   leftovers: [{ date, meal_slot }, ...],
      #   track_remaining: true | false
      # }
      #
      # `leftovers` creates linked slot entries for the same recipe.
      # `track_remaining` (defaults to false) tells the server to put any
      # unscheduled full meals and partial serving remainder onto the
      # household tray as LeftoverTrayItem rows. Lets the "cook now, decide
      # later" workflow coexist with explicit scheduling in one request.
      def create_entry
        plan = load_or_create_plan
        return unless authorize!(plan, :create_entry?)

        created_original = nil
        created_leftovers = []
        created_tray_items = []

        MealPlanEntry.transaction do
          created_original = plan.entries.build(entry_params_for_create)
          created_original.position = next_position_for(plan, created_original.date, created_original.meal_slot)
          unless created_original.save
            render_validation_errors(created_original)
            raise ActiveRecord::Rollback
          end

          leftover_specs = Array(params[:leftovers])
          if leftover_specs.any? && created_original.recipe_id.nil?
            render_error("validation_failed", "Leftovers require a recipe-backed entry", :unprocessable_entity)
            raise ActiveRecord::Rollback
          end

          leftover_specs.each do |spec|
            leftover_date = (spec[:date] || spec["date"]).to_s
            leftover_plan = MealPlan.for_week!(household: Current.household, week_start: leftover_date)
            leftover = leftover_plan.entries.build(
              recipe_id: created_original.recipe_id,
              date: leftover_date,
              meal_slot: spec[:meal_slot] || spec["meal_slot"],
              is_leftover: true,
              leftover_of_id: created_original.id
            )
            leftover.position = next_position_for(leftover_plan, leftover.date, leftover.meal_slot)
            unless leftover.save
              render_validation_errors(leftover)
              raise ActiveRecord::Rollback
            end
            created_leftovers << leftover
          end

          if ActiveModel::Type::Boolean.new.cast(params[:track_remaining]) && created_original.recipe_id.present?
            created_tray_items = create_tray_items_for_surplus(created_original, created_leftovers.length)
          end
        end

        return if performed?

        broadcast(plan, action: "entry_created", entry: serialize_entry(created_original))
        created_leftovers.each do |lo|
          broadcast(lo.meal_plan, action: "entry_created", entry: serialize_entry(lo))
        end
        created_tray_items.each do |ti|
          broadcast(plan, action: "tray_item_created", tray_item: serialize_tray_item(ti))
        end

        render json: {
          data: serialize_entry(created_original),
          leftovers: created_leftovers.map { |lo| serialize_entry(lo) },
          tray_items: created_tray_items.map { |ti| serialize_tray_item(ti) }
        }, status: :created
      rescue RecipeNotFound
        render_error("validation_failed", "Recipe not found", :unprocessable_entity)
      end

      # PATCH /api/v1/meal_plans/:week_start/entries/:id
      def update_entry
        plan = load_or_create_plan
        return unless authorize!(plan, :update_entry?)

        entry = plan.entries.find(params[:id])
        if entry.update(entry_params_for_update)
          broadcast(plan, action: "entry_updated", entry: serialize_entry(entry))
          render json: { data: serialize_entry(entry) }
        else
          render_validation_errors(entry)
        end
      rescue ActiveRecord::RecordNotFound
        render_error("not_found", "Entry not found", :not_found)
      end

      # DELETE /api/v1/meal_plans/:week_start/entries/:id[?cascade=true]
      #
      # Originals that have linked leftover entries or tray items can't be
      # silently destroyed — the user might lose planned future meals.
      # Without `cascade=true` we return 409 with the dependent counts so
      # the frontend can show a confirmation dialog, then retry with the
      # flag set. With `cascade=true` we destroy the linked entries and
      # tray items in the same transaction and broadcast each removal.
      def destroy_entry
        plan = load_or_create_plan
        return unless authorize!(plan, :destroy_entry?)

        entry = plan.entries.find(params[:id])
        cascade = ActiveModel::Type::Boolean.new.cast(params[:cascade])

        linked_leftover_ids = entry.leftovers.pluck(:id)
        tray_item_ids = entry.leftover_tray_items.pluck(:id)
        has_dependents = linked_leftover_ids.any? || tray_item_ids.any?

        if has_dependents && !cascade
          render json: {
            error: {
              code: "has_dependents",
              message: "Entry has linked leftovers",
              details: {
                linked_leftover_count: linked_leftover_ids.length,
                tray_item_count: tray_item_ids.length
              }
            }
          }, status: :conflict
          return
        end

        entry_id = entry.id
        MealPlanEntry.transaction do
          if cascade
            plan.entries.where(id: linked_leftover_ids).destroy_all
            LeftoverTrayItem.where(id: tray_item_ids).destroy_all
          end
          entry.destroy!
        end

        linked_leftover_ids.each do |id|
          broadcast(plan, action: "entry_destroyed", entry_id: id)
        end
        tray_item_ids.each do |id|
          broadcast(plan, action: "tray_item_destroyed", tray_item_id: id)
        end
        broadcast(plan, action: "entry_destroyed", entry_id: entry_id)

        head :no_content
      rescue ActiveRecord::RecordNotFound
        render_error("not_found", "Entry not found", :not_found)
      end

      # POST /api/v1/meal_plans/:week_start/entries/reorder
      #
      # Body: { entry_ids: [12, 7, 15] }
      # Assigns sequential position values in the order provided. Used after
      # drag-and-drop reordering within a slot. All entries must belong to
      # the same plan (enforced by policy scoping).
      def reorder_entries
        plan = load_or_create_plan
        return unless authorize!(plan, :reorder_entries?)

        entry_ids = Array(params[:entry_ids]).map(&:to_i)
        entries = plan.entries.where(id: entry_ids).index_by(&:id)
        MealPlanEntry.transaction do
          entry_ids.each_with_index do |id, idx|
            entries[id]&.update!(position: idx)
          end
        end

        reloaded = plan.entries.reload.map { |e| serialize_entry(e) }
        broadcast(plan, action: "entries_reordered", entries: reloaded)
        render json: { data: reloaded }
      end

      private

      def load_or_create_plan
        MealPlan.for_week!(household: Current.household, week_start: params[:week_start])
      rescue Date::Error
        render_error("validation_failed", "Invalid week_start date", :unprocessable_entity) && return
      end

      def entry_params_for_create
        params.require(:entry).permit(
          :recipe_id, :date, :meal_slot, :title,
          :servings_override, :diners_override, :include_in_grocery
        ).tap do |attrs|
          # recipe_id arrives as a public apikey from the frontend; look up
          # the internal numeric id scoped to this household. Raising a
          # controller-local exception lets `create_entry` render a clean
          # error without the double-render risk of inline `render` calls
          # inside a helper method.
          if (rk = attrs.delete(:recipe_id)).present?
            recipe = Current.household.recipes.find_by_apikey(rk)
            raise RecipeNotFound unless recipe
            attrs[:recipe_id] = recipe.id
          end
        end
      end

      def entry_params_for_update
        params.require(:entry).permit(
          :date, :meal_slot, :title,
          :servings_override, :diners_override, :include_in_grocery, :position
        )
      end

      def next_position_for(plan, date, meal_slot)
        (plan.entries.in_slot(date, meal_slot).maximum(:position) || -1) + 1
      end

      # Given an original entry and the number of leftovers the user
      # already scheduled into slots, create tray items for the unscheduled
      # full meals plus any partial-serving remainder. Returns the created
      # tray items in insertion order.
      def create_tray_items_for_surplus(original, scheduled_leftover_count)
        calc = LeftoverCalculator.new(
          recipe: original.recipe,
          household: Current.household,
          servings_override: original.servings_override,
          diners_override: original.diners_override
        )
        return [] unless calc.calculable?

        total_surplus = unscheduled_full_servings(calc, scheduled_leftover_count) + calc.remaining_servings
        return [] unless total_surplus.positive?
        [ Current.household.leftover_tray_items.create!(
          source_entry: original,
          servings: total_surplus
        ) ]
      end

      def unscheduled_full_servings(calc, scheduled_count)
        unscheduled = [ calc.suggested_leftover_count - scheduled_count, 0 ].max
        unscheduled * calc.diners
      end

      def serialize_tray_item(item)
        {
          id: item.id,
          servings: item.servings,
          created_at: item.created_at,
          source_entry_id: item.source_entry_id,
          source: {
            recipe_id: item.source_entry.recipe&.apikey,
            title: item.source_entry.display_title,
            image_url: item.source_entry.recipe&.image_url
          }
        }
      end

      def serialize_plan(plan)
        {
          week_start: plan.week_start,
          week_end: plan.week_end,
          entries: plan.entries.map { |e| serialize_entry(e) }
        }
      end

      def serialize_entry(entry)
        base = {
          id: entry.id,
          date: entry.date,
          meal_slot: entry.meal_slot,
          kind: entry.kind, # "full" | "quick_meal" | "event" | "note"
          title: entry.display_title,
          position: entry.position,
          servings_override: entry.servings_override,
          diners_override: entry.diners_override,
          include_in_grocery: entry.include_in_grocery,
          grocery_relevant: entry.grocery_relevant?,
          is_leftover: entry.is_leftover,
          leftover_of_id: entry.leftover_of_id,
          leftover_servings: entry.leftover_servings
        }
        if entry.recipe
          base[:recipe] = {
            id: entry.recipe.apikey,
            title: entry.recipe.title,
            recipe_type: entry.recipe.recipe_type,
            image_url: entry.recipe.image_url,
            servings: entry.recipe.servings,
            total_time_minutes: entry.recipe.total_time_minutes,
            has_notes: entry.recipe.notes.present?
          }
        end
        base
      end

      def render_validation_errors(record)
        render json: {
          error: {
            code: "validation_failed",
            message: record.errors.full_messages.first,
            details: record.errors.messages
          }
        }, status: :unprocessable_entity
      end

      def render_error(code, message, status)
        render json: { error: { code: code, message: message } }, status: status
      end

      # Broadcast a change to all subscribers of this meal plan's channel.
      # actor_apikey lets the originating client ignore its own broadcasts
      # (it already applied the change via optimistic update). Uses the
      # public apikey to match the frontend's user.id convention.
      def broadcast(plan, payload)
        MealPlanChannel.broadcast_to(plan, payload.merge(actor_apikey: current_user.apikey))
      end
    end
  end
end
