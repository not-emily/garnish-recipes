class CreateCollectionsTables < ActiveRecord::Migration[8.0]
  def change
    create_table :recipe_collections do |t|
      t.references :user, null: false, foreign_key: true
      t.references :household, null: false, foreign_key: true
      t.string :apikey, null: false
      t.string :name, null: false
      t.text :description
      t.string :visibility, null: false, default: "private"
      t.timestamps
    end

    add_index :recipe_collections, :apikey, unique: true
    add_index :recipe_collections, [:household_id, :user_id]

    create_table :collection_recipes do |t|
      t.references :recipe_collection, null: false, foreign_key: true
      t.references :recipe, null: false, foreign_key: true
      t.integer :position
      t.timestamps
    end

    add_index :collection_recipes, [:recipe_collection_id, :recipe_id], unique: true, name: "idx_collection_recipes_unique"
  end
end
