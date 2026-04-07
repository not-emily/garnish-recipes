class ApplicationController < ActionController::API
  include ActionController::Cookies

  # --- Policy registry ---
  # Explicit allowlist of policy classes. Only classes listed here can be used
  # for authorization (avoids unsafe reflection via .constantize).
  POLICY_CLASSES = {
    "Recipe" => "RecipePolicy"
  }.freeze

  POLICY_SCOPE_CLASSES = {
    "Recipe" => "RecipePolicy::Scope"
  }.freeze

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
  #
  # Policies are membership-aware: they take the current household membership
  # rather than the user, because every household-scoped permission depends on
  # the user's role within the active household. Controllers that need
  # `authorize!` and `policy_scope` must include `HouseholdScoped` so that
  # `Current.membership` is set before these helpers are called.

  def get_policy(record)
    policy_class_name = POLICY_CLASSES[record.class.name]
    raise "No policy defined for #{record.class.name}" unless policy_class_name
    policy_class_name.constantize.new(Current.membership, record)
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

  # Returns a policy-filtered query for index actions.
  # Usage: `policy_scope(Recipe)` → returns recipes the current member can see.
  def policy_scope(scope)
    scope_class_name = POLICY_SCOPE_CLASSES[scope.name]
    raise "No policy scope defined for #{scope.name}" unless scope_class_name
    scope_class_name.constantize.new(Current.membership, scope).resolve
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
