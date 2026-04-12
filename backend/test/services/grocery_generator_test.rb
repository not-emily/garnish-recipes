require "test_helper"

class GroceryGeneratorTest < ActiveSupport::TestCase
  setup do
    @household = Household.create!(name: "HH", default_diners: 2)
    @user = User.create!(email: "g@test", password: "secret12", name: "G")
    @household.household_memberships.create!(user: @user, role: "owner",
                                              grocery_permission: "full", status: "active")
    @monday = Date.parse("2026-04-06")
    @plan = MealPlan.for_week!(household: @household, week_start: @monday)
  end

  def make_recipe(title:, servings:, ingredients:)
    groups = [ { "ingredients" => ingredients } ]
    @household.recipes.create!(
      contributed_by: @user, recipe_type: "full", title: title,
      category: "entree", servings: servings,
      ingredient_groups: groups,
      instructions: [ { "text" => "cook" } ]
    )
  end

  test "collects ingredients from recipe entries" do
    recipe = make_recipe(title: "Stew", servings: 4, ingredients: [
      { "name" => "Beef", "quantity" => 2, "unit" => "lbs" },
      { "name" => "Carrots", "quantity" => 3, "unit" => "medium" }
    ])
    @plan.entries.create!(recipe: recipe, date: @monday, meal_slot: "dinner")

    items = GroceryGenerator.new(household: @household, from_date: @monday, to_date: @monday + 6).generate
    assert_equal 2, items.length
    beef = items.find { |i| i[:name] == "beef" }
    assert_equal 2.0, beef[:quantity]
    assert_equal "lbs", beef[:unit]
    assert_equal "meat", beef[:category]
  end

  test "scales quantities by servings_override" do
    recipe = make_recipe(title: "Pasta", servings: 4, ingredients: [
      { "name" => "Noodles", "quantity" => 1, "unit" => "lb" }
    ])
    @plan.entries.create!(recipe: recipe, date: @monday, meal_slot: "dinner",
                          servings_override: 8)

    items = GroceryGenerator.new(household: @household, from_date: @monday, to_date: @monday + 6).generate
    noodles = items.find { |i| i[:name] == "noodles" }
    assert_equal 2.0, noodles[:quantity]
  end

  test "aggregates same ingredient across recipes" do
    r1 = make_recipe(title: "Tacos", servings: 4, ingredients: [
      { "name" => "Onion", "quantity" => 1, "unit" => "medium" }
    ])
    r2 = make_recipe(title: "Soup", servings: 4, ingredients: [
      { "name" => "Onion", "quantity" => 2, "unit" => "medium" }
    ])
    @plan.entries.create!(recipe: r1, date: @monday, meal_slot: "dinner")
    @plan.entries.create!(recipe: r2, date: @monday + 1, meal_slot: "dinner")

    items = GroceryGenerator.new(household: @household, from_date: @monday, to_date: @monday + 6).generate
    onions = items.select { |i| i[:name] == "onion" }
    assert_equal 1, onions.length
    assert_equal 3.0, onions.first[:quantity]
    assert_equal 2, onions.first[:source_entries].length
  end

  test "keeps items with different units separate" do
    recipe = make_recipe(title: "Mixed", servings: 4, ingredients: [
      { "name" => "Garlic", "quantity" => 3, "unit" => "cloves" },
      { "name" => "Garlic", "quantity" => 1, "unit" => "tbsp" }
    ])
    @plan.entries.create!(recipe: recipe, date: @monday, meal_slot: "dinner")

    items = GroceryGenerator.new(household: @household, from_date: @monday, to_date: @monday + 6).generate
    garlic = items.select { |i| i[:name] == "garlic" }
    assert_equal 2, garlic.length
  end

  test "quick meals go to frozen_premade" do
    qm = @household.recipes.create!(
      contributed_by: @user, recipe_type: "quick_meal", title: "Orange Chicken"
    )
    @plan.entries.create!(recipe: qm, date: @monday, meal_slot: "dinner")

    items = GroceryGenerator.new(household: @household, from_date: @monday, to_date: @monday + 6).generate
    assert_equal 1, items.length
    assert_equal "frozen_premade", items.first[:category]
    assert_equal "quick_meal", items.first[:source_type]
  end

  test "skips leftover entries" do
    recipe = make_recipe(title: "Stew", servings: 4, ingredients: [
      { "name" => "Beef", "quantity" => 2, "unit" => "lbs" }
    ])
    original = @plan.entries.create!(recipe: recipe, date: @monday, meal_slot: "dinner")
    @plan.entries.create!(recipe: recipe, date: @monday + 1, meal_slot: "lunch",
                          is_leftover: true, leftover_of_id: original.id)

    items = GroceryGenerator.new(household: @household, from_date: @monday, to_date: @monday + 6).generate
    assert_equal 1, items.length
  end

  test "skips entries with include_in_grocery false" do
    recipe = make_recipe(title: "Stew", servings: 4, ingredients: [
      { "name" => "Beef", "quantity" => 2, "unit" => "lbs" }
    ])
    @plan.entries.create!(recipe: recipe, date: @monday, meal_slot: "dinner",
                          include_in_grocery: false)

    items = GroceryGenerator.new(household: @household, from_date: @monday, to_date: @monday + 6).generate
    assert_empty items
  end

  test "skips events and notes" do
    event = @household.recipes.create!(
      contributed_by: @user, recipe_type: "event", title: "Dinner Out"
    )
    @plan.entries.create!(recipe: event, date: @monday, meal_slot: "dinner")
    @plan.entries.create!(date: @monday + 1, meal_slot: "lunch", title: "Takeout")

    items = GroceryGenerator.new(household: @household, from_date: @monday, to_date: @monday + 6).generate
    assert_empty items
  end

  test "household mapping overrides keyword heuristic" do
    @household.ingredient_category_mappings.create!(
      ingredient_name: "chicken", category: "deli"
    )
    recipe = make_recipe(title: "Sandwich", servings: 2, ingredients: [
      { "name" => "Chicken", "quantity" => 1, "unit" => "lb" }
    ])
    @plan.entries.create!(recipe: recipe, date: @monday, meal_slot: "lunch")

    items = GroceryGenerator.new(household: @household, from_date: @monday, to_date: @monday + 6).generate
    assert_equal "deli", items.first[:category]
  end

  test "household mapping applies store tag" do
    @household.ingredient_category_mappings.create!(
      ingredient_name: "rice", category: "pasta_grains", store: "Costco"
    )
    recipe = make_recipe(title: "Rice Bowl", servings: 2, ingredients: [
      { "name" => "Rice", "quantity" => 2, "unit" => "cups" }
    ])
    @plan.entries.create!(recipe: recipe, date: @monday, meal_slot: "dinner")

    items = GroceryGenerator.new(household: @household, from_date: @monday, to_date: @monday + 6).generate
    assert_equal "Costco", items.first[:store]
  end

  test "handles ingredients with no quantity" do
    recipe = make_recipe(title: "Salad", servings: 2, ingredients: [
      { "name" => "Salt" }
    ])
    @plan.entries.create!(recipe: recipe, date: @monday, meal_slot: "lunch")

    items = GroceryGenerator.new(household: @household, from_date: @monday, to_date: @monday + 6).generate
    assert_equal 1, items.length
    assert_nil items.first[:quantity]
    assert_equal "spices", items.first[:category]
  end
end
