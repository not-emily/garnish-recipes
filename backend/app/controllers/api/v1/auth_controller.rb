module Api
  module V1
    class AuthController < ApplicationController
      REFRESH_COOKIE = :refresh_token
      REFRESH_TOKEN_EXPIRY = 30.days

      before_action :authenticate!, only: [:me, :logout]

      def signup
        user = User.new(signup_params)

        if user.save
          issue_session(user, status: :created)
        else
          render json: {
            error: {
              code: "validation_failed",
              message: user.errors.full_messages.first,
              details: user.errors.messages
            }
          }, status: :unprocessable_entity
        end
      end

      def login
        user = User.find_by(email: login_params[:email])

        if user&.authenticate(login_params[:password])
          issue_session(user)
        else
          render json: {
            error: { code: "invalid_credentials", message: "Invalid email or password" }
          }, status: :unauthorized
        end
      end

      def refresh
        token = cookies.signed[REFRESH_COOKIE]
        user, secret = User.parse_refresh_token(token)

        if user&.valid_refresh_token_secret?(secret)
          issue_session(user)
        else
          clear_refresh_cookie
          render json: {
            error: { code: "invalid_refresh_token", message: "Session expired, please log in again" }
          }, status: :unauthorized
        end
      end

      def logout
        current_user.invalidate_refresh_token!
        clear_refresh_cookie
        head :no_content
      end

      def me
        render json: { data: { user: serialize_user(current_user) } }
      end

      private

      def signup_params
        params.require(:user).permit(:email, :password, :password_confirmation, :name)
      end

      def login_params
        params.require(:user).permit(:email, :password)
      end

      # Issues a fresh access token + rotated refresh cookie for a user.
      def issue_session(user, status: :ok)
        access_token = JwtService.encode_access_token(user)
        refresh_token = user.generate_refresh_token!
        set_refresh_cookie(refresh_token)

        render json: {
          data: {
            user: serialize_user(user),
            access_token: access_token
          }
        }, status: status
      end

      def set_refresh_cookie(token)
        cookies.signed[REFRESH_COOKIE] = cookie_options.merge(value: token)
      end

      def clear_refresh_cookie
        # Mirror the same attributes used when setting the cookie. Some browsers
        # (Safari in particular) refuse to clear a SameSite=None; Secure cookie
        # if the deletion directive lacks those attributes.
        cookies.delete(REFRESH_COOKIE, cookie_options.except(:expires))
      end

      def cookie_options
        opts = {
          httponly: true,
          secure: Rails.env.production?,
          same_site: Rails.env.production? ? :none : :lax,
          path: "/",
          expires: REFRESH_TOKEN_EXPIRY.from_now
        }
        domain = ENV["COOKIE_DOMAIN"].presence
        opts[:domain] = domain if domain
        opts
      end

      def serialize_user(user)
        {
          id: user.apikey,
          email: user.email,
          name: user.name,
          has_household: user.active_household.present?,
          created_at: user.created_at
        }
      end
    end
  end
end
