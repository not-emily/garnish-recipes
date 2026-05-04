require "test_helper"
require "tempfile"

class WarmRecipeImageVariantsJobTest < ActiveJob::TestCase
  SMALL_JPEG_BYTES = "\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xFF\xD9".b.freeze unless defined?(SMALL_JPEG_BYTES)

  def setup
    @owner = User.create!(name: "Warm", email: "warm@test.com",
                          password: "password123", password_confirmation: "password123")
    @household = Household.create!(name: "Warm Household")
    @household.household_memberships.create!(user: @owner, role: "owner",
                                              grocery_permission: "full", status: "active")
    @recipe = @household.recipes.create!(
      contributed_by: @owner, recipe_type: "full",
      title: "Warm test", category: "entree", servings: 2,
      ingredient_groups: [ { "ingredients" => [ { "name" => "x" } ] } ],
      instructions: [ { "text" => "y" } ]
    )
  end

  test "is a no-op when the recipe has no image attached" do
    assert_not @recipe.image.attached?
    assert_nothing_raised { WarmRecipeImageVariantsJob.perform_now(@recipe.id) }
  end

  test "is a no-op when the recipe was deleted between enqueue and perform" do
    deleted_id = @recipe.id
    @recipe.destroy
    assert_nothing_raised { WarmRecipeImageVariantsJob.perform_now(deleted_id) }
  end

  test "swallows per-variant errors rather than failing the job" do
    # Attach our fake-JPEG (valid enough to attach, not valid enough for
    # ImageMagick to actually transform). Variant `.processed` will likely
    # raise inside the loop; the job's rescue must catch it so the job
    # itself succeeds.
    tf = Tempfile.new([ "warm", ".jpg" ]); tf.binmode; tf.write(SMALL_JPEG_BYTES); tf.rewind
    @recipe.image.attach(io: tf, filename: "warm.jpg", content_type: "image/jpeg")
    assert @recipe.image.attached?

    assert_nothing_raised { WarmRecipeImageVariantsJob.perform_now(@recipe.id) }
  ensure
    tf&.close!
  end

end
