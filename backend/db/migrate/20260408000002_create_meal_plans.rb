class CreateMealPlans < ActiveRecord::Migration[8.1]
  def change
    create_table :meal_plans do |t|
      t.references :household, null: false, foreign_key: true
      t.date :week_start, null: false  # always a Monday

      t.timestamps
    end

    add_index :meal_plans, [ :household_id, :week_start ], unique: true

    create_table :meal_plan_entries do |t|
      t.references :meal_plan, null: false, foreign_key: true
      # Null when this entry is a freeform note. Otherwise points to a
      # Recipe row (which carries recipe_type: full | quick_meal | event).
      t.references :recipe, foreign_key: true

      t.date :date, null: false
      t.string :meal_slot, null: false  # breakfast | lunch | dinner

      # Only populated for notes (when recipe_id is nil). For recipe-backed
      # entries we display recipe.title.
      t.string :title

      # Per-entry overrides applied to the recipe defaults. Null = use the
      # recipe's own values (or household default_diners).
      t.integer :servings_override
      t.integer :diners_override

      # Phase 6 (leftovers) — columns reserved now so we don't have to
      # re-migrate later. Unused in Phase 5 UI.
      t.boolean :is_leftover, default: false, null: false
      t.references :leftover_of, foreign_key: { to_table: :meal_plan_entries }
      t.integer :leftover_servings

      # Phase 7 (grocery lists) — whether this entry contributes ingredients.
      t.boolean :include_in_grocery, default: true, null: false

      # Ordering within (meal_plan_id, date, meal_slot).
      t.integer :position, null: false, default: 0

      t.timestamps
    end

    add_index :meal_plan_entries, [ :meal_plan_id, :date, :meal_slot ],
              name: "idx_meal_plan_entries_on_slot"
  end
end
