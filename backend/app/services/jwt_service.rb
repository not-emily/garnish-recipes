class JwtService
  ALGORITHM = "HS256"
  ACCESS_TOKEN_EXPIRY = 15.minutes

  class << self
    def encode_access_token(user)
      payload = {
        user_apikey: user.apikey,
        type: "access",
        exp: ACCESS_TOKEN_EXPIRY.from_now.to_i
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
      key = ENV.fetch("JWT_SECRET")
      raise "JWT_SECRET must be at least 32 characters" if key.length < 32
      key
    end
  end
end
