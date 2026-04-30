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

      test "show returns null image_thumb_url and image_detail_url when no attachment" do
        get "/api/v1/recipes/#{@recipe.apikey}", headers: auth_headers(@owner), as: :json
        assert_response :ok
        recipe = JSON.parse(response.body)["data"]
        assert recipe.key?("image_thumb_url")
        assert recipe.key?("image_detail_url")
        assert_nil recipe["image_thumb_url"]
        assert_nil recipe["image_detail_url"]
      end

      test "show returns proxy URLs for image_thumb_url and image_detail_url when attached" do
        require "tempfile"
        tf = Tempfile.new([ "test", ".jpg" ])
        tf.binmode
        tf.write("\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xFF\xD9".b)
        tf.rewind
        @recipe.image.attach(io: tf, filename: "test.jpg", content_type: "image/jpeg")
        assert @recipe.image.attached?, "expected attachment to succeed for valid JPEG"

        get "/api/v1/recipes/#{@recipe.apikey}", headers: auth_headers(@owner), as: :json
        assert_response :ok
        recipe = JSON.parse(response.body)["data"]
        assert_match(%r{/rails/active_storage/representations/proxy/}, recipe["image_thumb_url"])
        assert_match(%r{/rails/active_storage/representations/proxy/}, recipe["image_detail_url"])
      ensure
        tf&.close!
      end

      test "show returns 404 for recipe in another household" do
        get "/api/v1/recipes/#{@other_recipe.apikey}", headers: auth_headers(@owner), as: :json
        assert_response :not_found
      end

      test "show returns 404 for nonexistent recipe" do
        get "/api/v1/recipes/nonexistent", headers: auth_headers(@owner), as: :json
        assert_response :not_found
      end

      test "show allows viewing recipe from shared collection" do
        collection = @household.recipe_collections.create!(user: @owner, name: "Shared Favs")
        collection.collection_recipes.create!(recipe: @recipe)
        collection.collection_shares.create!(shared_with: @other_owner)

        get "/api/v1/recipes/#{@recipe.apikey}?collection=#{collection.apikey}",
            headers: auth_headers(@other_owner), as: :json
        assert_response :ok
        body = JSON.parse(response.body)
        assert_equal @recipe.apikey, body["data"]["id"]
      end

      test "show returns 404 for recipe via unshared collection" do
        collection = @household.recipe_collections.create!(user: @owner, name: "Private")
        collection.collection_recipes.create!(recipe: @recipe)

        get "/api/v1/recipes/#{@recipe.apikey}?collection=#{collection.apikey}",
            headers: auth_headers(@other_owner), as: :json
        assert_response :not_found
      end

      # --- Collections membership ---

      test "collections returns user's collections with has_recipe flag" do
        col1 = @household.recipe_collections.create!(user: @owner, name: "Favorites")
        col2 = @household.recipe_collections.create!(user: @owner, name: "Weeknight")
        col1.collection_recipes.create!(recipe: @recipe)

        get "/api/v1/recipes/#{@recipe.apikey}/collections", headers: auth_headers(@owner), as: :json
        assert_response :ok
        body = JSON.parse(response.body)
        assert_equal 2, body["data"].size

        fav = body["data"].find { |c| c["name"] == "Favorites" }
        wkn = body["data"].find { |c| c["name"] == "Weeknight" }
        assert_equal true, fav["has_recipe"]
        assert_equal false, wkn["has_recipe"]
      end

      test "collections only returns current user's collections" do
        @household.recipe_collections.create!(user: @member, name: "Member Favs")
        @household.recipe_collections.create!(user: @owner, name: "Owner Favs")

        get "/api/v1/recipes/#{@recipe.apikey}/collections", headers: auth_headers(@owner), as: :json
        body = JSON.parse(response.body)
        assert_equal 1, body["data"].size
        assert_equal "Owner Favs", body["data"].first["name"]
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

      # --- share / unshare ---

      test "owner can generate a share token" do
        assert_nil @recipe.share_token

        post "/api/v1/recipes/#{@recipe.apikey}/share",
             headers: auth_headers(@owner),
             as: :json

        assert_response :success
        body = JSON.parse(response.body)["data"]
        assert_not_nil body["share_token"]
        assert_includes body["share_url"], "/r/shared/#{body['share_token']}"
        assert_equal body["share_token"], @recipe.reload.share_token
      end

      test "share is idempotent — repeat returns the same token" do
        post "/api/v1/recipes/#{@recipe.apikey}/share",
             headers: auth_headers(@owner), as: :json
        first_token = JSON.parse(response.body)["data"]["share_token"]

        post "/api/v1/recipes/#{@recipe.apikey}/share",
             headers: auth_headers(@owner), as: :json
        second_token = JSON.parse(response.body)["data"]["share_token"]

        assert_equal first_token, second_token
      end

      test "member without admin cannot share a recipe" do
        post "/api/v1/recipes/#{@recipe.apikey}/share",
             headers: auth_headers(@member), as: :json

        assert_response :forbidden
        assert_nil @recipe.reload.share_token
      end

      test "outsider cannot share a recipe" do
        post "/api/v1/recipes/#{@recipe.apikey}/share",
             headers: auth_headers(@outsider), as: :json

        assert_response :precondition_required
      end

      test "owner can revoke a share token" do
        @recipe.generate_share_token!

        delete "/api/v1/recipes/#{@recipe.apikey}/share",
               headers: auth_headers(@owner), as: :json

        assert_response :no_content
        assert_nil @recipe.reload.share_token
      end

      test "revoking then resharing produces a different token" do
        post "/api/v1/recipes/#{@recipe.apikey}/share",
             headers: auth_headers(@owner), as: :json
        first_token = JSON.parse(response.body)["data"]["share_token"]

        delete "/api/v1/recipes/#{@recipe.apikey}/share",
               headers: auth_headers(@owner), as: :json

        post "/api/v1/recipes/#{@recipe.apikey}/share",
             headers: auth_headers(@owner), as: :json
        second_token = JSON.parse(response.body)["data"]["share_token"]

        assert_not_equal first_token, second_token
      end

      test "share_token and share_url appear in recipe show response" do
        @recipe.generate_share_token!

        get "/api/v1/recipes/#{@recipe.apikey}",
            headers: auth_headers(@owner), as: :json

        body = JSON.parse(response.body)["data"]
        assert_equal @recipe.share_token, body["share_token"]
        assert_includes body["share_url"], @recipe.share_token
      end

      test "share_url is nil when recipe is not shared" do
        get "/api/v1/recipes/#{@recipe.apikey}",
            headers: auth_headers(@owner), as: :json

        body = JSON.parse(response.body)["data"]
        assert_nil body["share_token"]
        assert_nil body["share_url"]
      end

      # --- my_rating sort ---

      test "sort=my_rating orders by current user's score desc, NULLS LAST, title asc" do
        rated_high = @household.recipes.create!(
          contributed_by: @owner, recipe_type: "full", title: "Aaa", category: "entree",
          servings: 4,
          ingredient_groups: [{ "ingredients" => [{ "name" => "x" }] }],
          instructions: [{ "step" => 1, "text" => "Cook" }]
        )
        rated_low = @household.recipes.create!(
          contributed_by: @owner, recipe_type: "full", title: "Bbb", category: "entree",
          servings: 4,
          ingredient_groups: [{ "ingredients" => [{ "name" => "y" }] }],
          instructions: [{ "step" => 1, "text" => "Cook" }]
        )
        unrated = @household.recipes.create!(
          contributed_by: @owner, recipe_type: "full", title: "Ccc", category: "entree",
          servings: 4,
          ingredient_groups: [{ "ingredients" => [{ "name" => "z" }] }],
          instructions: [{ "step" => 1, "text" => "Cook" }]
        )
        RecipeRating.create!(recipe: rated_high, user: @owner, score: 5)
        RecipeRating.create!(recipe: rated_low, user: @owner, score: 2)

        get "/api/v1/recipes?sort=my_rating",
            headers: auth_headers(@owner), as: :json

        titles = JSON.parse(response.body)["data"].map { |r| r["title"] }
        # rated_high (5) first, rated_low (2) second; @recipe and unrated
        # both NULL, ordered alphabetically by title (Beef Stew, Ccc).
        assert_equal "Aaa", titles.first
        assert_equal "Bbb", titles[1]
        # Unrated tail in title order
        unrated_titles = titles[2..]
        assert_equal unrated_titles.sort, unrated_titles
      end

      test "sort=my_rating uses each user's own rating, not someone else's" do
        rated_by_member_only = @household.recipes.create!(
          contributed_by: @owner, recipe_type: "full", title: "Aaa", category: "entree",
          servings: 4,
          ingredient_groups: [{ "ingredients" => [{ "name" => "x" }] }],
          instructions: [{ "step" => 1, "text" => "Cook" }]
        )
        rated_by_owner = @household.recipes.create!(
          contributed_by: @owner, recipe_type: "full", title: "Bbb", category: "entree",
          servings: 4,
          ingredient_groups: [{ "ingredients" => [{ "name" => "y" }] }],
          instructions: [{ "step" => 1, "text" => "Cook" }]
        )
        RecipeRating.create!(recipe: rated_by_member_only, user: @member, score: 5)
        RecipeRating.create!(recipe: rated_by_owner, user: @owner, score: 3)

        get "/api/v1/recipes?sort=my_rating",
            headers: auth_headers(@owner), as: :json

        titles = JSON.parse(response.body)["data"].map { |r| r["title"] }
        # Owner: rated_by_owner (3) first, then NULLs alphabetically
        assert_equal "Bbb", titles.first
      end
    end
  end
end
