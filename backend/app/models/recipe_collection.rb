class RecipeCollection < ApplicationRecord
  VISIBILITIES = %w[private household].freeze

  belongs_to :user
  belongs_to :household
  has_many :collection_recipes, dependent: :destroy
  has_many :recipes, through: :collection_recipes
  has_many :collection_shares, dependent: :destroy
  has_many :shared_users, through: :collection_shares, source: :shared_with

  validates :apikey, presence: true, uniqueness: true
  validates :name, presence: true
  validates :visibility, inclusion: { in: VISIBILITIES }

  before_validation :set_apikey, on: :create

  scope :owned_by, ->(user) { where(user: user) }
  scope :visible_to, ->(user, household) {
    where(user: user, household: household)
      .or(where(visibility: "household", household: household))
  }
  scope :search, ->(query) {
    where("name ILIKE :t OR description ILIKE :t", t: "%#{sanitize_sql_like(query)}%") if query.present?
  }

  def self.find_by_apikey!(apikey)
    find_by!(apikey: apikey)
  end

  def owned_by?(user)
    user_id == user.id
  end

  private

  def set_apikey
    return if apikey.present?
    loop do
      self.apikey = SecureRandom.urlsafe_base64
      break unless self.class.exists?(apikey: apikey)
    end
  end
end
