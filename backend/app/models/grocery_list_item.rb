class GroceryListItem < ApplicationRecord
  CATEGORIES = %w[
    produce dairy meat seafood deli bakery
    frozen_premade canned_jarred pasta_grains
    condiments_sauces oils_vinegars spices
    baking snacks cereal_breakfast beverages
    pantry household health_beauty other
  ].freeze

  SOURCE_TYPES = %w[recipe quick_meal manual].freeze

  belongs_to :grocery_list
  belongs_to :added_by, class_name: "User"

  validates :name, presence: true
  validates :category, inclusion: { in: CATEGORIES }
  validates :source_type, inclusion: { in: SOURCE_TYPES }
  validates :quantity, numericality: { greater_than: 0 }, allow_nil: true
  validates :position, numericality: { greater_than_or_equal_to: 0 }

  scope :unchecked, -> { where(checked: false).order(:position) }
  scope :checked, -> { where(checked: true).order(:position) }
end
