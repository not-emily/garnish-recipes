class CreateGroceryTables < ActiveRecord::Migration[8.1]
  def change
    create_table :grocery_lists do |t|
      t.references :household, null: false, foreign_key: true
      t.date :week_of, null: false
      t.timestamps
    end

    add_index :grocery_lists, [ :household_id, :week_of ], unique: true

    create_table :grocery_list_items do |t|
      t.references :grocery_list, null: false, foreign_key: true
      t.references :added_by, null: false, foreign_key: { to_table: :users }

      t.string :name, null: false
      t.decimal :quantity, precision: 10, scale: 2
      t.string :unit
      t.string :category, null: false, default: "other"
      t.string :store

      # "recipe" | "quick_meal" | "manual"
      t.string :source_type, null: false, default: "manual"
      # [{ entry_id: 42, title: "Beef Stew" }, ...] — tracks which meal(s)
      # contributed this item so the UI can show provenance.
      t.jsonb :source_entries, null: false, default: []

      t.boolean :checked, null: false, default: false
      t.integer :position, null: false, default: 0

      t.timestamps
    end

    add_index :grocery_list_items, [ :grocery_list_id, :checked ]

    # Learned per-household category + store mappings. The generator checks
    # this before the keyword heuristic so user corrections persist across
    # regenerations.
    create_table :ingredient_category_mappings do |t|
      t.references :household, null: false, foreign_key: true
      t.string :ingredient_name, null: false
      t.string :category, null: false
      t.string :store

      t.timestamps
    end

    add_index :ingredient_category_mappings, [ :household_id, :ingredient_name ],
              unique: true, name: "idx_ingredient_mappings_on_hh_name"

    # Household's store list — the set of store names that appear in the
    # pill filter and store-tag dropdown.
    add_column :households, :stores, :string, array: true, null: false, default: []
  end
end
