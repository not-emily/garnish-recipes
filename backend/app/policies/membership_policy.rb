class MembershipPolicy
  include PolicyResult

  attr_reader :current_membership, :target_membership

  def initialize(current_membership, target_membership)
    @current_membership = current_membership
    @target_membership = target_membership
  end

  def update_role?
    return deny(:not_owner) unless current_membership.owner?
    return deny(:cannot_modify_owner) if target_membership.owner?
    allow
  end

  def update_grocery_permission?
    return deny(:not_admin) unless current_membership.can_manage_members?
    return deny(:cannot_modify_owner) if target_membership.owner?
    allow
  end

  def remove?
    return deny(:cannot_remove_owner) if target_membership.owner?
    return allow if current_membership.owner?
    return allow if current_membership.admin? && target_membership.member?
    deny(:not_admin)
  end
end
