require "test_helper"

module Api
  module V1
    class CollectionsControllerTest < ActionDispatch::IntegrationTest
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

        @outsider = User.create!(name: "Outsider", email: "out@test.com",
                                 password: @password, password_confirmation: @password)

        @other_household = Household.create!(name: "Other")
        @other_owner = User.create!(name: "Other Owner", email: "other@test.com",
                                    password: @password, password_confirmation: @password)
        @other_household.household_memberships.create!(user: @other_owner, role: "owner",
                                                        grocery_permission: "full", status: "active")

        @recipe = @household.recipes.create!(
          contributed_by: @owner, recipe_type: "full", title: "Beef Stew",
          category: "soup_stew", servings: 6,
          ingredient_groups: [{ "ingredients" => [{ "name" => "beef", "quantity" => 2, "unit" => "lbs" }] }],
          instructions: [{ "step" => 1, "text" => "Cook the beef" }]
        )

        @recipe2 = @household.recipes.create!(
          contributed_by: @owner, recipe_type: "full", title: "Chicken Soup",
          category: "soup_stew", servings: 4,
          ingredient_groups: [{ "ingredients" => [{ "name" => "chicken" }] }],
          instructions: [{ "step" => 1, "text" => "Boil" }]
        )

        @collection = @household.recipe_collections.create!(
          user: @owner, name: "Favorites", description: "My favorites", visibility: "private"
        )
      end

      def auth_headers(user)
        token = JwtService.encode_access_token(user)
        { "Authorization" => "Bearer #{token}" }
      end

      # --- Index ---

      test "index returns own collections" do
        get "/api/v1/collections", headers: auth_headers(@owner), as: :json
        assert_response :ok
        body = JSON.parse(response.body)
        assert_equal 1, body["data"].size
        assert_equal @collection.apikey, body["data"].first["id"]
      end

      test "index does not show other member's private collections" do
        get "/api/v1/collections", headers: auth_headers(@member), as: :json
        assert_response :ok
        body = JSON.parse(response.body)
        assert_equal 0, body["data"].size
      end

      test "index shows household-visible collections from other members" do
        @collection.update!(visibility: "household")
        get "/api/v1/collections", headers: auth_headers(@member), as: :json
        assert_response :ok
        body = JSON.parse(response.body)
        assert_equal 1, body["data"].size
      end

      test "index does not show collections from other households" do
        @other_household.recipe_collections.create!(
          user: @other_owner, name: "Other Favs", visibility: "household"
        )
        get "/api/v1/collections", headers: auth_headers(@owner), as: :json
        body = JSON.parse(response.body)
        collection_names = body["data"].map { |c| c["name"] }
        refute_includes collection_names, "Other Favs"
      end

      test "index requires authentication" do
        get "/api/v1/collections", as: :json
        assert_response :unauthorized
      end

      test "index returns 428 for users without a household" do
        get "/api/v1/collections", headers: auth_headers(@outsider), as: :json
        assert_response :precondition_required
      end

      test "index supports search" do
        @household.recipe_collections.create!(user: @owner, name: "Weeknight Dinners")
        get "/api/v1/collections?q=weeknight", headers: auth_headers(@owner), as: :json
        body = JSON.parse(response.body)
        assert_equal 1, body["data"].size
        assert_equal "Weeknight Dinners", body["data"].first["name"]
      end

      test "index includes recipe_count" do
        @collection.collection_recipes.create!(recipe: @recipe)
        get "/api/v1/collections", headers: auth_headers(@owner), as: :json
        body = JSON.parse(response.body)
        assert_equal 1, body["data"].first["recipe_count"]
      end

      test "index includes is_mine flag" do
        @collection.update!(visibility: "household")
        # Member sees it but is_mine should be false
        get "/api/v1/collections", headers: auth_headers(@member), as: :json
        body = JSON.parse(response.body)
        assert_equal false, body["data"].first["is_mine"]

        # Owner sees it with is_mine true
        get "/api/v1/collections", headers: auth_headers(@owner), as: :json
        body = JSON.parse(response.body)
        assert_equal true, body["data"].first["is_mine"]
      end

      # --- Show ---

      test "show returns collection with recipes" do
        @collection.collection_recipes.create!(recipe: @recipe)
        get "/api/v1/collections/#{@collection.apikey}", headers: auth_headers(@owner), as: :json
        assert_response :ok
        body = JSON.parse(response.body)
        assert_equal @collection.apikey, body["data"]["id"]
        assert_equal 1, body["data"]["recipes"].size
        assert_equal @recipe.apikey, body["data"]["recipes"].first["id"]
      end

      test "show returns 403 for other member viewing private collection" do
        get "/api/v1/collections/#{@collection.apikey}", headers: auth_headers(@member), as: :json
        assert_response :forbidden
      end

      test "show allows member to view household collection" do
        @collection.update!(visibility: "household")
        get "/api/v1/collections/#{@collection.apikey}", headers: auth_headers(@member), as: :json
        assert_response :ok
      end

      test "show returns 404 for nonexistent collection" do
        get "/api/v1/collections/nonexistent", headers: auth_headers(@owner), as: :json
        assert_response :not_found
      end

      # --- Create ---

      test "create collection" do
        assert_difference "RecipeCollection.count", 1 do
          post "/api/v1/collections",
               headers: auth_headers(@owner),
               params: { collection: { name: "New Collection", description: "Desc", visibility: "private" } },
               as: :json
        end
        assert_response :created
        body = JSON.parse(response.body)
        assert_equal "New Collection", body["data"]["name"]
        assert_equal "private", body["data"]["visibility"]
        assert body["data"]["id"].present?
      end

      test "create collection as member" do
        post "/api/v1/collections",
             headers: auth_headers(@member),
             params: { collection: { name: "Member Collection" } },
             as: :json
        assert_response :created
        body = JSON.parse(response.body)
        assert_equal true, body["data"]["is_mine"]
      end

      test "create collection with invalid params" do
        post "/api/v1/collections",
             headers: auth_headers(@owner),
             params: { collection: { name: "" } },
             as: :json
        assert_response :unprocessable_entity
      end

      test "create collection defaults to private visibility" do
        post "/api/v1/collections",
             headers: auth_headers(@owner),
             params: { collection: { name: "Test" } },
             as: :json
        assert_response :created
        body = JSON.parse(response.body)
        assert_equal "private", body["data"]["visibility"]
      end

      # --- Update ---

      test "update collection" do
        patch "/api/v1/collections/#{@collection.apikey}",
              headers: auth_headers(@owner),
              params: { collection: { name: "Renamed", visibility: "household" } },
              as: :json
        assert_response :ok
        body = JSON.parse(response.body)
        assert_equal "Renamed", body["data"]["name"]
        assert_equal "household", body["data"]["visibility"]
      end

      test "update collection forbidden for non-owner" do
        @collection.update!(visibility: "household")
        patch "/api/v1/collections/#{@collection.apikey}",
              headers: auth_headers(@member),
              params: { collection: { name: "Hijacked" } },
              as: :json
        assert_response :forbidden
      end

      # --- Destroy ---

      test "destroy collection" do
        assert_difference "RecipeCollection.count", -1 do
          delete "/api/v1/collections/#{@collection.apikey}",
                 headers: auth_headers(@owner), as: :json
        end
        assert_response :no_content
      end

      test "destroy collection forbidden for non-owner" do
        @collection.update!(visibility: "household")
        delete "/api/v1/collections/#{@collection.apikey}",
               headers: auth_headers(@member), as: :json
        assert_response :forbidden
      end

      test "destroy cascades to collection_recipes" do
        @collection.collection_recipes.create!(recipe: @recipe)
        assert_difference "CollectionRecipe.count", -1 do
          delete "/api/v1/collections/#{@collection.apikey}",
                 headers: auth_headers(@owner), as: :json
        end
      end
    end

    # --- Collection Recipes ---

    class CollectionRecipesControllerTest < ActionDispatch::IntegrationTest
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

        @recipe = @household.recipes.create!(
          contributed_by: @owner, recipe_type: "full", title: "Beef Stew",
          category: "soup_stew", servings: 6,
          ingredient_groups: [{ "ingredients" => [{ "name" => "beef" }] }],
          instructions: [{ "step" => 1, "text" => "Cook" }]
        )

        @recipe2 = @household.recipes.create!(
          contributed_by: @owner, recipe_type: "full", title: "Chicken Soup",
          category: "soup_stew", servings: 4,
          ingredient_groups: [{ "ingredients" => [{ "name" => "chicken" }] }],
          instructions: [{ "step" => 1, "text" => "Boil" }]
        )

        @other_household = Household.create!(name: "Other")
        @other_owner = User.create!(name: "Other Owner", email: "other@test.com",
                                    password: @password, password_confirmation: @password)
        @other_household.household_memberships.create!(user: @other_owner, role: "owner",
                                                        grocery_permission: "full", status: "active")
        @other_recipe = @other_household.recipes.create!(
          contributed_by: @other_owner, recipe_type: "full", title: "Stranger Soup",
          category: "soup_stew", servings: 4,
          ingredient_groups: [{ "ingredients" => [{ "name" => "carrot" }] }],
          instructions: [{ "step" => 1, "text" => "Cook" }]
        )

        @collection = @household.recipe_collections.create!(
          user: @owner, name: "Favorites", visibility: "private"
        )
      end

      def auth_headers(user)
        token = JwtService.encode_access_token(user)
        { "Authorization" => "Bearer #{token}" }
      end

      # --- Add recipe ---

      test "add recipe to collection" do
        assert_difference "CollectionRecipe.count", 1 do
          post "/api/v1/collections/#{@collection.apikey}/recipes",
               headers: auth_headers(@owner),
               params: { recipe_apikey: @recipe.apikey },
               as: :json
        end
        assert_response :created
      end

      test "add recipe returns 422 for duplicate" do
        @collection.collection_recipes.create!(recipe: @recipe)
        post "/api/v1/collections/#{@collection.apikey}/recipes",
             headers: auth_headers(@owner),
             params: { recipe_apikey: @recipe.apikey },
             as: :json
        assert_response :unprocessable_entity
      end

      test "add recipe forbidden for non-owner" do
        @collection.update!(visibility: "household")
        post "/api/v1/collections/#{@collection.apikey}/recipes",
             headers: auth_headers(@member),
             params: { recipe_apikey: @recipe.apikey },
             as: :json
        assert_response :forbidden
      end

      test "add recipe returns 404 for recipe from another household" do
        post "/api/v1/collections/#{@collection.apikey}/recipes",
             headers: auth_headers(@owner),
             params: { recipe_apikey: @other_recipe.apikey },
             as: :json
        assert_response :not_found
      end

      test "add recipe returns 404 for nonexistent recipe" do
        post "/api/v1/collections/#{@collection.apikey}/recipes",
             headers: auth_headers(@owner),
             params: { recipe_apikey: "nonexistent" },
             as: :json
        assert_response :not_found
      end

      # --- Remove recipe ---

      test "remove recipe from collection" do
        @collection.collection_recipes.create!(recipe: @recipe)
        assert_difference "CollectionRecipe.count", -1 do
          delete "/api/v1/collections/#{@collection.apikey}/recipes/#{@recipe.apikey}",
                 headers: auth_headers(@owner), as: :json
        end
        assert_response :no_content
      end

      test "remove recipe forbidden for non-owner" do
        @collection.update!(visibility: "household")
        @collection.collection_recipes.create!(recipe: @recipe)
        delete "/api/v1/collections/#{@collection.apikey}/recipes/#{@recipe.apikey}",
               headers: auth_headers(@member), as: :json
        assert_response :forbidden
      end

      test "remove recipe returns 404 for recipe not in collection" do
        delete "/api/v1/collections/#{@collection.apikey}/recipes/#{@recipe.apikey}",
               headers: auth_headers(@owner), as: :json
        assert_response :not_found
      end

      test "remove recipe returns 404 for nonexistent collection" do
        delete "/api/v1/collections/nonexistent/recipes/#{@recipe.apikey}",
               headers: auth_headers(@owner), as: :json
        assert_response :not_found
      end
    end
  end
end
