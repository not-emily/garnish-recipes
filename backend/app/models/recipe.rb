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

  # User-uploaded display image for the recipe. Coexists with the existing
  # `image_url` string field: that field stays for URL-ingestion captures
  # (og:image, JSON-LD) and is hotlinked at render time. This attachment is
  # for explicit user uploads and pasted-URL fetches. Display preference is
  # attachment > url string > letter fallback.
  IMAGE_ALLOWED_TYPES = %w[image/jpeg image/png image/webp image/heic image/heif].freeze
  IMAGE_MAX_SIZE = 10.megabytes

  has_one_attached :image do |attachable|
    attachable.variant :thumb,  resize_to_fit: [ 600, 450 ],  strip: true, quality: 85
    attachable.variant :detail, resize_to_fit: [ 1200, 900 ], strip: true, quality: 88
  end

  validate :image_size_within_limit
  validate :image_content_type_allowed

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
      where("title ILIKE :t OR cuisine ILIKE :t OR description ILIKE :t OR primary_protein ILIKE :t", t: term)
    end
  }
  scope :max_total_time, ->(minutes) {
    where("total_time_minutes <= ?", minutes) if minutes.present?
  }

  # --- Sharing ---
  # share_token is nullable. When present, anyone holding the token can view
  # the recipe via the public /api/v1/shared_recipes/:token route and (if
  # authenticated) copy it into their active household. Revoking nulls the
  # token; the next share generates a fresh one, so old URLs 404.

  def generate_share_token!
    return share_token if share_token.present?
    loop do
      candidate = SecureRandom.urlsafe_base64(24)
      unless self.class.exists?(share_token: candidate)
        update!(share_token: candidate)
        return share_token
      end
    end
  end

  def revoke_share_token!
    update!(share_token: nil)
  end

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

  # Purge a too-big or wrong-typed attachment immediately so we don't leave an
  # orphan blob in R2 / local storage when the save fails.
  def image_size_within_limit
    return unless image.attached?
    if image.byte_size > IMAGE_MAX_SIZE
      image.purge
      errors.add(:image, "must be under #{IMAGE_MAX_SIZE / 1.megabyte} MB")
    end
  end

  def image_content_type_allowed
    return unless image.attached?
    unless IMAGE_ALLOWED_TYPES.include?(image.content_type)
      image.purge
      errors.add(:image, "must be JPEG, PNG, WebP, or HEIC")
    end
  end
end
