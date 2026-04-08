class MealPlanPolicy
  include PolicyResult

  attr_reader :membership, :meal_plan

  def initialize(membership, meal_plan = nil)
    @membership = membership
    @meal_plan = meal_plan
  end

  def show?
    in_household? && meal_plan_in_household? ? allow : deny(:not_member)
  end

  # Anyone in the household can plan meals. Unlike recipes (which are
  # curated collections and restricted to admins), meal plans are a
  # collaborative day-to-day workspace — a roommate who can't add tonight's
  # pizza to the plan is useless.
  def create_entry?
    in_household? && meal_plan_in_household? ? allow : deny(:not_member)
  end
  alias_method :update_entry?, :create_entry?
  alias_method :destroy_entry?, :create_entry?
  alias_method :reorder_entries?, :create_entry?

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

  def meal_plan_in_household?
    meal_plan.nil? || meal_plan.household_id == membership.household_id
  end
end
