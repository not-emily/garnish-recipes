require "test_helper"

module Api
  module V1
    class SmartSectionsTest < ActionDispatch::IntegrationTest
      def setup
        @password = "password123"

        @owner = User.create!(name: "Owner", email: "owner@smart.test",
                              password: @password, password_confirmation: @password)
        @household = Household.create!(name: "Test Household")
        @household.household_memberships.create!(user: @owner, role: "owner",
                                                  grocery_permission: "full", status: "active")

        @other_household = Household.create!(name: "Other")
        @other_owner = User.create!(name: "Other", email: "other@smart.test",
                                    password: @password, password_confirmation: @password)
        @other_household.household_memberships.create!(user: @other_owner, role: "owner",
                                                        grocery_permission: "full", status: "active")
      end

      def auth_headers(user)
        token = JwtService.encode_access_token(user)
        { "Authorization" => "Bearer #{token}" }
      end

      def make_recipe(attrs = {})
        defaults = {
          contributed_by: @owner, recipe_type: "full",
          title: "Recipe #{rand(1000)}", category: "entree", servings: 4,
          ingredient_groups: [{ "ingredients" => [{ "name" => "stuff" }] }],
          instructions: [{ "text" => "Cook" }]
        }
        @household.recipes.create!(defaults.merge(attrs))
      end

      test "returns all five section keys" do
        get "/api/v1/recipes/smart_sections", headers: auth_headers(@owner), as: :json
        assert_response :ok
        body = JSON.parse(response.body)
        %w[recently_used favorites havent_made_in_a_while never_tried quick_meals].each do |key|
          assert body["data"].key?(key), "Missing section: #{key}"
          assert_kind_of Array, body["data"][key]
        end
      end

      test "recently_used includes recipes cooked in last 30 days" do
        recent = make_recipe(title: "Recent", last_cooked_at: 5.days.ago, times_cooked: 1)
        old = make_recipe(title: "Old", last_cooked_at: 60.days.ago, times_cooked: 1)

        get "/api/v1/recipes/smart_sections", headers: auth_headers(@owner), as: :json
        body = JSON.parse(response.body)
        titles = body["data"]["recently_used"].map { |r| r["title"] }
        assert_includes titles, "Recent"
        refute_includes titles, "Old"
      end

      test "favorites includes rated recipes" do
        rated = make_recipe(title: "Rated", average_rating: 4.5, rating_count: 2)
        unrated = make_recipe(title: "Unrated")

        get "/api/v1/recipes/smart_sections", headers: auth_headers(@owner), as: :json
        body = JSON.parse(response.body)
        titles = body["data"]["favorites"].map { |r| r["title"] }
        assert_includes titles, "Rated"
        refute_includes titles, "Unrated"
      end

      test "never_tried includes recipes with zero cook count" do
        never = make_recipe(title: "Never Tried", times_cooked: 0)
        cooked = make_recipe(title: "Cooked", times_cooked: 3, last_cooked_at: 2.days.ago)

        get "/api/v1/recipes/smart_sections", headers: auth_headers(@owner), as: :json
        body = JSON.parse(response.body)
        titles = body["data"]["never_tried"].map { |r| r["title"] }
        assert_includes titles, "Never Tried"
        refute_includes titles, "Cooked"
      end

      test "quick_meals includes quick_meal type recipes" do
        quick = @household.recipes.create!(
          contributed_by: @owner, recipe_type: "quick_meal", title: "Frozen Pizza"
        )

        get "/api/v1/recipes/smart_sections", headers: auth_headers(@owner), as: :json
        body = JSON.parse(response.body)
        titles = body["data"]["quick_meals"].map { |r| r["title"] }
        assert_includes titles, "Frozen Pizza"
      end

      test "does not include recipes from other households" do
        @other_household.recipes.create!(
          contributed_by: @other_owner, recipe_type: "full", title: "Stranger Recipe",
          category: "entree", servings: 4,
          ingredient_groups: [{ "ingredients" => [{ "name" => "x" }] }],
          instructions: [{ "text" => "x" }],
          times_cooked: 0
        )

        get "/api/v1/recipes/smart_sections", headers: auth_headers(@owner), as: :json
        body = JSON.parse(response.body)
        all_titles = body["data"].values.flatten.map { |r| r["title"] }
        refute_includes all_titles, "Stranger Recipe"
      end

      test "requires authentication" do
        get "/api/v1/recipes/smart_sections", as: :json
        assert_response :unauthorized
      end

      test "empty sections return empty arrays" do
        get "/api/v1/recipes/smart_sections", headers: auth_headers(@owner), as: :json
        body = JSON.parse(response.body)
        body["data"].each do |key, value|
          assert_kind_of Array, value, "Section #{key} should be an array"
        end
      end
    end
  end
end
