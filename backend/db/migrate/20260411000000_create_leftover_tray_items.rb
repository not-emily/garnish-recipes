class CreateLeftoverTrayItems < ActiveRecord::Migration[8.1]
  def change
    create_table :leftover_tray_items do |t|
      # Household owns the tray; scoping reads and broadcasts through it
      # instead of walking through source_entry.meal_plan.household.
      t.references :household, null: false, foreign_key: true

      # The original cooked meal this leftover came from. When the source
      # is destroyed via cascade we destroy the tray items too. Nullable
      # fk would let a tray item outlive its source, which we don't want.
      t.references :source_entry, null: false,
                                  foreign_key: { to_table: :meal_plan_entries }

      # How many servings this particular tray item represents. A "full
      # meal" tray item has servings = household.default_diners at create
      # time; a "partial" tray item carries whatever remainder the
      # calculator produced (< diners).
      t.integer :servings, null: false

      t.timestamps
    end

    add_index :leftover_tray_items, [ :household_id, :created_at ]

    add_column :households, :leftover_expiry_days, :integer, null: false, default: 3
  end
end
