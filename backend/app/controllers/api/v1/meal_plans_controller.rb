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
      def create_entry
        plan = load_or_create_plan
        return unless authorize!(plan, :create_entry?)

        entry = plan.entries.build(entry_params_for_create)
        entry.position = next_position_for(plan, entry.date, entry.meal_slot)

        if entry.save
          render json: { data: serialize_entry(entry) }, status: :created
        else
          render_validation_errors(entry)
        end
      rescue RecipeNotFound
        render_error("validation_failed", "Recipe not found", :unprocessable_entity)
      end

      # PATCH /api/v1/meal_plans/:week_start/entries/:id
      def update_entry
        plan = load_or_create_plan
        return unless authorize!(plan, :update_entry?)

        entry = plan.entries.find(params[:id])
        if entry.update(entry_params_for_update)
          render json: { data: serialize_entry(entry) }
        else
          render_validation_errors(entry)
        end
      rescue ActiveRecord::RecordNotFound
        render_error("not_found", "Entry not found", :not_found)
      end

      # DELETE /api/v1/meal_plans/:week_start/entries/:id
      def destroy_entry
        plan = load_or_create_plan
        return unless authorize!(plan, :destroy_entry?)

        entry = plan.entries.find(params[:id])
        entry.destroy!
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

        render json: { data: plan.entries.reload.map { |e| serialize_entry(e) } }
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
          grocery_relevant: entry.grocery_relevant?
        }
        if entry.recipe
          base[:recipe] = {
            id: entry.recipe.apikey,
            title: entry.recipe.title,
            recipe_type: entry.recipe.recipe_type,
            image_url: entry.recipe.image_url,
            servings: entry.recipe.servings,
            total_time_minutes: entry.recipe.total_time_minutes
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
    end
  end
end
