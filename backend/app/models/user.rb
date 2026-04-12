class User < ApplicationRecord
  LLM_PROVIDERS = %w[anthropic openai ollama].freeze

  has_secure_password

  # User-supplied LLM API key, stored encrypted at rest. Garnish never logs
  # this and never returns it in API responses — only `has_llm_credentials?`
  # is exposed to the frontend.
  encrypts :llm_api_key

  has_many :household_memberships, dependent: :destroy
  has_many :households, through: :household_memberships
  has_many :recipe_collections, dependent: :destroy
  has_many :collection_shares, foreign_key: :shared_with_id, dependent: :destroy
  has_many :shared_collections, through: :collection_shares, source: :recipe_collection

  validates :email, presence: true, uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :name, presence: true
  validates :apikey, presence: true, uniqueness: true
  validates :llm_provider, inclusion: { in: LLM_PROVIDERS }, allow_nil: true

  # All three LLM fields are optional, but if any one is set the others must
  # be set too — a half-configured key is worse than none at all because the
  # ingestion code would otherwise hit a confusing nil dereference.
  validate :llm_settings_complete_or_empty

  normalizes :email, with: ->(email) { email.strip.downcase }

  before_validation :set_apikey, on: :create

  # --- Public identifier ---

  # Find a user by their public apikey. Used for current_user lookup
  # in JWT authentication and for refresh token rotation.
  def self.find_by_apikey(apikey)
    find_by(apikey: apikey)
  end

  # --- Households ---

  def active_household
    # For now, return the first active household. Multi-household switching is v2.
    households.joins(:household_memberships)
              .where(household_memberships: { user_id: id, status: "active" })
              .first
  end

  def membership_for(household)
    household_memberships.find_by(household: household, status: "active")
  end

  # --- Refresh tokens ---
  #
  # Refresh tokens have the format "<apikey>.<random>". Only the random portion
  # is bcrypt-hashed and stored in the database. The apikey portion is a routing
  # hint that lets the server look up the right user without a separate cookie.
  #
  # Knowing the apikey is not sensitive — forging a token still requires the
  # bcrypt-matching random secret.
  #
  # We use "." as the separator because URL-safe base64 (used for apikeys) only
  # contains [A-Za-z0-9_-], so a dot can never appear in the apikey itself.

  REFRESH_TOKEN_SEPARATOR = "."

  def generate_refresh_token!
    secret = SecureRandom.hex(32)
    update!(refresh_token_digest: BCrypt::Password.create(secret))
    "#{apikey}#{REFRESH_TOKEN_SEPARATOR}#{secret}"
  end

  def valid_refresh_token_secret?(secret)
    return false unless refresh_token_digest.present?
    BCrypt::Password.new(refresh_token_digest) == secret
  end

  def invalidate_refresh_token!
    update!(refresh_token_digest: nil)
  end

  # Parse a token from a cookie. Returns [user, secret] or [nil, nil] if invalid.
  def self.parse_refresh_token(token)
    return [nil, nil] if token.blank?
    apikey, secret = token.to_s.split(REFRESH_TOKEN_SEPARATOR, 2)
    return [nil, nil] if apikey.blank? || secret.blank?
    user = find_by_apikey(apikey)
    [user, secret]
  end

  # --- LLM credentials ---

  def has_llm_credentials?
    llm_provider.present? && llm_api_key.present? && llm_model.present?
  end

  private

  def set_apikey
    return if apikey.present?
    loop do
      self.apikey = SecureRandom.urlsafe_base64
      break unless self.class.exists?(apikey: apikey)
    end
  end

  def llm_settings_complete_or_empty
    fields = [ llm_provider, llm_api_key, llm_model ]
    return if fields.all?(&:blank?) || fields.all?(&:present?)
    errors.add(:base, "LLM provider, API key, and model must all be set together")
  end
end
