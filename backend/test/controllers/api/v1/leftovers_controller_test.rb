require "test_helper"

module Api
  module V1
    class LeftoversControllerTest < ActionDispatch::IntegrationTest
      def setup
        @password = "password123"
        @owner = User.create!(name: "Owner", email: "lo@test",
                              password: @password, password_confirmation: @password)
        @household = Household.create!(name: "HH", default_diners: 2, leftover_expiry_days: 3)
        @household.household_memberships.create!(user: @owner, role: "owner",
                                                  grocery_permission: "full", status: "active")
        @recipe = @household.recipes.create!(
          contributed_by: @owner, recipe_type: "full",
          title: "Stew", category: "soup_stew", servings: 6,
          ingredient_groups: [ { "ingredients" => [ { "name" => "beef" } ] } ],
          instructions: [ { "text" => "cook" } ]
        )
        @monday = Date.parse("2026-04-06")
        @plan = MealPlan.for_week!(household: @household, week_start: @monday)
        @original = @plan.entries.create!(recipe: @recipe, date: @monday, meal_slot: "dinner")
      end

      def auth_headers(user)
        token = JwtService.encode_access_token(user)
        { "Authorization" => "Bearer #{token}" }
      end

      # --- index ---

      test "index returns active tray items for the current household" do
        @household.leftover_tray_items.create!(source_entry: @original, servings: 2)
        @household.leftover_tray_items.create!(source_entry: @original, servings: 1)

        get "/api/v1/leftover_tray", headers: auth_headers(@owner)
        assert_response :ok
        body = JSON.parse(response.body)
        assert_equal 2, body["data"].length
        assert_equal [ 2, 1 ].sort, body["data"].map { |i| i["servings"] }.sort
        assert_equal "Stew", body["data"][0]["source"]["title"]
      end

      test "index hides items older than household.leftover_expiry_days" do
        fresh = @household.leftover_tray_items.create!(source_entry: @original, servings: 2)
        stale = @household.leftover_tray_items.create!(source_entry: @original, servings: 1)
        stale.update_columns(created_at: 5.days.ago)  # beyond 3-day window

        get "/api/v1/leftover_tray", headers: auth_headers(@owner)
        assert_response :ok
        body = JSON.parse(response.body)
        ids = body["data"].map { |i| i["id"] }
        assert_includes ids, fresh.id
        assert_not_includes ids, stale.id
      end

      test "index does not leak tray items from other households" do
        other_user = User.create!(name: "O", email: "o@test",
                                  password: @password, password_confirmation: @password)
        other_hh = Household.create!(name: "Other", default_diners: 2)
        other_hh.household_memberships.create!(user: other_user, role: "owner",
                                                grocery_permission: "full", status: "active")
        other_recipe = other_hh.recipes.create!(
          contributed_by: other_user, recipe_type: "full",
          title: "Other", category: "entree", servings: 4,
          ingredient_groups: [ { "ingredients" => [ { "name" => "x" } ] } ],
          instructions: [ { "text" => "..." } ]
        )
        other_plan = MealPlan.for_week!(household: other_hh, week_start: @monday)
        other_original = other_plan.entries.create!(recipe: other_recipe, date: @monday, meal_slot: "dinner")
        other_hh.leftover_tray_items.create!(source_entry: other_original, servings: 2)

        get "/api/v1/leftover_tray", headers: auth_headers(@owner)
        assert_response :ok
        body = JSON.parse(response.body)
        assert_equal 0, body["data"].length
      end

      # --- destroy ---

      test "destroy removes a tray item" do
        item = @household.leftover_tray_items.create!(source_entry: @original, servings: 2)
        assert_difference -> { LeftoverTrayItem.count }, -1 do
          delete "/api/v1/leftover_tray/#{item.id}", headers: auth_headers(@owner)
        end
        assert_response :no_content
      end

      test "destroy returns 404 for a tray item in another household" do
        other_user = User.create!(name: "O", email: "o2@test",
                                  password: @password, password_confirmation: @password)
        other_hh = Household.create!(name: "Other2", default_diners: 2)
        other_hh.household_memberships.create!(user: other_user, role: "owner",
                                                grocery_permission: "full", status: "active")
        other_recipe = other_hh.recipes.create!(
          contributed_by: other_user, recipe_type: "full",
          title: "Other2", category: "entree", servings: 4,
          ingredient_groups: [ { "ingredients" => [ { "name" => "x" } ] } ],
          instructions: [ { "text" => "..." } ]
        )
        other_plan = MealPlan.for_week!(household: other_hh, week_start: @monday)
        other_original = other_plan.entries.create!(recipe: other_recipe, date: @monday, meal_slot: "dinner")
        item = other_hh.leftover_tray_items.create!(source_entry: other_original, servings: 2)

        delete "/api/v1/leftover_tray/#{item.id}", headers: auth_headers(@owner)
        assert_response :not_found
      end

      # --- schedule ---

      test "schedule converts a tray item into a linked meal plan entry" do
        item = @household.leftover_tray_items.create!(source_entry: @original, servings: 2)

        assert_difference -> { MealPlanEntry.count }, 1 do
          assert_difference -> { LeftoverTrayItem.count }, -1 do
            post "/api/v1/leftover_tray/#{item.id}/schedule",
                 headers: auth_headers(@owner),
                 params: { date: (@monday + 2).to_s, meal_slot: "lunch" },
                 as: :json
          end
        end
        assert_response :created
        body = JSON.parse(response.body)
        assert_equal true, body["data"]["is_leftover"]
        assert_equal @original.id, body["data"]["leftover_of_id"]
        assert_equal 2, body["data"]["leftover_servings"]
        assert_equal "lunch", body["data"]["meal_slot"]
        assert_equal false, body["data"]["grocery_relevant"]
      end

      test "schedule rejects invalid meal_slot" do
        item = @household.leftover_tray_items.create!(source_entry: @original, servings: 2)
        post "/api/v1/leftover_tray/#{item.id}/schedule",
             headers: auth_headers(@owner),
             params: { date: (@monday + 2).to_s, meal_slot: "midnight" },
             as: :json
        assert_response :unprocessable_entity
      end
    end
  end
end
