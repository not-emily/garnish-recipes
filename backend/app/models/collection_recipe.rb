class CollectionRecipe < ApplicationRecord
  belongs_to :recipe_collection
  belongs_to :recipe

  validates :recipe_id, uniqueness: { scope: :recipe_collection_id, message: "is already in this collection" }
end
