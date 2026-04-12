class CollectionPolicy
  include PolicyResult

  attr_reader :membership, :collection

  def initialize(membership, collection = nil)
    @membership = membership
    @collection = collection
  end

  def index?
    in_household? ? allow : deny(:not_member)
  end

  def show?
    return deny(:not_member) unless in_household?
    return allow if collection.owned_by?(membership.user)
    return allow if collection.visibility == "household" && collection.household_id == membership.household_id
    deny(:not_member)
  end

  def create?
    in_household? ? allow : deny(:not_member)
  end

  def update?
    return deny(:not_member) unless in_household?
    collection.owned_by?(membership.user) ? allow : deny(:not_owner)
  end

  def destroy?
    return deny(:not_member) unless in_household?
    collection.owned_by?(membership.user) ? allow : deny(:not_owner)
  end

  def add_recipe?
    return deny(:not_member) unless in_household?
    collection.owned_by?(membership.user) ? allow : deny(:not_owner)
  end

  def remove_recipe?
    add_recipe?
  end

  # Scope: collections the current member can see.
  # - Their own collections in the current household
  # - Household-visible collections from other members in the same household
  class Scope
    attr_reader :membership, :scope

    def initialize(membership, scope)
      @membership = membership
      @scope = scope
    end

    def resolve
      return scope.none unless membership.present?
      scope.visible_to(membership.user, membership.household)
    end
  end

  private

  def in_household?
    membership.present?
  end
end
