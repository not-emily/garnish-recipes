class ApplicationController < ActionController::API
  include ActionController::Cookies

  POLICY_CLASSES = {}.freeze

  private

  def current_user
    @current_user ||= authenticate_from_token
  end

  def authenticate!
    render json: { error: { code: "unauthorized", message: "You must be logged in" } }, status: :unauthorized unless current_user
  end

  def authenticate_from_token
    header = request.headers["Authorization"]
    return nil unless header&.start_with?("Bearer ")

    token = header.split(" ").last
    payload = JwtService.decode(token)
    return nil unless payload
    return nil unless payload[:type] == "access"
    return nil unless payload[:user_apikey].present?

    User.find_by_apikey(payload[:user_apikey])
  end

  # --- Policy authorization ---

  def get_policy(record)
    policy_class = POLICY_CLASSES[record.class.name]
    raise "No policy defined for #{record.class.name}" unless policy_class
    policy_class.new(current_user, record)
  end

  def authorize!(record, action = nil)
    action ||= (action_name + "?").to_sym
    @policy = get_policy(record)
    policy_result = @policy.public_send(action)

    unless policy_result.present? && policy_result[:allowed]
      message = authorization_message(policy_result)
      render json: { error: { code: "forbidden", message: message } }, status: :forbidden
      return false
    end

    true
  end

  def authorization_message(result)
    case result[:reason]
    when :not_member
      "You are not a member of this household"
    when :not_owner
      "Only the household owner can perform this action"
    when :not_admin
      "You must be an admin to perform this action"
    when :insufficient_grocery_permission
      "You don't have permission to modify the grocery list"
    when :cannot_modify_owner
      "The household owner's role cannot be changed"
    when :cannot_remove_owner
      "The household owner cannot be removed"
    else
      "Not authorized"
    end
  end
end
