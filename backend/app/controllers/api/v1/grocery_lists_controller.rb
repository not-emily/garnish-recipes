module Api
  module V1
    class GroceryListsController < ApplicationController
      before_action :authenticate!
      include HouseholdScoped

      # GET /api/v1/grocery_list
      def show
        list = load_list
        return unless authorize!(list, :show?)
        render json: { data: serialize_list(list) }
      end

      # POST /api/v1/grocery_list/generate
      # Body: { from: "YYYY-MM-DD", to: "YYYY-MM-DD" }
      def generate
        list = load_list
        return unless authorize!(list, :generate?)

        from_date = Date.parse(params[:from])
        to_date = Date.parse(params[:to])
        generated = GroceryGenerator.new(
          household: Current.household,
          from_date: from_date,
          to_date: to_date
        ).generate

        GroceryListItem.transaction do
          existing_generated = list.items.where(source_type: %w[recipe quick_meal]).index_by { |i| [ i.name, i.unit ] }
          excluded = list.excluded_items.to_set

          generated.each do |attrs|
            key = [ attrs[:name], attrs[:unit] ]
            exclusion_key = [ attrs[:name], attrs[:unit] ].compact.join("|")
            next if excluded.include?(exclusion_key)
            if (existing = existing_generated.delete(key))
              existing.update!(
                quantity: attrs[:quantity],
                category: attrs[:category],
                store: attrs[:store],
                source_entries: attrs[:source_entries]
              )
            else
              list.items.create!(
                name: attrs[:name],
                quantity: attrs[:quantity],
                unit: attrs[:unit],
                category: attrs[:category],
                store: attrs[:store],
                source_type: attrs[:source_type],
                source_entries: attrs[:source_entries],
                added_by: current_user,
                position: next_position(list)
              )
            end
          end

          existing_generated.each_value do |stale|
            if stale.checked
              stale.update!(source_entries: [])
            else
              stale.destroy!
            end
          end

          list.update!(generated_from: from_date, generated_to: to_date)
        end

        list.reload
        broadcast(list, action: "list_refreshed", list: serialize_list(list))
        render json: { data: serialize_list(list) }
      rescue Date::Error
        render_error("validation_failed", "Invalid date range", :unprocessable_entity)
      end

      # POST /api/v1/grocery_list/items
      def add_item
        list = load_list
        return unless authorize!(list, :add_item?)

        item = list.items.build(item_params.merge(
          added_by: current_user,
          source_type: "manual",
          position: next_position(list)
        ))

        if item.save
          broadcast(list, action: "item_added", item: serialize_item(item))
          render json: { data: serialize_item(item) }, status: :created
        else
          render_validation_errors(item)
        end
      end

      # PATCH /api/v1/grocery_list/items/:id
      def update_item
        list = load_list
        return unless authorize!(list, :update_item?)

        item = list.items.find(params[:id])
        old_category = item.category
        old_store = item.store

        if item.update(update_item_params)
          learn_mapping(item, old_category, old_store)
          broadcast(list, action: "item_updated", item: serialize_item(item))
          render json: { data: serialize_item(item) }
        else
          render_validation_errors(item)
        end
      rescue ActiveRecord::RecordNotFound
        render_error("not_found", "Item not found", :not_found)
      end

      # PATCH /api/v1/grocery_list/items/:id/check
      def check_item
        toggle_checked(true)
      end

      # PATCH /api/v1/grocery_list/items/:id/uncheck
      def uncheck_item
        toggle_checked(false)
      end

      # DELETE /api/v1/grocery_list/items/:id
      # When removing a generated item, its name+unit is added to the
      # excluded_items list so regeneration doesn't bring it back. Manual
      # items are just deleted without tracking.
      def remove_item
        list = load_list
        return unless authorize!(list, :remove_item?)

        item = list.items.find(params[:id])
        item_id = item.id

        if item.source_type != "manual"
          key = [ item.name, item.unit ].compact.join("|")
          unless list.excluded_items.include?(key)
            list.update!(excluded_items: list.excluded_items + [ key ])
          end
        end

        item.destroy!
        broadcast(list, action: "item_removed", item_id: item_id)
        head :no_content
      rescue ActiveRecord::RecordNotFound
        render_error("not_found", "Item not found", :not_found)
      end

      # POST /api/v1/grocery_list/stores
      # Body: { name: "Costco" }
      # Adds a store to the household's store list. Available to anyone who
      # can add grocery items (contribute+), since store tags are part of
      # the grocery workflow, not general household settings.
      def add_store
        list = load_list
        return unless authorize!(list, :add_item?)

        store_name = params[:name]&.strip
        if store_name.blank?
          return render_error("validation_failed", "Store name is required", :unprocessable_entity)
        end

        stores = Current.household.stores
        unless stores.include?(store_name)
          Current.household.update!(stores: stores + [ store_name ])
        end

        render json: { data: { stores: Current.household.stores } }
      end

      # PATCH /api/v1/grocery_list/stores
      # Body: { old_name: "Costco", new_name: "Costco Wholesale" }
      def rename_store
        list = load_list
        return unless authorize!(list, :add_item?)

        old_name = params[:old_name]&.strip
        new_name = params[:new_name]&.strip
        if old_name.blank? || new_name.blank?
          return render_error("validation_failed", "Both old and new name are required", :unprocessable_entity)
        end

        stores = Current.household.stores.map { |s| s == old_name ? new_name : s }
        Current.household.update!(stores: stores)

        list.items.where(store: old_name).update_all(store: new_name)
        Current.household.ingredient_category_mappings.where(store: old_name).update_all(store: new_name)

        render json: { data: { stores: Current.household.stores } }
      end

      # DELETE /api/v1/grocery_list/stores
      # Body: { name: "Costco" }
      def remove_store
        list = load_list
        return unless authorize!(list, :add_item?)

        store_name = params[:name]&.strip
        if store_name.blank?
          return render_error("validation_failed", "Store name is required", :unprocessable_entity)
        end

        Current.household.update!(stores: Current.household.stores - [ store_name ])
        list.items.where(store: store_name).update_all(store: nil)
        Current.household.ingredient_category_mappings.where(store: store_name).update_all(store: nil)

        render json: { data: { stores: Current.household.stores } }
      end

      # DELETE /api/v1/grocery_list/checked
      def clear_checked
        list = load_list
        return unless authorize!(list, :remove_item?)

        list.items.checked.destroy_all
        broadcast(list, action: "list_refreshed", list: serialize_list(list.reload))
        head :no_content
      end

      private

      def load_list
        GroceryList.for_household!(Current.household)
      end

      def item_params
        params.require(:item).permit(:name, :quantity, :unit, :category, :store)
      end

      def update_item_params
        params.require(:item).permit(:name, :quantity, :unit, :category, :store)
      end

      def toggle_checked(state)
        list = load_list
        return unless authorize!(list, :check_item?)

        item = list.items.find(params[:id])
        item.update!(checked: state)
        action = state ? "item_checked" : "item_unchecked"
        broadcast(list, action: action, item: serialize_item(item))
        render json: { data: serialize_item(item) }
      rescue ActiveRecord::RecordNotFound
        render_error("not_found", "Item not found", :not_found)
      end

      def learn_mapping(item, old_category, old_store)
        return unless item.category != old_category || item.store != old_store
        mapping = Current.household.ingredient_category_mappings
                         .find_or_initialize_by(ingredient_name: item.name.strip.downcase)
        mapping.category = item.category
        mapping.store = item.store
        mapping.save
      end

      def next_position(list)
        (list.items.maximum(:position) || -1) + 1
      end

      def serialize_list(list)
        {
          generated_from: list.generated_from,
          generated_to: list.generated_to,
          excluded_count: list.excluded_items.length,
          items: list.items.order(:checked, :position).map { |i| serialize_item(i) },
          mappings: Current.household.ingredient_category_mappings
                          .pluck(:ingredient_name, :category, :store)
                          .map { |name, cat, store| { name: name, category: cat, store: store } }
        }
      end

      def serialize_item(item)
        {
          id: item.id,
          name: item.name,
          quantity: item.quantity&.to_f,
          unit: item.unit,
          category: item.category,
          store: item.store,
          source_type: item.source_type,
          source_entries: item.source_entries,
          checked: item.checked,
          position: item.position,
          added_by: {
            id: item.added_by.apikey,
            name: item.added_by.name
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

      def broadcast(list, payload)
        GroceryListChannel.broadcast_to(list, payload.merge(actor_apikey: current_user.apikey))
      end
    end
  end
end
