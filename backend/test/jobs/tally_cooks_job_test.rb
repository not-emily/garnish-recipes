require "test_helper"

class TallyCooksJobTest < ActiveSupport::TestCase
  def setup
    @password = "password123"
    @owner = User.create!(name: "Owner", email: "owner@tally.test",
                          password: @password, password_confirmation: @password)
    @household = Household.create!(name: "Tally Household")
    @household.household_memberships.create!(user: @owner, role: "owner",
                                              grocery_permission: "full", status: "active")

    @recipe = @household.recipes.create!(
      contributed_by: @owner, recipe_type: "full",
      title: "Pasta", category: "entree", servings: 4,
      ingredient_groups: [{ "ingredients" => [{ "name" => "noodles" }] }],
      instructions: [{ "text" => "Boil" }]
    )
  end

  # The central case that justifies this job's existence: a meal planned ahead
  # of time whose date rolls over without any create/destroy event firing.
  # The after_commit trigger can't see wall-clock time passing, so stats stay
  # stale until this job sweeps.
  test "counts an entry whose date was future at creation and is now past" do
    plan = @household.meal_plans.create!(week_start: Date.current.beginning_of_week(:monday))

    # Simulate an entry that was created with a future date: insert directly so
    # the after_commit trigger fires under the "date > today" guard and leaves
    # stats alone. Then update the entry's date to a past date WITHOUT going
    # through save callbacks, mimicking "the calendar advanced."
    entry = plan.entries.create!(
      recipe: @recipe, date: Date.current + 3.days, meal_slot: "dinner", position: 0
    )
    assert_equal 0, @recipe.reload.times_cooked, "precondition: trigger should not count future dates"

    entry.update_columns(date: Date.current - 1.day)

    TallyCooksJob.perform_now

    @recipe.reload
    assert_equal 1, @recipe.times_cooked
    assert_equal Date.current - 1.day, @recipe.last_cooked_at
  end

  test "is idempotent — running twice produces the same result" do
    past = Date.current - 2.days
    plan = @household.meal_plans.create!(week_start: past.beginning_of_week(:monday))
    plan.entries.create!(
      recipe: @recipe, date: past, meal_slot: "dinner", position: 0
    )

    expected_count = @recipe.reload.times_cooked
    expected_date = @recipe.last_cooked_at

    TallyCooksJob.perform_now
    TallyCooksJob.perform_now

    @recipe.reload
    assert_equal expected_count, @recipe.times_cooked
    assert_equal expected_date, @recipe.last_cooked_at
  end

  test "excludes leftover entries" do
    past = Date.current - 3.days
    plan = @household.meal_plans.create!(week_start: past.beginning_of_week(:monday))

    original = plan.entries.create!(
      recipe: @recipe, date: past, meal_slot: "dinner", position: 0
    )
    leftover = plan.entries.create!(
      recipe: @recipe, date: past + 1, meal_slot: "lunch", position: 0,
      is_leftover: true, leftover_of: original
    )
    # Force the is_leftover flag in case any callback tried to clear it
    leftover.update_columns(is_leftover: true)

    TallyCooksJob.perform_now

    @recipe.reload
    assert_equal 1, @recipe.times_cooked
    assert_equal past, @recipe.last_cooked_at
  end

  test "excludes future-dated entries" do
    plan = @household.meal_plans.create!(week_start: Date.current.beginning_of_week(:monday))
    plan.entries.create!(
      recipe: @recipe, date: Date.current + 5.days, meal_slot: "dinner", position: 0
    )

    TallyCooksJob.perform_now

    @recipe.reload
    assert_equal 0, @recipe.times_cooked
    assert_nil @recipe.last_cooked_at
  end

  test "corrects drift when stats disagree with entries" do
    # Put the recipe in a fabricated stale state (imagine a missed run after
    # entries were destroyed). The job should recompute back to truth.
    past = Date.current - 1.day
    plan = @household.meal_plans.create!(week_start: past.beginning_of_week(:monday))
    plan.entries.create!(
      recipe: @recipe, date: past, meal_slot: "dinner", position: 0
    )

    @recipe.update_columns(times_cooked: 99, last_cooked_at: Date.current - 10.days)

    TallyCooksJob.perform_now

    @recipe.reload
    assert_equal 1, @recipe.times_cooked
    assert_equal past, @recipe.last_cooked_at
  end

  test "resets stats to zero when all entries removed" do
    past = Date.current - 2.days
    plan = @household.meal_plans.create!(week_start: past.beginning_of_week(:monday))
    entry = plan.entries.create!(
      recipe: @recipe, date: past, meal_slot: "dinner", position: 0
    )
    # Delete without triggering callbacks to simulate a pre-existing stale state
    entry.delete

    @recipe.update_columns(times_cooked: 5, last_cooked_at: past)

    TallyCooksJob.perform_now

    @recipe.reload
    assert_equal 0, @recipe.times_cooked
    assert_nil @recipe.last_cooked_at
  end
end
