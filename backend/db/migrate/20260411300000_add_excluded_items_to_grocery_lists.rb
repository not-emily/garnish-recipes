class AddExcludedItemsToGroceryLists < ActiveRecord::Migration[8.1]
  def change
    add_column :grocery_lists, :excluded_items, :jsonb, null: false, default: []
  end
end
