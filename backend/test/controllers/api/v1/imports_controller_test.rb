require "test_helper"

module Api
  module V1
    class ImportsControllerTest < ActionDispatch::IntegrationTest
      def setup
        @password = "password123"

        @owner = User.create!(name: "Owner", email: "owner@imp.test",
                              password: @password, password_confirmation: @password)
        @household = Household.create!(name: "HH")
        @household.household_memberships.create!(user: @owner, role: "owner",
                                                  grocery_permission: "full", status: "active")

        @member = User.create!(name: "Member", email: "member@imp.test",
                               password: @password, password_confirmation: @password)
        @household.household_memberships.create!(user: @member, role: "member",
                                                  grocery_permission: "contribute", status: "active")

        @outsider = User.create!(name: "Outsider", email: "out@imp.test",
                                 password: @password, password_confirmation: @password)
      end

      def teardown
        # Restore the original perform_later if any test redefined it
        RecipeIngestionJob.singleton_class.send(:remove_method, :perform_later) rescue nil
      end

      def auth_headers(user)
        token = JwtService.encode_access_token(user)
        { "Authorization" => "Bearer #{token}" }
      end

      # Replace perform_later with a no-op (or capture closure) so the real
      # ingestion job doesn't run during controller tests.
      def stub_job_perform_later(&capture)
        capture ||= ->(_id) {}
        RecipeIngestionJob.define_singleton_method(:perform_later) do |id|
          capture.call(id)
          true
        end
      end

      # --- POST /api/v1/imports ---

      test "create returns 202 and a draft recipe with import_status importing" do
        stub_job_perform_later

        post "/api/v1/imports",
             headers: auth_headers(@owner),
             params: { url: "https://example.com/recipes/x" },
             as: :json

        assert_response :accepted
        body = JSON.parse(response.body)
        assert_equal "importing", body["data"]["import_status"]
        assert_equal "url", body["data"]["import_source_type"]
        assert_equal "https://example.com/recipes/x", body["data"]["source_url"]
        assert_present body["data"]["id"]

        # The draft is persisted
        recipe = Recipe.find_by(apikey: body["data"]["id"])
        assert_not_nil recipe
        assert_equal "importing", recipe.import_status
      end

      test "create enqueues a RecipeIngestionJob" do
        enqueued = []
        stub_job_perform_later { |id| enqueued << id }

        post "/api/v1/imports",
             headers: auth_headers(@owner),
             params: { url: "https://example.com/r" },
             as: :json

        assert_response :accepted
        body = JSON.parse(response.body)
        recipe = Recipe.find_by(apikey: body["data"]["id"])
        assert_includes enqueued, recipe.id
      end

      test "create rejects blank url" do
        post "/api/v1/imports",
             headers: auth_headers(@owner),
             params: { url: "" },
             as: :json
        assert_response :unprocessable_entity
        body = JSON.parse(response.body)
        assert_equal "validation_failed", body["error"]["code"]
      end

      test "create requires authentication" do
        post "/api/v1/imports", params: { url: "https://example.com/r" }, as: :json
        assert_response :unauthorized
      end

      test "create requires admin/owner role (member is forbidden)" do
        post "/api/v1/imports",
             headers: auth_headers(@member),
             params: { url: "https://example.com/r" },
             as: :json
        assert_response :forbidden
      end

      test "create returns 428 for users without a household" do
        post "/api/v1/imports",
             headers: auth_headers(@outsider),
             params: { url: "https://example.com/r" },
             as: :json
        assert_response :precondition_required
      end

      # --- GET /api/v1/imports/:apikey ---

      test "show returns the import status for a draft recipe" do
        recipe = @household.recipes.create!(
          contributed_by: @owner, recipe_type: "full",
          source_url: "https://example.com/r",
          import_source_type: "url", import_status: :importing
        )

        get "/api/v1/imports/#{recipe.apikey}", headers: auth_headers(@owner)
        assert_response :ok
        body = JSON.parse(response.body)
        assert_equal recipe.apikey, body["data"]["id"]
        assert_equal "importing", body["data"]["import_status"]
      end

      test "show returns 404 for unknown apikey" do
        get "/api/v1/imports/does-not-exist", headers: auth_headers(@owner)
        assert_response :not_found
      end

      test "show does not leak imports from other households" do
        other_hh = Household.create!(name: "Other")
        other_user = User.create!(name: "Other", email: "o@imp.test",
                                  password: @password, password_confirmation: @password)
        other_hh.household_memberships.create!(user: other_user, role: "owner",
                                                grocery_permission: "full", status: "active")
        other_recipe = other_hh.recipes.create!(
          contributed_by: other_user, recipe_type: "full",
          source_url: "https://example.com/x",
          import_source_type: "url", import_status: :importing
        )

        get "/api/v1/imports/#{other_recipe.apikey}", headers: auth_headers(@owner)
        assert_response :not_found
      end

      private

      def assert_present(value)
        assert value.present?, "expected value to be present, got #{value.inspect}"
      end
    end
  end
end
