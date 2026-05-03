require "test_helper"

module Api
  module V1
    class SharedRecipesControllerTest < ActionDispatch::IntegrationTest
      def setup
        @password = "password123"

        # Owner of the recipe being shared
        @owner = User.create!(name: "Owner", email: "owner@share.test",
                              password: @password, password_confirmation: @password)
        @source_household = Household.create!(name: "Source Household")
        @source_household.household_memberships.create!(user: @owner, role: "owner",
                                                        grocery_permission: "full", status: "active")

        # User in a different household who will receive the share
        @recipient = User.create!(name: "Recipient", email: "recipient@share.test",
                                  password: @password, password_confirmation: @password)
        @recipient_household = Household.create!(name: "Recipient Household")
        @recipient_household.household_memberships.create!(user: @recipient, role: "owner",
                                                            grocery_permission: "full", status: "active")

        # User with no household — can view public, can't copy
        @homeless = User.create!(name: "Homeless", email: "homeless@share.test",
                                 password: @password, password_confirmation: @password)

        @recipe = @source_household.recipes.create!(
          contributed_by: @owner,
          recipe_type: "full",
          title: "Beef Stew",
          category: "soup_stew",
          servings: 6,
          notes: "Best served with crusty bread",
          ingredient_groups: [
            { "ingredients" => [{ "name" => "beef", "quantity" => 2, "unit" => "lbs" }] }
          ],
          instructions: [{ "step" => 1, "text" => "Cook the beef" }]
        )
        @recipe.generate_share_token!
      end

      def auth_headers(user)
        token = JwtService.encode_access_token(user)
        { "Authorization" => "Bearer #{token}" }
      end

      # --- show (public) ---

      test "anonymous users can fetch a shared recipe by token" do
        get "/api/v1/shared_recipes/#{@recipe.share_token}"

        assert_response :success
        body = JSON.parse(response.body)["data"]
        assert_equal "Beef Stew", body["title"]
        assert_equal false, body["can_copy"]
        assert_equal "Source Household", body["shared_by_household"]
        # Share token never echoed back in the public response body
        assert_nil body["share_token"]
      end

      test "authenticated users with a household get can_copy: true" do
        get "/api/v1/shared_recipes/#{@recipe.share_token}",
            headers: auth_headers(@recipient)

        assert_response :success
        body = JSON.parse(response.body)["data"]
        assert_equal true, body["can_copy"]
      end

      test "authenticated users without a household get can_copy: false" do
        get "/api/v1/shared_recipes/#{@recipe.share_token}",
            headers: auth_headers(@homeless)

        assert_response :success
        body = JSON.parse(response.body)["data"]
        assert_equal false, body["can_copy"]
      end

      test "unknown token returns 404" do
        get "/api/v1/shared_recipes/not-a-real-token"
        assert_response :not_found
      end

      test "revoked token returns 404" do
        @recipe.revoke_share_token!

        get "/api/v1/shared_recipes/some-old-token"
        assert_response :not_found
      end

      # --- copy (authenticated) ---

      test "authenticated recipient can copy a shared recipe into their household" do
        assert_difference "@recipient_household.recipes.count", 1 do
          post "/api/v1/shared_recipes/#{@recipe.share_token}/copy",
               headers: auth_headers(@recipient)
        end

        assert_response :created
        body = JSON.parse(response.body)["data"]

        copy = Recipe.find_by_apikey(body["id"])
        assert_equal @recipient_household.id, copy.household_id
        assert_equal @recipient.id, copy.contributed_by_id
        assert_equal "Beef Stew", copy.title
        assert_includes copy.notes, "Shared from Source Household"
        assert_includes copy.notes, "Best served with crusty bread"
        assert_equal @recipe.ingredient_groups, copy.ingredient_groups
        assert_equal @recipe.instructions, copy.instructions
      end

      test "unauthenticated copy returns 401" do
        post "/api/v1/shared_recipes/#{@recipe.share_token}/copy"
        assert_response :unauthorized
      end

      test "copy with revoked token returns 404" do
        @recipe.revoke_share_token!

        post "/api/v1/shared_recipes/some-old-token/copy",
             headers: auth_headers(@recipient)

        assert_response :not_found
      end

      test "copy without a household returns precondition_required" do
        post "/api/v1/shared_recipes/#{@recipe.share_token}/copy",
             headers: auth_headers(@homeless)

        assert_response :precondition_required
      end

      # --- copy with image attachment ---

      SMALL_JPEG_BYTES = "\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xFF\xD9".b.freeze unless defined?(SMALL_JPEG_BYTES)

      test "copy deep-copies the source attachment as an independent blob" do
        require "tempfile"
        tf = Tempfile.new([ "src", ".jpg" ]); tf.binmode; tf.write(SMALL_JPEG_BYTES); tf.rewind
        @recipe.image.attach(io: tf, filename: "src.jpg", content_type: "image/jpeg")
        assert @recipe.image.attached?
        source_blob_id = @recipe.image.blob.id
        source_bytes = @recipe.image.download

        post "/api/v1/shared_recipes/#{@recipe.share_token}/copy",
             headers: auth_headers(@recipient)

        assert_response :created
        body = JSON.parse(response.body)
        copy = Recipe.find_by_apikey!(body["data"]["id"])

        assert copy.image.attached?, "expected the copy to have its own attachment"
        assert_not_equal source_blob_id, copy.image.blob.id, "expected a fresh blob (not a shared reference)"
        assert_equal source_bytes, copy.image.download, "copy bytes should match source bytes"

        # Independence check: purging the source should not affect the copy
        @recipe.image.purge
        copy.reload
        assert copy.image.attached?, "copy survives source's purge"
      ensure
        tf&.close!
      end

      test "copy without a source attachment leaves the copy without an attachment" do
        assert_not @recipe.image.attached?, "setup precondition: no attachment on source"

        post "/api/v1/shared_recipes/#{@recipe.share_token}/copy",
             headers: auth_headers(@recipient)

        assert_response :created
        body = JSON.parse(response.body)
        copy = Recipe.find_by_apikey!(body["data"]["id"])
        assert_not copy.image.attached?
      end
    end
  end
end
