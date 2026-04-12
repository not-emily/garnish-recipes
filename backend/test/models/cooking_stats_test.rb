require "test_helper"

class CookingStatsTest < ActiveSupport::TestCase
  def setup
    @password = "password123"
    @owner = User.create!(name: "Owner", email: "owner@stats.test",
                          password: @password, password_confirmation: @password)
    @household = Household.create!(name: "Stats Household")
    @household.household_memberships.create!(user: @owner, role: "owner",
                                              grocery_permission: "full", status: "active")

    @recipe = @household.recipes.create!(
      contributed_by: @owner, recipe_type: "full",
      title: "Pasta", category: "entree", servings: 4,
      ingredient_groups: [{ "ingredients" => [{ "name" => "noodles" }] }],
      instructions: [{ "text" => "Boil" }]
    )

    @plan = @household.meal_plans.create!(week_start: Date.parse("2026-04-06"))
  end

  test "creating an entry for a past date increments times_cooked" do
    past_date = Date.current - 3.days
    @plan.update!(week_start: past_date.beginning_of_week(:monday))

    @plan.entries.create!(
      recipe: @recipe, date: past_date, meal_slot: "dinner", position: 0
    )

    @recipe.reload
    assert_equal 1, @recipe.times_cooked
    assert_equal past_date, @recipe.last_cooked_at
  end

  test "creating an entry for today updates stats" do
    today = Date.current
    @plan.update!(week_start: today.beginning_of_week(:monday))

    @plan.entries.create!(
      recipe: @recipe, date: today, meal_slot: "lunch", position: 0
    )

    @recipe.reload
    assert_equal 1, @recipe.times_cooked
    assert_equal today, @recipe.last_cooked_at
  end

  test "creating an entry for a future date does not update stats" do
    future_date = Date.current + 5.days
    @plan.update!(week_start: future_date.beginning_of_week(:monday))

    @plan.entries.create!(
      recipe: @recipe, date: future_date, meal_slot: "dinner", position: 0
    )

    @recipe.reload
    assert_equal 0, @recipe.times_cooked
    assert_nil @recipe.last_cooked_at
  end

  test "creating a leftover entry does not update stats" do
    past_date = Date.current - 2.days
    @plan.update!(week_start: past_date.beginning_of_week(:monday))

    original = @plan.entries.create!(
      recipe: @recipe, date: past_date, meal_slot: "dinner", position: 0
    )

    @plan.entries.create!(
      recipe: @recipe, date: past_date + 1, meal_slot: "lunch", position: 0,
      is_leftover: true, leftover_of: original
    )

    @recipe.reload
    assert_equal 1, @recipe.times_cooked  # Only the original counts
  end

  test "creating a note entry does not update stats" do
    past_date = Date.current - 1.day
    @plan.update!(week_start: past_date.beginning_of_week(:monday))

    @plan.entries.create!(
      title: "Takeout", date: past_date, meal_slot: "dinner", position: 0
    )

    @recipe.reload
    assert_equal 0, @recipe.times_cooked
  end

  test "destroying an entry recalculates stats" do
    past_date = Date.current - 3.days
    earlier_date = Date.current - 5.days
    @plan.update!(week_start: earlier_date.beginning_of_week(:monday))

    @plan.entries.create!(
      recipe: @recipe, date: earlier_date, meal_slot: "dinner", position: 0
    )
    entry2 = @plan.entries.create!(
      recipe: @recipe, date: past_date, meal_slot: "lunch", position: 0
    )

    @recipe.reload
    assert_equal 2, @recipe.times_cooked
    assert_equal past_date, @recipe.last_cooked_at

    entry2.destroy!
    @recipe.reload
    assert_equal 1, @recipe.times_cooked
    assert_equal earlier_date, @recipe.last_cooked_at
  end

  test "destroying the only entry sets stats to zero" do
    past_date = Date.current - 1.day
    @plan.update!(week_start: past_date.beginning_of_week(:monday))

    entry = @plan.entries.create!(
      recipe: @recipe, date: past_date, meal_slot: "dinner", position: 0
    )

    entry.destroy!
    @recipe.reload
    assert_equal 0, @recipe.times_cooked
    assert_nil @recipe.last_cooked_at
  end

  test "last_cooked_at tracks the most recent date" do
    older = Date.current - 10.days
    newer = Date.current - 2.days
    @plan.update!(week_start: older.beginning_of_week(:monday))

    @plan.entries.create!(
      recipe: @recipe, date: older, meal_slot: "dinner", position: 0
    )
    @plan.entries.create!(
      recipe: @recipe, date: newer, meal_slot: "dinner", position: 0
    )

    @recipe.reload
    assert_equal newer, @recipe.last_cooked_at
  end
end
