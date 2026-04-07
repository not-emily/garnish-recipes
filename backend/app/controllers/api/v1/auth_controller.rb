module Api
  module V1
    class AuthController < ApplicationController
      before_action :authenticate!, only: [:me, :logout]

      def signup
        user = User.new(signup_params)

        if user.save
          access_token = JwtService.encode_access_token(user)
          refresh_token = user.generate_refresh_token!
          set_refresh_cookie(refresh_token)

          render json: {
            data: {
              user: serialize_user(user),
              access_token: access_token
            }
          }, status: :created
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
          access_token = JwtService.encode_access_token(user)
          refresh_token = user.generate_refresh_token!
          set_refresh_cookie(refresh_token)

          render json: {
            data: {
              user: serialize_user(user),
              access_token: access_token
            }
          }
        else
          render json: {
            error: { code: "invalid_credentials", message: "Invalid email or password" }
          }, status: :unauthorized
        end
      end

      def refresh
        token = cookies.signed[:refresh_token]
        user_id = cookies.signed[:refresh_user_id]

        user = User.find_by(id: user_id)

        if user&.valid_refresh_token?(token)
          access_token = JwtService.encode_access_token(user)
          new_refresh_token = user.generate_refresh_token!
          set_refresh_cookie(new_refresh_token)

          render json: {
            data: {
              user: serialize_user(user),
              access_token: access_token
            }
          }
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

      def set_refresh_cookie(token)
        cookies.signed[:refresh_token] = {
          value: token,
          httponly: true,
          secure: Rails.env.production?,
          same_site: Rails.env.production? ? :none : :lax,
          expires: 30.days.from_now
        }
        cookies.signed[:refresh_user_id] = {
          value: current_user&.id || User.last.id,
          httponly: true,
          secure: Rails.env.production?,
          same_site: Rails.env.production? ? :none : :lax,
          expires: 30.days.from_now
        }
      end

      def clear_refresh_cookie
        cookies.delete(:refresh_token)
        cookies.delete(:refresh_user_id)
      end

      def serialize_user(user)
        {
          id: user.id,
          email: user.email,
          name: user.name,
          created_at: user.created_at
        }
      end
    end
  end
end
