class RecipeRating < ApplicationRecord
  belongs_to :recipe
  belongs_to :user

  validates :score, inclusion: { in: 1..5 }
  validates :user_id, uniqueness: { scope: :recipe_id, message: "has already rated this recipe" }

  after_commit :update_recipe_cache

  private

  def update_recipe_cache
    stats = RecipeRating.where(recipe_id: recipe_id)
    recipe.update_columns(
      average_rating: stats.average(:score)&.round(2),
      rating_count: stats.count
    )
  end
end
