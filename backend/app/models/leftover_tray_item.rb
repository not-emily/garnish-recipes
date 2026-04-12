class LeftoverTrayItem < ApplicationRecord
  belongs_to :household
  belongs_to :source_entry, class_name: "MealPlanEntry"

  validates :servings, numericality: { greater_than: 0 }

  # Active = created within the household's expiry window. Expired items
  # aren't deleted — hidden from the tray view but preserved so the user
  # doesn't silently lose a linked entry's history.
  scope :active, -> {
    joins(:household)
      .where("leftover_tray_items.created_at >= NOW() - (households.leftover_expiry_days || ' days')::interval")
  }
end
