class AddShareTokenToRecipes < ActiveRecord::Migration[8.1]
  def change
    add_column :recipes, :share_token, :string
    # Partial unique index — null is the common case (recipe not currently
    # shared) and shouldn't consume the uniqueness constraint.
    add_index :recipes, :share_token, unique: true, where: "share_token IS NOT NULL"
  end
end
