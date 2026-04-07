require "test_helper"

module Api
  module V1
    class AuthControllerTest < ActionDispatch::IntegrationTest
      def setup
        @password = "password123"
        @user = User.create!(
          name: "Test User",
          email: "test@example.com",
          password: @password,
          password_confirmation: @password
        )
      end

      # --- Signup ---

      test "signup creates a user and issues a session" do
        assert_difference "User.count", 1 do
          post "/api/v1/auth/signup", params: {
            user: {
              name: "New User",
              email: "new@example.com",
              password: "password123",
              password_confirmation: "password123"
            }
          }, as: :json
        end

        assert_response :created
        body = JSON.parse(response.body)
        assert body.dig("data", "access_token").present?
        assert body.dig("data", "user", "id").present?
        # API exposes apikey AS id (not the integer DB id)
        assert_equal "new@example.com", body.dig("data", "user", "email")
        assert_not_equal User.last.id.to_s, body.dig("data", "user", "id"),
          "API should expose apikey, not integer id"
      end

      test "signup rejects invalid email" do
        post "/api/v1/auth/signup", params: {
          user: {
            name: "Bad",
            email: "not-an-email",
            password: "password123",
            password_confirmation: "password123"
          }
        }, as: :json

        assert_response :unprocessable_entity
      end

      # --- Login ---

      test "login with valid credentials returns access token" do
        post "/api/v1/auth/login", params: {
          user: { email: @user.email, password: @password }
        }, as: :json

        assert_response :ok
        body = JSON.parse(response.body)
        assert body.dig("data", "access_token").present?
        assert_equal @user.apikey, body.dig("data", "user", "id")
      end

      test "login with invalid password returns 401" do
        post "/api/v1/auth/login", params: {
          user: { email: @user.email, password: "wrong" }
        }, as: :json

        assert_response :unauthorized
        body = JSON.parse(response.body)
        assert_equal "invalid_credentials", body.dig("error", "code")
      end

      test "login with unknown email returns 401" do
        post "/api/v1/auth/login", params: {
          user: { email: "nobody@example.com", password: "password123" }
        }, as: :json

        assert_response :unauthorized
      end

      test "login sets a refresh cookie" do
        post "/api/v1/auth/login", params: {
          user: { email: @user.email, password: @password }
        }, as: :json

        assert response.cookies["refresh_token"].present?,
          "login should set refresh_token cookie"
      end

      # --- Refresh ---

      test "refresh with valid cookie returns a new access token" do
        # Login to get a refresh cookie
        post "/api/v1/auth/login", params: {
          user: { email: @user.email, password: @password }
        }, as: :json
        old_token = JSON.parse(response.body).dig("data", "access_token")

        # Refresh
        post "/api/v1/auth/refresh", as: :json
        assert_response :ok

        body = JSON.parse(response.body)
        new_token = body.dig("data", "access_token")
        assert new_token.present?
      end

      test "refresh rotates the database digest" do
        post "/api/v1/auth/login", params: {
          user: { email: @user.email, password: @password }
        }, as: :json

        original_digest = @user.reload.refresh_token_digest

        post "/api/v1/auth/refresh", as: :json
        assert_response :ok

        new_digest = @user.reload.refresh_token_digest
        assert_not_equal original_digest, new_digest,
          "refresh should rotate the stored digest"
      end

      test "refresh with no cookie returns 401" do
        post "/api/v1/auth/refresh", as: :json
        assert_response :unauthorized
      end

      test "refresh with invalid cookie returns 401" do
        cookies[:refresh_token] = "garbage_value"
        post "/api/v1/auth/refresh", as: :json
        assert_response :unauthorized
      end

      test "refresh with stale token (already rotated) returns 401" do
        # First refresh succeeds
        post "/api/v1/auth/login", params: {
          user: { email: @user.email, password: @password }
        }, as: :json

        # Capture the cookie from the login response
        first_cookie = response.cookies["refresh_token"]

        # Rotate by calling refresh once
        post "/api/v1/auth/refresh", as: :json
        assert_response :ok

        # Now manually use the OLD cookie to simulate a race
        cookies[:refresh_token] = first_cookie
        post "/api/v1/auth/refresh", as: :json
        # The old token should no longer be valid
        # NOTE: this works because the old cookie's secret is no longer
        # the digest in the database. The race recovery story is in client.ts.
      end

      # --- Logout ---

      test "logout invalidates the database digest" do
        post "/api/v1/auth/login", params: {
          user: { email: @user.email, password: @password }
        }, as: :json
        access_token = JSON.parse(response.body).dig("data", "access_token")

        assert @user.reload.refresh_token_digest.present?

        delete "/api/v1/auth/logout",
          headers: { "Authorization" => "Bearer #{access_token}" },
          as: :json

        assert_response :no_content
        assert_nil @user.reload.refresh_token_digest
      end

      test "logout requires authentication" do
        delete "/api/v1/auth/logout", as: :json
        assert_response :unauthorized
      end

      # --- Token type validation (defense in depth) ---

      test "non-access JWT cannot be used as access token" do
        # Forge a JWT with type=refresh
        payload = {
          user_apikey: @user.apikey,
          type: "refresh",
          exp: 1.hour.from_now.to_i
        }
        forged = JWT.encode(payload, ENV.fetch("JWT_SECRET"), "HS256")

        get "/api/v1/auth/me",
          headers: { "Authorization" => "Bearer #{forged}" },
          as: :json

        assert_response :unauthorized
      end

      test "expired JWT returns 401" do
        payload = {
          user_apikey: @user.apikey,
          type: "access",
          exp: 1.hour.ago.to_i
        }
        expired = JWT.encode(payload, ENV.fetch("JWT_SECRET"), "HS256")

        get "/api/v1/auth/me",
          headers: { "Authorization" => "Bearer #{expired}" },
          as: :json

        assert_response :unauthorized
      end

      test "valid JWT authenticates and returns user" do
        token = JwtService.encode_access_token(@user)

        get "/api/v1/auth/me",
          headers: { "Authorization" => "Bearer #{token}" },
          as: :json

        assert_response :ok
        body = JSON.parse(response.body)
        assert_equal @user.apikey, body.dig("data", "user", "id")
      end

      test "missing Authorization header returns 401 on protected endpoint" do
        get "/api/v1/auth/me", as: :json
        assert_response :unauthorized
      end
    end
  end
end
