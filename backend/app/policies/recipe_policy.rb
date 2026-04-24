class RecipePolicy
  include PolicyResult

  attr_reader :membership, :recipe

  def initialize(membership, recipe = nil)
    @membership = membership
    @recipe = recipe
  end

  def index?
    in_household? ? allow : deny(:not_member)
  end

  def show?
    in_household? && recipe_in_household? ? allow : deny(:not_member)
  end

  def create?
    return deny(:not_member) unless in_household?
    membership.can_manage_members? ? allow : deny(:not_admin)
  end

  def update?
    return deny(:not_member) unless in_household? && recipe_in_household?
    membership.can_manage_members? ? allow : deny(:not_admin)
  end

  def destroy?
    return deny(:not_member) unless in_household? && recipe_in_household?
    membership.can_manage_members? ? allow : deny(:not_admin)
  end

  # Generating/revoking a share link is treated like mutating the recipe —
  # admin+ only. A share link is functionally a grant of read+copy to
  # anyone with the URL, so it should live at the same authority level as
  # editing or deleting the recipe itself.
  def share?
    return deny(:not_member) unless in_household? && recipe_in_household?
    membership.can_manage_members? ? allow : deny(:not_admin)
  end

  def revoke_share?
    share?
  end

  # Scope: which recipes can the current member see?
  # Members can see all recipes in their active household. There is no
  # per-recipe visibility — the household is the boundary.
  class Scope
    attr_reader :membership, :scope

    def initialize(membership, scope)
      @membership = membership
      @scope = scope
    end

    def resolve
      return scope.none unless membership.present?
      scope.where(household_id: membership.household_id)
    end
  end

  private

  def in_household?
    membership.present?
  end

  def recipe_in_household?
    recipe.nil? || recipe.household_id == membership.household_id
  end
end
