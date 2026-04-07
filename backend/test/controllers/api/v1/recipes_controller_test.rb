require "test_helper"

module Api
  module V1
    class RecipesControllerTest < ActionDispatch::IntegrationTest
      def setup
        @password = "password123"

        @owner = User.create!(name: "Owner", email: "owner@test.com",
                              password: @password, password_confirmation: @password)
        @household = Household.create!(name: "Test Household")
        @household.household_memberships.create!(user: @owner, role: "owner",
                                                  grocery_permission: "full", status: "active")

        @member = User.create!(name: "Member", email: "member@test.com",
                               password: @password, password_confirmation: @password)
        @household.household_memberships.create!(user: @member, role: "member",
                                                  grocery_permission: "contribute", status: "active")

        # User with no household
        @outsider = User.create!(name: "Outsider", email: "out@test.com",
                                 password: @password, password_confirmation: @password)

        # Other household
        @other_household = Household.create!(name: "Other")
        @other_owner = User.create!(name: "Other Owner", email: "other@test.com",
                                    password: @password, password_confirmation: @password)
        @other_household.household_memberships.create!(user: @other_owner, role: "owner",
                                                        grocery_permission: "full", status: "active")

        @recipe = @household.recipes.create!(
          contributed_by: @owner,
          recipe_type: "full",
          title: "Beef Stew",
          category: "soup_stew",
          servings: 6,
          ingredient_groups: [
            { "ingredients" => [{ "name" => "beef", "quantity" => 2, "unit" => "lbs" }] }
          ],
          instructions: [{ "step" => 1, "text" => "Cook the beef" }]
        )

        @other_recipe = @other_household.recipes.create!(
          contributed_by: @other_owner,
          recipe_type: "full",
          title: "Stranger Soup",
          category: "soup_stew",
          servings: 4,
          ingredient_groups: [
            { "ingredients" => [{ "name" => "carrot", "quantity" => 1 }] }
          ],
          instructions: [{ "step" => 1, "text" => "Cook" }]
        )
      end

      def auth_headers(user)
        token = JwtService.encode_access_token(user)
        { "Authorization" => "Bearer #{token}" }
      end

      # --- Index ---

      test "index returns recipes scoped to current household" do
        get "/api/v1/recipes", headers: auth_headers(@owner), as: :json

        assert_response :ok
        body = JSON.parse(response.body)
        recipes = body["data"]
        assert_equal 1, recipes.size
        assert_equal @recipe.apikey, recipes.first["id"]
      end

      test "index does not leak recipes from other households" do
        get "/api/v1/recipes", headers: auth_headers(@owner), as: :json
        body = JSON.parse(response.body)
        recipe_ids = body["data"].map { |r| r["id"] }
        refute_includes recipe_ids, @other_recipe.apikey
      end

      test "index requires authentication" do
        get "/api/v1/recipes", as: :json
        assert_response :unauthorized
      end

      test "index returns 428 for users without a household" do
        get "/api/v1/recipes", headers: auth_headers(@outsider), as: :json
        assert_response :precondition_required
      end

      test "index members can see recipes" do
        get "/api/v1/recipes", headers: auth_headers(@member), as: :json
        assert_response :ok
        body = JSON.parse(response.body)
        assert_equal 1, body["data"].size
      end

      test "index supports search by title" do
        @household.recipes.create!(
          contributed_by: @owner, recipe_type: "full", title: "Chicken Soup",
          category: "soup_stew", servings: 4,
          ingredient_groups: [{ "ingredients" => [{ "name" => "chicken" }] }],
          instructions: [{ "step" => 1, "text" => "boil" }]
        )

        get "/api/v1/recipes?q=beef", headers: auth_headers(@owner)
        body = JSON.parse(response.body)
        assert_equal 1, body["data"].size
        assert_equal "Beef Stew", body["data"].first["title"]
      end

      test "index supports filtering by recipe_type" do
        @household.recipes.create!(contributed_by: @owner, recipe_type: "quick_meal", title: "Pizza")

        get "/api/v1/recipes?recipe_type=quick_meal", headers: auth_headers(@owner)
        body = JSON.parse(response.body)
        assert_equal 1, body["data"].size
        assert_equal "Pizza", body["data"].first["title"]
      end

      test "index supports filtering by tags" do
        @household.recipes.create!(
          contributed_by: @owner, recipe_type: "full", title: "Tagged",
          category: "entree", servings: 2, tags: ["weeknight", "easy"],
          ingredient_groups: [{ "ingredients" => [{ "name" => "x" }] }],
          instructions: [{ "step" => 1, "text" => "x" }]
        )

        get "/api/v1/recipes?tags[]=weeknight", headers: auth_headers(@owner)
        body = JSON.parse(response.body)
        assert_equal 1, body["data"].size
      end

      # --- Show ---

      test "show returns recipe with full details" do
        get "/api/v1/recipes/#{@recipe.apikey}", headers: auth_headers(@owner), as: :json

        assert_response :ok
        body = JSON.parse(response.body)
        recipe = body["data"]
        assert_equal @recipe.apikey, recipe["id"]
        assert_equal "Beef Stew", recipe["title"]
        assert recipe["ingredient_groups"].present?
        assert recipe["instructions"].present?
        assert recipe["contributed_by"]["id"].present?
      end

      test "show returns 404 for recipe in another household" do
        get "/api/v1/recipes/#{@other_recipe.apikey}", headers: auth_headers(@owner), as: :json
        assert_response :not_found
      end

      test "show returns 404 for nonexistent recipe" do
        get "/api/v1/recipes/nonexistent", headers: auth_headers(@owner), as: :json
        assert_response :not_found
      end

      # --- Create ---

      test "owner can create a recipe" do
        assert_difference "Recipe.count", 1 do
          post "/api/v1/recipes",
               params: {
                 recipe: {
                   recipe_type: "full",
                   title: "New Recipe",
                   category: "entree",
                   servings: 4,
                   ingredient_groups: [
                     { ingredients: [{ name: "salt", quantity: 1, unit: "tsp" }] }
                   ],
                   instructions: [{ step: 1, text: "Add salt" }]
                 }
               },
               headers: auth_headers(@owner),
               as: :json
        end

        assert_response :created
        body = JSON.parse(response.body)
        assert body["data"]["id"].present?
        assert_equal "New Recipe", body["data"]["title"]
      end

      test "owner can create a quick meal" do
        post "/api/v1/recipes",
             params: { recipe: { recipe_type: "quick_meal", title: "Frozen Pizza" } },
             headers: auth_headers(@owner),
             as: :json

        assert_response :created
      end

      test "owner can create an event" do
        post "/api/v1/recipes",
             params: { recipe: { recipe_type: "event", title: "Family Dinner",
                                 notes: "At mom's" } },
             headers: auth_headers(@owner),
             as: :json

        assert_response :created
      end

      test "member cannot create a recipe" do
        assert_no_difference "Recipe.count" do
          post "/api/v1/recipes",
               params: { recipe: { recipe_type: "quick_meal", title: "Pizza" } },
               headers: auth_headers(@member),
               as: :json
        end

        assert_response :forbidden
      end

      test "create fails on invalid recipe" do
        post "/api/v1/recipes",
             params: { recipe: { recipe_type: "full", title: "" } },
             headers: auth_headers(@owner),
             as: :json

        assert_response :unprocessable_entity
      end

      # --- Update ---

      test "owner can update a recipe" do
        patch "/api/v1/recipes/#{@recipe.apikey}",
              params: { recipe: { title: "Updated Stew" } },
              headers: auth_headers(@owner),
              as: :json

        assert_response :ok
        assert_equal "Updated Stew", @recipe.reload.title
      end

      test "member cannot update a recipe" do
        patch "/api/v1/recipes/#{@recipe.apikey}",
              params: { recipe: { title: "Hijacked" } },
              headers: auth_headers(@member),
              as: :json

        assert_response :forbidden
        assert_equal "Beef Stew", @recipe.reload.title
      end

      # --- Destroy ---

      test "owner can delete a recipe" do
        assert_difference "Recipe.count", -1 do
          delete "/api/v1/recipes/#{@recipe.apikey}",
                 headers: auth_headers(@owner),
                 as: :json
        end
        assert_response :no_content
      end

      test "member cannot delete a recipe" do
        assert_no_difference "Recipe.count" do
          delete "/api/v1/recipes/#{@recipe.apikey}",
                 headers: auth_headers(@member),
                 as: :json
        end
        assert_response :forbidden
      end
    end
  end
end
