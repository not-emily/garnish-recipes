module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      self.current_user = find_verified_user
    end

    private

    # Authenticate via JWT passed as a query param (?token=...).
    # ActionCable doesn't support custom headers on the WebSocket
    # handshake, so query params are the standard Rails approach.
    def find_verified_user
      token = request.params[:token]
      reject_unauthorized_connection unless token.present?

      payload = JwtService.decode(token)
      reject_unauthorized_connection unless payload
      reject_unauthorized_connection unless payload[:type] == "access"
      reject_unauthorized_connection unless payload[:user_apikey].present?

      user = User.find_by_apikey(payload[:user_apikey])
      reject_unauthorized_connection unless user

      user
    end
  end
end
