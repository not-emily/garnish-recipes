class CreateRecipeRatings < ActiveRecord::Migration[8.0]
  def change
    create_table :recipe_ratings do |t|
      t.references :recipe, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.integer :score, null: false
      t.timestamps
    end

    add_index :recipe_ratings, [:recipe_id, :user_id], unique: true

    add_column :recipes, :average_rating, :decimal, precision: 3, scale: 2
    add_column :recipes, :rating_count, :integer, default: 0, null: false
  end
end
