class IngredientCategoryMapping < ApplicationRecord
  belongs_to :household

  validates :ingredient_name, presence: true,
            uniqueness: { scope: :household_id, case_sensitive: false }
  validates :category, inclusion: { in: GroceryListItem::CATEGORIES }

  before_validation :normalize_name

  private

  def normalize_name
    self.ingredient_name = ingredient_name&.strip&.downcase
  end
end
