class MealPlanEntry < ApplicationRecord
  MEAL_SLOTS = %w[breakfast lunch dinner].freeze

  belongs_to :meal_plan
  belongs_to :recipe, optional: true
  belongs_to :leftover_of, class_name: "MealPlanEntry", optional: true
  has_many :leftovers, class_name: "MealPlanEntry", foreign_key: :leftover_of_id,
                       dependent: :nullify

  validates :date, presence: true
  validates :meal_slot, inclusion: { in: MEAL_SLOTS }
  validates :position, numericality: { greater_than_or_equal_to: 0 }
  validates :servings_override, numericality: { greater_than: 0 }, allow_nil: true
  validates :diners_override, numericality: { greater_than: 0 }, allow_nil: true

  # Either the entry points at a Recipe (recipe/quick_meal/event) OR it's
  # a freeform note with a title. Never both nil, never both set.
  validate :recipe_or_note_title

  # Events and notes never contribute ingredients to the grocery list, so
  # force include_in_grocery: false at save time. This keeps Phase 7's
  # grocery generation simple — it can just filter by the flag without
  # having to also check entry kind.
  before_validation :coerce_grocery_flag

  scope :for_week, ->(week_start) {
    start_date = week_start.to_date
    where(date: start_date..(start_date + 6))
  }
  scope :in_slot, ->(date, meal_slot) { where(date: date, meal_slot: meal_slot) }

  # Returns the display label for the entry — recipe title for recipe-backed
  # entries, or the freeform title for notes.
  def display_title
    recipe ? recipe.title : title
  end

  # "full" | "quick_meal" | "event" | "note" — derived, not stored.
  # Consumers (frontend, grocery generation) use this instead of a separate
  # entry_type column.
  def kind
    return "note" if recipe.nil?
    recipe.recipe_type
  end

  # True only for kinds that have ingredients worth rolling into the grocery
  # list. Events ("dinner at mom's") and notes ("takeout") are meal-plan
  # annotations with nothing to shop for.
  def grocery_relevant?
    kind == "full" || kind == "quick_meal"
  end

  private

  def recipe_or_note_title
    if recipe_id.nil? && title.blank?
      errors.add(:base, "note entries must have a title")
    elsif recipe_id.present? && title.present?
      errors.add(:base, "recipe-backed entries cannot also have a manual title")
    end
  end

  def coerce_grocery_flag
    self.include_in_grocery = false unless grocery_relevant?
  end
end
