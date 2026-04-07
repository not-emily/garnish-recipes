class CreateRecipes < ActiveRecord::Migration[8.1]
  def change
    create_table :recipes do |t|
      t.references :household, null: false, foreign_key: true
      t.references :contributed_by, null: false, foreign_key: { to_table: :users }

      # Public identifier (apikey-as-id pattern)
      t.string :apikey, null: false

      # Type discriminator
      t.string :recipe_type, null: false, default: "full"

      # Core fields
      t.string :title, null: false
      t.text :description

      # Taxonomy
      t.string :category
      t.string :cuisine
      t.string :tags, array: true, default: [], null: false
      t.string :primary_protein

      # Time and difficulty
      t.integer :prep_time_minutes
      t.integer :cook_time_minutes
      t.integer :total_time_minutes
      t.string :difficulty
      t.integer :servings

      # Source attribution
      t.string :source_url

      # Structured content (JSONB)
      t.jsonb :ingredient_groups, default: [], null: false
      t.jsonb :instructions, default: [], null: false

      # Misc
      t.text :notes
      t.string :image_url

      # Cooking history (updated by meal plan entries in Phase 5)
      t.integer :times_cooked, default: 0, null: false
      t.date :last_cooked_at

      t.timestamps
    end

    add_index :recipes, :apikey, unique: true
    add_index :recipes, :recipe_type
    add_index :recipes, :category
    add_index :recipes, :tags, using: :gin
    add_index :recipes, :cuisine
    add_index :recipes, :primary_protein
    add_index :recipes, :last_cooked_at
  end
end
