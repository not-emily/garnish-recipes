class Recipe < ApplicationRecord
  RECIPE_TYPES = %w[full quick_meal event].freeze
  CATEGORIES = %w[
    entree side appetizer soup_stew salad
    breakfast dessert snack beverage sauce_dressing
  ].freeze
  DIFFICULTIES = %w[easy medium hard].freeze
  MEAL_SLOTS = %w[breakfast lunch dinner].freeze

  # Import lifecycle: nil = not an import, importing = job in flight,
  # complete = parsed cleanly, needs_review = parsed but missing fields,
  # failed = ingestion error
  enum :import_status, { importing: 0, complete: 1, needs_review: 2, failed: 3 }, prefix: :import

  IMPORT_SOURCE_TYPES = %w[url pdf image].freeze

  belongs_to :household
  belongs_to :contributed_by, class_name: "User"
  has_many :meal_plan_entries, dependent: :destroy
  has_many :collection_recipes, dependent: :destroy
  has_many :recipe_collections, through: :collection_recipes
  has_many :recipe_ratings, dependent: :destroy

  # Original source material for an imported recipe — the PDF or image the
  # user uploaded, attached so they can re-reference or re-process it later.
  # URL imports don't have an attachment (the source_url string is enough).
  has_one_attached :source_file

  validates :apikey, presence: true, uniqueness: true
  validates :title, presence: true, unless: :import_in_progress?
  validates :recipe_type, inclusion: { in: RECIPE_TYPES }
  validates :import_source_type, inclusion: { in: IMPORT_SOURCE_TYPES }, allow_nil: true
  validates :category, inclusion: { in: CATEGORIES }, allow_nil: true
  validates :difficulty, inclusion: { in: DIFFICULTIES }, allow_nil: true
  validates :servings, numericality: { greater_than: 0 }, allow_nil: true
  validates :prep_time_minutes, :cook_time_minutes, :total_time_minutes,
            numericality: { greater_than_or_equal_to: 0 }, allow_nil: true

  validate :validate_ingredient_groups_structure
  validate :validate_instructions_structure
  validate :full_recipe_required_fields

  before_validation :set_apikey, on: :create
  before_validation :compute_total_time
  before_validation :normalize_tags

  scope :full_recipes, -> { where(recipe_type: "full") }
  scope :quick_meals, -> { where(recipe_type: "quick_meal") }
  scope :events, -> { where(recipe_type: "event") }
  scope :by_category, ->(category) { where(category: category) if category.present? }
  scope :by_cuisine, ->(cuisine) { where(cuisine: cuisine) if cuisine.present? }
  scope :by_protein, ->(protein) { where(primary_protein: protein) if protein.present? }
  scope :by_difficulty, ->(difficulty) { where(difficulty: difficulty) if difficulty.present? }
  scope :by_type, ->(type) { where(recipe_type: type) if type.present? }
  scope :with_tags, ->(tags) {
    tags = Array(tags).compact_blank
    where("tags @> ARRAY[?]::varchar[]", tags) if tags.any?
  }
  scope :search, ->(query) {
    if query.present?
      term = "%#{sanitize_sql_like(query)}%"
      where("title ILIKE :t OR cuisine ILIKE :t OR description ILIKE :t", t: term)
    end
  }
  scope :max_total_time, ->(minutes) {
    where("total_time_minutes <= ?", minutes) if minutes.present?
  }

  def self.find_by_apikey!(apikey)
    find_by!(apikey: apikey)
  end

  # --- Cooking stats ---
  # Updated by MealPlanEntry after_commit when non-leftover entries are
  # created or destroyed for dates in the past or today.

  def update_cooking_stats!(date)
    new_values = { times_cooked: times_cooked + 1 }
    if last_cooked_at.nil? || date > last_cooked_at
      new_values[:last_cooked_at] = date
    end
    update_columns(new_values)
  end

  def recalculate_cooking_stats!
    entries = meal_plan_entries
                .where(is_leftover: false)
                .where("date <= ?", Date.current)

    update_columns(
      times_cooked: entries.count,
      last_cooked_at: entries.maximum(:date)
    )
  end

  # Returns a flat list of all ingredients across all groups, used for grocery
  # generation in Phase 7. Doesn't preserve grouping.
  def all_ingredients
    Array(ingredient_groups).flat_map { |group| Array(group["ingredients"]) }
  end

  private

  def set_apikey
    return if apikey.present?
    loop do
      self.apikey = SecureRandom.urlsafe_base64
      break unless self.class.exists?(apikey: apikey)
    end
  end

  def compute_total_time
    return unless prep_time_minutes || cook_time_minutes
    self.total_time_minutes = (prep_time_minutes || 0) + (cook_time_minutes || 0)
  end

  def normalize_tags
    self.tags = Array(tags).map { |t| t.to_s.strip.downcase }.reject(&:blank?).uniq
  end

  def full_recipe_required_fields
    return unless recipe_type == "full"
    # Imported recipes may parse with missing fields; the user fills them in
    # later via the edit screen. Only enforce strict requirements for recipes
    # that were created manually (import_status is nil).
    return if import_status.present?
    errors.add(:category, "is required for full recipes") if category.blank?
    errors.add(:servings, "is required for full recipes") if servings.blank?
  end

  def import_in_progress?
    import_status == "importing" || import_status == "failed"
  end

  def validate_ingredient_groups_structure
    return if ingredient_groups.blank?
    unless ingredient_groups.is_a?(Array)
      errors.add(:ingredient_groups, "must be an array")
      return
    end

    ingredient_groups.each_with_index do |group, gi|
      unless group.is_a?(Hash) && group["ingredients"].is_a?(Array)
        errors.add(:ingredient_groups, "group #{gi} must have an ingredients array")
        next
      end

      group["ingredients"].each_with_index do |ing, ii|
        unless ing.is_a?(Hash) && ing["name"].is_a?(String) && ing["name"].present?
          errors.add(:ingredient_groups, "group #{gi} ingredient #{ii} must have a name")
        end
      end
    end
  end

  def validate_instructions_structure
    return if instructions.blank?
    unless instructions.is_a?(Array)
      errors.add(:instructions, "must be an array")
      return
    end

    instructions.each_with_index do |step, i|
      unless step.is_a?(Hash) && step["text"].is_a?(String) && step["text"].present?
        errors.add(:instructions, "step #{i} must have text")
      end
    end
  end
end
