require "test_helper"

class LeftoverCalculatorTest < ActiveSupport::TestCase
  setup do
    @household = Household.create!(name: "HH", default_diners: 2)
    @user = User.create!(email: "c@example.com", password: "secret12", name: "C")
    @recipe = Recipe.create!(
      household: @household, contributed_by: @user,
      title: "Stew", recipe_type: "full", category: "soup_stew", servings: 6
    )
  end

  test "even division: 6 servings / 2 diners = 3 meals, no remainder" do
    calc = LeftoverCalculator.new(recipe: @recipe, household: @household)
    assert_equal 3, calc.meals_count
    assert_equal 0, calc.remaining_servings
    assert calc.has_full_leftover_meals?
    assert_not calc.has_partial_leftovers?
    assert_equal 2, calc.suggested_leftover_count
  end

  test "uneven division: 5 servings / 2 diners = 2 meals + 1 remainder" do
    @recipe.update!(servings: 5)
    calc = LeftoverCalculator.new(recipe: @recipe, household: @household)
    assert_equal 2, calc.meals_count
    assert_equal 1, calc.remaining_servings
    assert calc.has_full_leftover_meals?
    assert calc.has_partial_leftovers?
    assert_equal 1, calc.suggested_leftover_count
  end

  test "single meal: 2 servings / 2 diners = 1 meal, no leftovers" do
    @recipe.update!(servings: 2)
    calc = LeftoverCalculator.new(recipe: @recipe, household: @household)
    assert_equal 1, calc.meals_count
    assert_equal 0, calc.remaining_servings
    assert_not calc.has_full_leftover_meals?
    assert_not calc.has_partial_leftovers?
    assert_equal 0, calc.suggested_leftover_count
  end

  test "partial only: 1 serving / 2 diners = 0 meals + 1 remainder" do
    @recipe.update!(servings: 1)
    calc = LeftoverCalculator.new(recipe: @recipe, household: @household)
    assert_equal 0, calc.meals_count
    assert_equal 1, calc.remaining_servings
    assert_not calc.has_full_leftover_meals?
    assert calc.has_partial_leftovers?
    assert_equal 0, calc.suggested_leftover_count
  end

  test "diners_override takes precedence over household default" do
    calc = LeftoverCalculator.new(recipe: @recipe, household: @household, diners_override: 3)
    assert_equal 2, calc.meals_count
    assert_equal 0, calc.remaining_servings
  end

  test "servings_override takes precedence over recipe.servings" do
    calc = LeftoverCalculator.new(recipe: @recipe, household: @household, servings_override: 4)
    assert_equal 2, calc.meals_count
  end

  test "not calculable when recipe has no servings" do
    @recipe.update_column(:servings, nil)
    calc = LeftoverCalculator.new(recipe: @recipe, household: @household)
    assert_not calc.calculable?
    assert_equal 0, calc.meals_count
    assert_equal 0, calc.remaining_servings
    assert_not calc.has_full_leftover_meals?
    assert_not calc.has_partial_leftovers?
  end
end
