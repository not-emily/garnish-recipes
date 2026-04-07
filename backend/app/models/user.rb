class User < ApplicationRecord
  has_secure_password

  validates :email, presence: true, uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :name, presence: true

  normalizes :email, with: ->(email) { email.strip.downcase }

  def generate_refresh_token!
    token = SecureRandom.hex(32)
    update!(refresh_token_digest: BCrypt::Password.create(token))
    token
  end

  def valid_refresh_token?(token)
    return false unless refresh_token_digest.present?
    BCrypt::Password.new(refresh_token_digest) == token
  end

  def invalidate_refresh_token!
    update!(refresh_token_digest: nil)
  end
end
