class RefactorGroceryListToRolling < ActiveRecord::Migration[8.1]
  def up
    # Merge all existing grocery list items onto a single list per household.
    # For households with multiple week-scoped lists, pick the first and move
    # items from the others.
    Household.find_each do |household|
      lists = GroceryList.where(household: household).order(:id)
      next if lists.empty?
      keeper = lists.first
      lists.where.not(id: keeper.id).each do |other|
        other.items.update_all(grocery_list_id: keeper.id)
        other.destroy!
      end
    end

    remove_index :grocery_lists, [ :household_id, :week_of ]
    remove_column :grocery_lists, :week_of
    # The FK already created a non-unique index on household_id. Remove it
    # and replace with a unique one to enforce one list per household.
    remove_index :grocery_lists, :household_id
    add_index :grocery_lists, :household_id, unique: true

    # Track which date range was last generated from so regeneration can
    # diff against the correct set of meal plan entries.
    add_column :grocery_lists, :generated_from, :date
    add_column :grocery_lists, :generated_to, :date
  end

  def down
    remove_index :grocery_lists, :household_id
    remove_column :grocery_lists, :generated_from
    remove_column :grocery_lists, :generated_to
    add_column :grocery_lists, :week_of, :date
    add_index :grocery_lists, [ :household_id, :week_of ], unique: true
  end
end
