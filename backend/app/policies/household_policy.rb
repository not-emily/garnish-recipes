class HouseholdPolicy
  include PolicyResult

  attr_reader :membership

  def initialize(membership)
    @membership = membership
  end

  def update?
    membership.owner? ? allow : deny(:not_owner)
  end

  def destroy?
    membership.owner? ? allow : deny(:not_owner)
  end

  def invite?
    membership.can_manage_members? ? allow : deny(:not_admin)
  end

  def regenerate_invite_code?
    membership.can_manage_members? ? allow : deny(:not_admin)
  end
end
