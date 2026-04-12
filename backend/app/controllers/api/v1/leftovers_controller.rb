module Api
  module V1
    class LeftoversController < ApplicationController
      before_action :authenticate!
      include HouseholdScoped

      # GET /api/v1/leftover_tray
      # Returns active (non-expired) tray items for the current household,
      # newest first. Expired items stay in the DB but aren't surfaced here.
      def index
        items = Current.household.leftover_tray_items
                       .active
                       .includes(source_entry: :recipe)
                       .order(created_at: :desc)
        render json: { data: items.map { |i| serialize(i) } }
      end

      # DELETE /api/v1/leftover_tray/:id
      # Manual removal — user ate it as a snack, gave it away, threw it out.
      def destroy
        item = Current.household.leftover_tray_items.find(params[:id])
        plan = item.source_entry.meal_plan
        item_id = item.id
        item.destroy!
        broadcast(plan, action: "tray_item_destroyed", tray_item_id: item_id)
        head :no_content
      rescue ActiveRecord::RecordNotFound
        render_error("not_found", "Tray item not found", :not_found)
      end

      # POST /api/v1/leftover_tray/:id/schedule
      # Body: { date: "YYYY-MM-DD", meal_slot: "breakfast" | "lunch" | "dinner" }
      #
      # Converts a tray item to a linked is_leftover MealPlanEntry in the
      # specified slot. The tray item's row is destroyed; the new entry
      # is broadcast as an entry_created and the tray item as destroyed.
      def schedule
        item = Current.household.leftover_tray_items.find(params[:id])
        date = params[:date]
        meal_slot = params[:meal_slot]

        target_plan = MealPlan.for_week!(household: Current.household, week_start: date)
        entry = nil
        MealPlanEntry.transaction do
          entry = target_plan.entries.build(
            recipe_id: item.source_entry.recipe_id,
            date: date,
            meal_slot: meal_slot,
            is_leftover: true,
            leftover_of_id: item.source_entry_id,
            leftover_servings: item.servings
          )
          entry.position = (target_plan.entries.in_slot(date, meal_slot).maximum(:position) || -1) + 1
          unless entry.save
            render_validation_errors(entry)
            raise ActiveRecord::Rollback
          end
          item.destroy!
        end
        return if performed?

        # entry_created broadcasts on the target week's plan so that week's
        # subscribers render the new entry. The tray item destruction is
        # broadcast via the source entry's plan (where this tray item was
        # originally created) so the tray view updates everywhere.
        broadcast(target_plan, action: "entry_created", entry: serialize_entry(entry))
        broadcast(item.source_entry.meal_plan, action: "tray_item_destroyed", tray_item_id: item.id)
        render json: { data: serialize_entry(entry) }, status: :created
      rescue ActiveRecord::RecordNotFound
        render_error("not_found", "Tray item not found", :not_found)
      rescue Date::Error
        render_error("validation_failed", "Invalid date", :unprocessable_entity)
      end

      private

      def serialize(item)
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

      def serialize_entry(entry)
        {
          id: entry.id,
          date: entry.date,
          meal_slot: entry.meal_slot,
          kind: entry.kind,
          title: entry.display_title,
          position: entry.position,
          servings_override: entry.servings_override,
          diners_override: entry.diners_override,
          include_in_grocery: entry.include_in_grocery,
          grocery_relevant: entry.grocery_relevant?,
          is_leftover: entry.is_leftover,
          leftover_of_id: entry.leftover_of_id,
          leftover_servings: entry.leftover_servings,
          recipe: entry.recipe && {
            id: entry.recipe.apikey,
            title: entry.recipe.title,
            recipe_type: entry.recipe.recipe_type,
            image_url: entry.recipe.image_url,
            servings: entry.recipe.servings,
            total_time_minutes: entry.recipe.total_time_minutes,
            has_notes: entry.recipe.notes.present?
          }
        }
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

      def broadcast(plan, payload)
        MealPlanChannel.broadcast_to(plan, payload.merge(actor_apikey: current_user.apikey))
      end
    end
  end
end
