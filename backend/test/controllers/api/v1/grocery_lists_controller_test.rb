require "test_helper"

module Api
  module V1
    class GroceryListsControllerTest < ActionDispatch::IntegrationTest
      def setup
        @password = "password123"
        @owner = User.create!(name: "Owner", email: "go@test",
                              password: @password, password_confirmation: @password)
        @household = Household.create!(name: "HH", default_diners: 2)
        @household.household_memberships.create!(user: @owner, role: "owner",
                                                  grocery_permission: "full", status: "active")

        @member_full = User.create!(name: "FullMember", email: "gf@test",
                                     password: @password, password_confirmation: @password)
        @household.household_memberships.create!(user: @member_full, role: "member",
                                                  grocery_permission: "full", status: "active")

        @member_contribute = User.create!(name: "ContribMember", email: "gc@test",
                                           password: @password, password_confirmation: @password)
        @household.household_memberships.create!(user: @member_contribute, role: "member",
                                                  grocery_permission: "contribute", status: "active")

        @member_read = User.create!(name: "ReadMember", email: "gr@test",
                                     password: @password, password_confirmation: @password)
        @household.household_memberships.create!(user: @member_read, role: "member",
                                                  grocery_permission: "read", status: "active")

        @monday = Date.parse("2026-04-06")
        @plan = MealPlan.for_week!(household: @household, week_start: @monday)
        @recipe = @household.recipes.create!(
          contributed_by: @owner, recipe_type: "full", title: "Stew",
          category: "soup_stew", servings: 4,
          ingredient_groups: [ { "ingredients" => [
            { "name" => "Beef", "quantity" => 2, "unit" => "lbs" },
            { "name" => "Onion", "quantity" => 1, "unit" => "medium" }
          ] } ],
          instructions: [ { "text" => "cook" } ]
        )
        @plan.entries.create!(recipe: @recipe, date: @monday, meal_slot: "dinner")
      end

      def auth_headers(user)
        token = JwtService.encode_access_token(user)
        { "Authorization" => "Bearer #{token}" }
      end

      # --- show ---

      test "show returns the grocery list" do
        get "/api/v1/grocery_list", headers: auth_headers(@owner)
        assert_response :ok
        body = JSON.parse(response.body)
        assert_equal [], body["data"]["items"]
      end

      test "show is accessible to read-only members" do
        get "/api/v1/grocery_list", headers: auth_headers(@member_read)
        assert_response :ok
      end

      # --- generate ---

      test "generate creates items from the meal plan" do
        post "/api/v1/grocery_list/generate",
             headers: auth_headers(@owner),
             params: { from: @monday.to_s, to: (@monday + 6).to_s }, as: :json
        assert_response :ok
        body = JSON.parse(response.body)
        items = body["data"]["items"]
        assert_equal 2, items.length

        beef = items.find { |i| i["name"] == "beef" }
        assert_equal 2.0, beef["quantity"]
        assert_equal "lbs", beef["unit"]
        assert_equal "meat", beef["category"]
        assert_equal "recipe", beef["source_type"]
        assert_equal 1, beef["source_entries"].length
        assert_equal "Stew", beef["source_entries"][0]["title"]
      end

      test "generate preserves manual additions on regeneration" do
        list = GroceryList.for_household!(@household)
        list.items.create!(
          name: "Paper towels", category: "household", source_type: "manual",
          added_by: @owner, position: 0
        )

        post "/api/v1/grocery_list/generate",
             headers: auth_headers(@owner),
             params: { from: @monday.to_s, to: (@monday + 6).to_s }, as: :json
        assert_response :ok
        body = JSON.parse(response.body)
        items = body["data"]["items"]
        names = items.map { |i| i["name"] }
        assert_includes names, "Paper towels"
        assert_includes names, "beef"
      end

      test "generate preserves check state on existing items" do
        post "/api/v1/grocery_list/generate",
             headers: auth_headers(@owner),
             params: { from: @monday.to_s, to: (@monday + 6).to_s }, as: :json
        list = GroceryList.for_household!(@household)
        beef_item = list.items.find_by(name: "beef")
        beef_item.update!(checked: true)

        post "/api/v1/grocery_list/generate",
             headers: auth_headers(@owner),
             params: { from: @monday.to_s, to: (@monday + 6).to_s }, as: :json
        assert_response :ok
        beef_item.reload
        assert beef_item.checked
      end

      test "generate is allowed for full-access members" do
        post "/api/v1/grocery_list/generate",
             headers: auth_headers(@member_full),
             params: { from: @monday.to_s, to: (@monday + 6).to_s }, as: :json
        assert_response :ok
      end

      test "generate is forbidden for contribute-only members" do
        post "/api/v1/grocery_list/generate",
             headers: auth_headers(@member_contribute),
             params: { from: @monday.to_s, to: (@monday + 6).to_s }, as: :json
        assert_response :forbidden
      end

      # --- add_item ---

      test "add_item creates a manual item" do
        post "/api/v1/grocery_list/items",
             headers: auth_headers(@owner),
             params: { item: { name: "Batteries", category: "household" } },
             as: :json
        assert_response :created
        body = JSON.parse(response.body)
        assert_equal "manual", body["data"]["source_type"]
        assert_equal "Batteries", body["data"]["name"]
      end

      test "contribute member can add items" do
        post "/api/v1/grocery_list/items",
             headers: auth_headers(@member_contribute),
             params: { item: { name: "Snacks", category: "snacks" } },
             as: :json
        assert_response :created
      end

      test "read-only member cannot add items" do
        post "/api/v1/grocery_list/items",
             headers: auth_headers(@member_read),
             params: { item: { name: "Snacks", category: "snacks" } },
             as: :json
        assert_response :forbidden
      end

      test "add_item learns mapping for category and store" do
        post "/api/v1/grocery_list/items",
             headers: auth_headers(@owner),
             params: { item: { name: "Almond Milk", category: "dairy", store: "Sam's Club" } },
             as: :json
        assert_response :created

        mapping = @household.ingredient_category_mappings.find_by(ingredient_name: "almond milk")
        assert_not_nil mapping
        assert_equal "dairy", mapping.category
        assert_equal "Sam's Club", mapping.store
      end

      # --- check / uncheck ---

      test "check_item marks item as checked" do
        list = GroceryList.for_household!(@household)
        item = list.items.create!(name: "Milk", category: "dairy", source_type: "manual",
                                  added_by: @owner, position: 0)

        patch "/api/v1/grocery_list/items/#{item.id}/check",
              headers: auth_headers(@owner), as: :json
        assert_response :ok
        assert item.reload.checked
      end

      test "uncheck_item clears checked state" do
        list = GroceryList.for_household!(@household)
        item = list.items.create!(name: "Milk", category: "dairy", source_type: "manual",
                                  added_by: @owner, position: 0, checked: true)

        patch "/api/v1/grocery_list/items/#{item.id}/uncheck",
              headers: auth_headers(@owner), as: :json
        assert_response :ok
        assert_not item.reload.checked
      end

      test "contribute member cannot check items" do
        list = GroceryList.for_household!(@household)
        item = list.items.create!(name: "Milk", category: "dairy", source_type: "manual",
                                  added_by: @owner, position: 0)

        patch "/api/v1/grocery_list/items/#{item.id}/check",
              headers: auth_headers(@member_contribute), as: :json
        assert_response :forbidden
      end

      # --- update_item ---

      test "update_item changes category and learns the mapping" do
        list = GroceryList.for_household!(@household)
        item = list.items.create!(name: "turkey", category: "meat", source_type: "recipe",
                                  added_by: @owner, position: 0)

        patch "/api/v1/grocery_list/items/#{item.id}",
              headers: auth_headers(@owner),
              params: { item: { category: "deli" } },
              as: :json
        assert_response :ok
        assert_equal "deli", item.reload.category

        mapping = @household.ingredient_category_mappings.find_by(ingredient_name: "turkey")
        assert_not_nil mapping
        assert_equal "deli", mapping.category
      end

      test "update_item learns store tag" do
        list = GroceryList.for_household!(@household)
        item = list.items.create!(name: "rice", category: "pasta_grains", source_type: "recipe",
                                  added_by: @owner, position: 0)

        patch "/api/v1/grocery_list/items/#{item.id}",
              headers: auth_headers(@owner),
              params: { item: { store: "Costco" } },
              as: :json
        assert_response :ok
        assert_equal "Costco", item.reload.store

        mapping = @household.ingredient_category_mappings.find_by(ingredient_name: "rice")
        assert_equal "Costco", mapping.store
      end

      # --- remove_item ---

      test "remove_item deletes the item" do
        list = GroceryList.for_household!(@household)
        item = list.items.create!(name: "Milk", category: "dairy", source_type: "manual",
                                  added_by: @owner, position: 0)

        assert_difference -> { GroceryListItem.count }, -1 do
          delete "/api/v1/grocery_list/items/#{item.id}",
                 headers: auth_headers(@owner)
        end
        assert_response :no_content
      end

      test "read-only member cannot remove items" do
        list = GroceryList.for_household!(@household)
        item = list.items.create!(name: "Milk", category: "dairy", source_type: "manual",
                                  added_by: @owner, position: 0)

        delete "/api/v1/grocery_list/items/#{item.id}",
               headers: auth_headers(@member_read)
        assert_response :forbidden
      end
    end
  end
end
