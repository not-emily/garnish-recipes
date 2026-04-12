class GroceryListPolicy
  include PolicyResult

  attr_reader :membership, :grocery_list

  def initialize(membership, grocery_list = nil)
    @membership = membership
    @grocery_list = grocery_list
  end

  # Everyone in the household can view the list.
  def show?
    in_household? ? allow : deny(:not_member)
  end

  # Only owner/admin can generate from the meal plan (destructive — replaces
  # generated items while preserving manual additions and check states).
  def generate?
    full_access? ? allow : deny(:insufficient_permission)
  end

  # Owner/admin/full can add items. Contribute can also add.
  def add_item?
    can_contribute? ? allow : deny(:insufficient_permission)
  end

  # Owner/admin/full can check off, edit, and remove items.
  def check_item?
    full_access? ? allow : deny(:insufficient_permission)
  end
  alias_method :update_item?, :check_item?
  alias_method :remove_item?, :check_item?

  private

  def in_household?
    membership.present?
  end

  def owner_or_admin?
    in_household? && %w[owner admin].include?(membership.role)
  end

  def full_access?
    owner_or_admin? || (in_household? && membership.grocery_permission == "full")
  end

  def can_contribute?
    full_access? || (in_household? && membership.grocery_permission == "contribute")
  end
end
