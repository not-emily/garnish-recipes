class JwtService
  ALGORITHM = "HS256"
  ACCESS_TOKEN_EXPIRY = 15.minutes
  REFRESH_TOKEN_EXPIRY = 30.days

  class << self
    def encode_access_token(user)
      payload = {
        user_id: user.id,
        exp: ACCESS_TOKEN_EXPIRY.from_now.to_i,
        type: "access"
      }
      JWT.encode(payload, secret, ALGORITHM)
    end

    def decode(token)
      decoded = JWT.decode(token, secret, true, algorithm: ALGORITHM)
      decoded.first.with_indifferent_access
    rescue JWT::ExpiredSignature
      nil
    rescue JWT::DecodeError
      nil
    end

    private

    def secret
      ENV.fetch("JWT_SECRET")
    end
  end
end
