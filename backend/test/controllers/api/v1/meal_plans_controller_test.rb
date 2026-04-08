require "test_helper"

module Api
  module V1
    class MealPlansControllerTest < ActionDispatch::IntegrationTest
      def setup
        @password = "password123"

        @owner = User.create!(name: "Owner", email: "owner@mp.test",
                              password: @password, password_confirmation: @password)
        @household = Household.create!(name: "Test Household")
        @household.household_memberships.create!(user: @owner, role: "owner",
                                                  grocery_permission: "full", status: "active")

        @member = User.create!(name: "Member", email: "member@mp.test",
                               password: @password, password_confirmation: @password)
        @household.household_memberships.create!(user: @member, role: "member",
                                                  grocery_permission: "contribute", status: "active")

        @outsider = User.create!(name: "Outsider", email: "out@mp.test",
                                 password: @password, password_confirmation: @password)

        @recipe = @household.recipes.create!(
          contributed_by: @owner, recipe_type: "full",
          title: "Pasta", category: "entree", servings: 4,
          ingredient_groups: [ { "ingredients" => [ { "name" => "noodles" } ] } ],
          instructions: [ { "text" => "Boil" } ]
        )

        @monday = Date.parse("2026-04-06")  # Monday
        @wednesday = Date.parse("2026-04-08")  # A Wednesday in that week
      end

      def auth_headers(user)
        token = JwtService.encode_access_token(user)
        { "Authorization" => "Bearer #{token}" }
      end

      # --- show ---

      test "show auto-creates a meal plan for the requested week" do
        assert_difference -> { MealPlan.count }, 1 do
          get "/api/v1/meal_plans/#{@monday}", headers: auth_headers(@owner)
        end
        assert_response :ok
        body = JSON.parse(response.body)
        assert_equal @monday.to_s, body["data"]["week_start"]
        assert_equal [], body["data"]["entries"]
      end

      test "show canonicalises a mid-week date to the Monday" do
        get "/api/v1/meal_plans/#{@wednesday}", headers: auth_headers(@owner)
        assert_response :ok
        body = JSON.parse(response.body)
        assert_equal @monday.to_s, body["data"]["week_start"]
      end

      test "show returns existing plan without creating a new one on second call" do
        get "/api/v1/meal_plans/#{@monday}", headers: auth_headers(@owner)
        assert_no_difference -> { MealPlan.count } do
          get "/api/v1/meal_plans/#{@monday}", headers: auth_headers(@owner)
        end
      end

      test "show requires authentication" do
        get "/api/v1/meal_plans/#{@monday}"
        assert_response :unauthorized
      end

      test "show returns 428 for users without a household" do
        get "/api/v1/meal_plans/#{@monday}", headers: auth_headers(@outsider)
        assert_response :precondition_required
      end

      test "members can view the meal plan" do
        get "/api/v1/meal_plans/#{@monday}", headers: auth_headers(@member)
        assert_response :ok
      end

      # --- create_entry ---

      test "create_entry adds a recipe-backed entry" do
        post "/api/v1/meal_plans/#{@monday}/entries",
             headers: auth_headers(@owner),
             params: {
               entry: {
                 recipe_id: @recipe.apikey,
                 date: @wednesday.to_s,
                 meal_slot: "dinner"
               }
             }, as: :json
        assert_response :created
        body = JSON.parse(response.body)
        assert_equal "full", body["data"]["kind"]
        assert_equal "Pasta", body["data"]["title"]
        assert_equal @recipe.apikey, body["data"]["recipe"]["id"]
      end

      test "create_entry adds a freeform note" do
        post "/api/v1/meal_plans/#{@monday}/entries",
             headers: auth_headers(@owner),
             params: {
               entry: {
                 date: @monday.to_s,
                 meal_slot: "lunch",
                 title: "Takeout from Thai place"
               }
             }, as: :json
        assert_response :created
        body = JSON.parse(response.body)
        assert_equal "note", body["data"]["kind"]
        assert_equal "Takeout from Thai place", body["data"]["title"]
      end

      test "create_entry assigns sequential positions within a slot" do
        3.times do
          post "/api/v1/meal_plans/#{@monday}/entries",
               headers: auth_headers(@owner),
               params: { entry: { recipe_id: @recipe.apikey, date: @monday.to_s, meal_slot: "dinner" } },
               as: :json
        end
        plan = MealPlan.find_by(household: @household, week_start: @monday)
        positions = plan.entries.in_slot(@monday, "dinner").pluck(:position).sort
        assert_equal [ 0, 1, 2 ], positions
      end

      test "members can create entries (collaborative workspace)" do
        post "/api/v1/meal_plans/#{@monday}/entries",
             headers: auth_headers(@member),
             params: { entry: { recipe_id: @recipe.apikey, date: @monday.to_s, meal_slot: "dinner" } },
             as: :json
        assert_response :created
      end

      test "create_entry rejects a note with no title and no recipe" do
        post "/api/v1/meal_plans/#{@monday}/entries",
             headers: auth_headers(@owner),
             params: { entry: { date: @monday.to_s, meal_slot: "dinner" } },
             as: :json
        assert_response :unprocessable_entity
      end

      test "create_entry forces include_in_grocery: false for events" do
        event = @household.recipes.create!(
          contributed_by: @owner, recipe_type: "event", title: "Dinner at Mom's"
        )
        post "/api/v1/meal_plans/#{@monday}/entries",
             headers: auth_headers(@owner),
             params: {
               entry: {
                 recipe_id: event.apikey,
                 date: @monday.to_s,
                 meal_slot: "dinner",
                 include_in_grocery: true  # request ignored — events never hit grocery
               }
             }, as: :json
        assert_response :created
        body = JSON.parse(response.body)
        assert_equal false, body["data"]["include_in_grocery"]
        assert_equal false, body["data"]["grocery_relevant"]
      end

      test "create_entry forces include_in_grocery: false for notes" do
        post "/api/v1/meal_plans/#{@monday}/entries",
             headers: auth_headers(@owner),
             params: {
               entry: {
                 date: @monday.to_s,
                 meal_slot: "lunch",
                 title: "Takeout",
                 include_in_grocery: true
               }
             }, as: :json
        assert_response :created
        body = JSON.parse(response.body)
        assert_equal false, body["data"]["include_in_grocery"]
        assert_equal false, body["data"]["grocery_relevant"]
      end

      test "create_entry keeps include_in_grocery for recipe-backed entries" do
        post "/api/v1/meal_plans/#{@monday}/entries",
             headers: auth_headers(@owner),
             params: {
               entry: {
                 recipe_id: @recipe.apikey,
                 date: @monday.to_s,
                 meal_slot: "dinner"
               }
             }, as: :json
        assert_response :created
        body = JSON.parse(response.body)
        assert_equal true, body["data"]["include_in_grocery"]
        assert_equal true, body["data"]["grocery_relevant"]
      end

      test "create_entry rejects an invalid meal_slot" do
        post "/api/v1/meal_plans/#{@monday}/entries",
             headers: auth_headers(@owner),
             params: { entry: { recipe_id: @recipe.apikey, date: @monday.to_s, meal_slot: "midnight" } },
             as: :json
        assert_response :unprocessable_entity
      end

      test "create_entry rejects a recipe from another household" do
        other_hh = Household.create!(name: "Other")
        other_user = User.create!(name: "O", email: "oo@mp.test",
                                  password: @password, password_confirmation: @password)
        other_hh.household_memberships.create!(user: other_user, role: "owner",
                                                grocery_permission: "full", status: "active")
        foreign_recipe = other_hh.recipes.create!(
          contributed_by: other_user, recipe_type: "full",
          title: "Stolen", category: "entree", servings: 2,
          ingredient_groups: [ { "ingredients" => [ { "name" => "x" } ] } ],
          instructions: [ { "text" => "..." } ]
        )

        post "/api/v1/meal_plans/#{@monday}/entries",
             headers: auth_headers(@owner),
             params: { entry: { recipe_id: foreign_recipe.apikey, date: @monday.to_s, meal_slot: "dinner" } },
             as: :json
        assert_response :unprocessable_entity
      end

      # --- update_entry ---

      test "update_entry applies servings_override and date/slot moves" do
        plan = MealPlan.for_week!(household: @household, week_start: @monday)
        entry = plan.entries.create!(recipe: @recipe, date: @monday, meal_slot: "lunch")

        patch "/api/v1/meal_plans/#{@monday}/entries/#{entry.id}",
              headers: auth_headers(@owner),
              params: { entry: { servings_override: 6, meal_slot: "dinner" } },
              as: :json
        assert_response :ok
        entry.reload
        assert_equal 6, entry.servings_override
        assert_equal "dinner", entry.meal_slot
      end

      test "update_entry returns 404 for unknown entry id" do
        patch "/api/v1/meal_plans/#{@monday}/entries/999999",
              headers: auth_headers(@owner),
              params: { entry: { servings_override: 4 } },
              as: :json
        assert_response :not_found
      end

      # --- destroy_entry ---

      test "destroy_entry removes the entry" do
        plan = MealPlan.for_week!(household: @household, week_start: @monday)
        entry = plan.entries.create!(recipe: @recipe, date: @monday, meal_slot: "dinner")

        assert_difference -> { MealPlanEntry.count }, -1 do
          delete "/api/v1/meal_plans/#{@monday}/entries/#{entry.id}",
                 headers: auth_headers(@owner)
        end
        assert_response :no_content
      end

      # --- reorder_entries ---

      test "reorder_entries assigns new positions by order provided" do
        plan = MealPlan.for_week!(household: @household, week_start: @monday)
        e1 = plan.entries.create!(recipe: @recipe, date: @monday, meal_slot: "dinner", position: 0)
        e2 = plan.entries.create!(recipe: @recipe, date: @monday, meal_slot: "dinner", position: 1)
        e3 = plan.entries.create!(recipe: @recipe, date: @monday, meal_slot: "dinner", position: 2)

        post "/api/v1/meal_plans/#{@monday}/entries/reorder",
             headers: auth_headers(@owner),
             params: { entry_ids: [ e3.id, e1.id, e2.id ] },
             as: :json
        assert_response :ok

        assert_equal 0, e3.reload.position
        assert_equal 1, e1.reload.position
        assert_equal 2, e2.reload.position
      end
    end
  end
end
