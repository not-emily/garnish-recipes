require "test_helper"

class MealPlanChannelTest < ActionCable::Channel::TestCase
  def setup
    @password = "password123"

    @owner = User.create!(name: "Owner", email: "owner@cable.test",
                          password: @password, password_confirmation: @password)
    @household = Household.create!(name: "Cable Household")
    @household.household_memberships.create!(user: @owner, role: "owner",
                                              grocery_permission: "full", status: "active")

    @member = User.create!(name: "Member", email: "member@cable.test",
                           password: @password, password_confirmation: @password)
    @household.household_memberships.create!(user: @member, role: "member",
                                              grocery_permission: "contribute", status: "active")

    @outsider = User.create!(name: "Outsider", email: "outsider@cable.test",
                             password: @password, password_confirmation: @password)

    @monday = "2026-04-06"
  end

  # --- subscription ---

  test "household member can subscribe to their meal plan" do
    stub_connection current_user: @owner
    subscribe(week_start: @monday)
    assert subscription.confirmed?
    assert_has_stream_for MealPlan.for_week!(household: @household, week_start: @monday)
  end

  test "member role can also subscribe" do
    stub_connection current_user: @member
    subscribe(week_start: @monday)
    assert subscription.confirmed?
  end

  test "user without a household is rejected" do
    stub_connection current_user: @outsider
    subscribe(week_start: @monday)
    assert subscription.rejected?
  end

  test "invalid week_start is rejected" do
    stub_connection current_user: @owner
    subscribe(week_start: "not-a-date")
    assert subscription.rejected?
  end

  test "subscribing auto-creates the meal plan if needed" do
    stub_connection current_user: @owner
    assert_difference -> { MealPlan.count }, 1 do
      subscribe(week_start: @monday)
    end
    assert subscription.confirmed?
  end
end

class MealPlanBroadcastTest < ActionDispatch::IntegrationTest
  include ActionCable::TestHelper

  def setup
    @password = "password123"

    @owner = User.create!(name: "Owner", email: "owner@broadcast.test",
                          password: @password, password_confirmation: @password)
    @household = Household.create!(name: "Broadcast Household")
    @household.household_memberships.create!(user: @owner, role: "owner",
                                              grocery_permission: "full", status: "active")

    @recipe = @household.recipes.create!(
      contributed_by: @owner, recipe_type: "full",
      title: "Broadcast Pasta", category: "entree", servings: 4,
      ingredient_groups: [{ "ingredients" => [{ "name" => "noodles" }] }],
      instructions: [{ "text" => "Boil" }]
    )

    @monday = Date.parse("2026-04-06")
    @plan = MealPlan.for_week!(household: @household, week_start: @monday)
  end

  def auth_headers(user)
    token = JwtService.encode_access_token(user)
    { "Authorization" => "Bearer #{token}" }
  end

  test "create_entry broadcasts entry_created with actor_id" do
    stream = MealPlanChannel.broadcasting_for(@plan)
    assert_broadcasts(stream, 1) do
      post "/api/v1/meal_plans/#{@monday}/entries",
           params: { entry: { recipe_id: @recipe.apikey, date: @monday.to_s,
                               meal_slot: "dinner" } },
           headers: auth_headers(@owner)
    end
    assert_response :created
    broadcast = decode_broadcast(stream)
    assert_equal "entry_created", broadcast["action"]
    assert_equal @owner.apikey, broadcast["actor_apikey"]
    assert_equal "Broadcast Pasta", broadcast["entry"]["title"]
  end

  test "update_entry broadcasts entry_updated with actor_id" do
    entry = @plan.entries.create!(recipe: @recipe, date: @monday,
                                  meal_slot: "lunch", position: 0)
    stream = MealPlanChannel.broadcasting_for(@plan)
    assert_broadcasts(stream, 1) do
      patch "/api/v1/meal_plans/#{@monday}/entries/#{entry.id}",
            params: { entry: { meal_slot: "dinner" } },
            headers: auth_headers(@owner)
    end
    broadcast = decode_broadcast(stream)
    assert_equal "entry_updated", broadcast["action"]
    assert_equal "dinner", broadcast["entry"]["meal_slot"]
  end

  test "destroy_entry broadcasts entry_destroyed with entry_id" do
    entry = @plan.entries.create!(recipe: @recipe, date: @monday,
                                  meal_slot: "dinner", position: 0)
    entry_id = entry.id
    stream = MealPlanChannel.broadcasting_for(@plan)
    assert_broadcasts(stream, 1) do
      delete "/api/v1/meal_plans/#{@monday}/entries/#{entry_id}",
             headers: auth_headers(@owner)
    end
    broadcast = decode_broadcast(stream)
    assert_equal "entry_destroyed", broadcast["action"]
    assert_equal entry_id, broadcast["entry_id"]
  end

  test "reorder_entries broadcasts entries_reordered" do
    e1 = @plan.entries.create!(recipe: @recipe, date: @monday, meal_slot: "dinner", position: 0)
    e2 = @plan.entries.create!(title: "Side dish", date: @monday, meal_slot: "dinner", position: 1)
    stream = MealPlanChannel.broadcasting_for(@plan)
    assert_broadcasts(stream, 1) do
      post "/api/v1/meal_plans/#{@monday}/entries/reorder",
           params: { entry_ids: [e2.id, e1.id] },
           headers: auth_headers(@owner)
    end
    broadcast = decode_broadcast(stream)
    assert_equal "entries_reordered", broadcast["action"]
    assert_equal 2, broadcast["entries"].length
    assert_equal @owner.apikey, broadcast["actor_apikey"]
  end

  private

  def decode_broadcast(stream)
    messages = broadcasts(stream)
    assert messages.any?, "Expected at least one broadcast"
    ActiveSupport::JSON.decode(messages.last)
  end
end
