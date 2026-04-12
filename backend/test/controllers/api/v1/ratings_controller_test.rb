require "test_helper"

module Api
  module V1
    class RatingsControllerTest < ActionDispatch::IntegrationTest
      def setup
        @password = "password123"

        @owner = User.create!(name: "Owner", email: "owner@rate.test",
                              password: @password, password_confirmation: @password)
        @household = Household.create!(name: "Test Household")
        @household.household_memberships.create!(user: @owner, role: "owner",
                                                  grocery_permission: "full", status: "active")

        @member = User.create!(name: "Member", email: "member@rate.test",
                               password: @password, password_confirmation: @password)
        @household.household_memberships.create!(user: @member, role: "member",
                                                  grocery_permission: "contribute", status: "active")

        @outsider = User.create!(name: "Outsider", email: "out@rate.test",
                                 password: @password, password_confirmation: @password)

        @recipe = @household.recipes.create!(
          contributed_by: @owner, recipe_type: "full", title: "Pasta",
          category: "entree", servings: 4,
          ingredient_groups: [{ "ingredients" => [{ "name" => "noodles" }] }],
          instructions: [{ "step" => 1, "text" => "Boil" }]
        )
      end

      def auth_headers(user)
        token = JwtService.encode_access_token(user)
        { "Authorization" => "Bearer #{token}" }
      end

      # --- Upsert ---

      test "create a new rating" do
        assert_difference "RecipeRating.count", 1 do
          post "/api/v1/recipes/#{@recipe.apikey}/ratings",
               headers: auth_headers(@owner),
               params: { rating: { score: 5 } },
               as: :json
        end
        assert_response :created
        body = JSON.parse(response.body)
        assert_equal 5, body["data"]["score"]
        assert_equal 5.0, body["data"]["average_rating"]
        assert_equal 1, body["data"]["rating_count"]
      end

      test "update an existing rating" do
        @recipe.recipe_ratings.create!(user: @owner, score: 3)

        assert_no_difference "RecipeRating.count" do
          post "/api/v1/recipes/#{@recipe.apikey}/ratings",
               headers: auth_headers(@owner),
               params: { rating: { score: 5 } },
               as: :json
        end
        assert_response :ok
        body = JSON.parse(response.body)
        assert_equal 5, body["data"]["score"]
      end

      test "multiple users rating computes correct average" do
        post "/api/v1/recipes/#{@recipe.apikey}/ratings",
             headers: auth_headers(@owner),
             params: { rating: { score: 5 } },
             as: :json

        post "/api/v1/recipes/#{@recipe.apikey}/ratings",
             headers: auth_headers(@member),
             params: { rating: { score: 3 } },
             as: :json

        body = JSON.parse(response.body)
        assert_equal 4.0, body["data"]["average_rating"]
        assert_equal 2, body["data"]["rating_count"]
      end

      test "rating with invalid score returns 422" do
        post "/api/v1/recipes/#{@recipe.apikey}/ratings",
             headers: auth_headers(@owner),
             params: { rating: { score: 6 } },
             as: :json
        assert_response :unprocessable_entity
      end

      test "rating requires authentication" do
        post "/api/v1/recipes/#{@recipe.apikey}/ratings",
             params: { rating: { score: 4 } },
             as: :json
        assert_response :unauthorized
      end

      test "rating returns 404 for recipe in another household" do
        other_household = Household.create!(name: "Other")
        other_household.household_memberships.create!(user: @outsider, role: "owner",
                                                       grocery_permission: "full", status: "active")
        post "/api/v1/recipes/#{@recipe.apikey}/ratings",
             headers: auth_headers(@outsider),
             params: { rating: { score: 4 } },
             as: :json
        assert_response :not_found
      end

      # --- Destroy ---

      test "delete own rating" do
        @recipe.recipe_ratings.create!(user: @owner, score: 4)

        assert_difference "RecipeRating.count", -1 do
          delete "/api/v1/recipes/#{@recipe.apikey}/ratings",
                 headers: auth_headers(@owner), as: :json
        end
        assert_response :ok
        body = JSON.parse(response.body)
        assert_nil body["data"]["average_rating"]
        assert_equal 0, body["data"]["rating_count"]
      end

      test "delete returns 404 if not rated" do
        delete "/api/v1/recipes/#{@recipe.apikey}/ratings",
               headers: auth_headers(@owner), as: :json
        assert_response :not_found
      end

      # --- Index ---

      test "index returns all ratings with user names" do
        @recipe.recipe_ratings.create!(user: @owner, score: 5)
        @recipe.recipe_ratings.create!(user: @member, score: 4)

        get "/api/v1/recipes/#{@recipe.apikey}/ratings",
            headers: auth_headers(@owner), as: :json
        assert_response :ok
        body = JSON.parse(response.body)
        assert_equal 4.5, body["data"]["average_rating"]
        assert_equal 2, body["data"]["rating_count"]
        assert_equal 5, body["data"]["my_rating"]
        assert_equal 2, body["data"]["ratings"].size
      end

      test "index shows nil for my_rating when not rated" do
        get "/api/v1/recipes/#{@recipe.apikey}/ratings",
            headers: auth_headers(@owner), as: :json
        assert_response :ok
        body = JSON.parse(response.body)
        assert_nil body["data"]["my_rating"]
      end

      # --- Serialization ---

      test "recipe show includes my_rating" do
        @recipe.recipe_ratings.create!(user: @owner, score: 4)

        get "/api/v1/recipes/#{@recipe.apikey}",
            headers: auth_headers(@owner), as: :json
        assert_response :ok
        body = JSON.parse(response.body)
        assert_equal 4, body["data"]["my_rating"]
        assert_equal 4.0, body["data"]["average_rating"]
        assert_equal 1, body["data"]["rating_count"]
      end

      test "recipe index includes average_rating and rating_count" do
        @recipe.recipe_ratings.create!(user: @owner, score: 5)

        get "/api/v1/recipes",
            headers: auth_headers(@owner), as: :json
        assert_response :ok
        body = JSON.parse(response.body)
        recipe = body["data"].find { |r| r["id"] == @recipe.apikey }
        assert_equal 5.0, recipe["average_rating"]
        assert_equal 1, recipe["rating_count"]
      end
    end
  end
end
