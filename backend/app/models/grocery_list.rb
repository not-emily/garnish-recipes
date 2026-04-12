class GroceryList < ApplicationRecord
  belongs_to :household
  has_many :items, class_name: "GroceryListItem", dependent: :destroy

  def self.for_household!(household)
    find_or_create_by!(household: household)
  end
end
