require "test_helper"
require "tempfile"

# ActiveStorage's attach(io:) silently fails on StringIO in some configs —
# requires a real file-like object with .path/.size. Tempfile works.
SMALL_JPEG_BYTES = "\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xFF\xD9".b.freeze

def make_tempfile(bytes, ext: ".jpg")
  tf = Tempfile.new([ "test", ext ])
  tf.binmode
  tf.write(bytes)
  tf.rewind
  tf
end

class RecipeImageTest < ActiveSupport::TestCase
  def setup
    @password = "password123"
    @owner = User.create!(name: "Owner", email: "owner@image.test",
                          password: @password, password_confirmation: @password)
    @household = Household.create!(name: "Image Household")
    @household.household_memberships.create!(user: @owner, role: "owner",
                                             grocery_permission: "full", status: "active")
    @recipe = @household.recipes.create!(
      contributed_by: @owner, recipe_type: "full",
      title: "Image Test", category: "entree", servings: 4,
      ingredient_groups: [ { "ingredients" => [ { "name" => "noodles" } ] } ],
      instructions: [ { "text" => "Boil" } ]
    )
  end

  test "attaches a small JPEG cleanly" do
    tf = make_tempfile(SMALL_JPEG_BYTES)
    @recipe.image.attach(io: tf, filename: "test.jpg", content_type: "image/jpeg")
    assert @recipe.valid?, @recipe.errors.full_messages.join("; ")
    assert @recipe.image.attached?
    assert_equal "image/jpeg", @recipe.image.content_type
  ensure
    tf&.close!
  end

  # Note on the assertion shape: ActiveStorage's `attach` on a persisted record
  # triggers an internal save that fires our validators. When a validator
  # rejects, attach returns nil, the attachment is purged in the validator,
  # and the attachment is never persisted. The recipe in memory keeps the
  # error message until reload.

  test "rejects an image over 10 MB" do
    tf = make_tempfile("x" * (11 * 1024 * 1024))
    result = @recipe.image.attach(io: tf, filename: "big.jpg", content_type: "image/jpeg")

    assert_nil result, "expected attach to return nil on validation failure"
    assert_not @recipe.image.attached?, "expected oversize attachment to be rejected"
    assert_includes @recipe.errors[:image], "must be under 10 MB"
  ensure
    tf&.close!
  end

  test "rejects a non-image content type" do
    tf = make_tempfile("hello", ext: ".txt")
    result = @recipe.image.attach(io: tf, filename: "note.txt", content_type: "text/plain")

    assert_nil result
    assert_not @recipe.image.attached?
    assert_includes @recipe.errors[:image], "must be JPEG, PNG, WebP, or HEIC"
  ensure
    tf&.close!
  end

  test "validators are no-ops when image is not attached" do
    @recipe.title = "Updated"
    assert @recipe.save
    assert_not @recipe.image.attached?
  end

  test "image variants are defined and resolvable" do
    tf = make_tempfile(SMALL_JPEG_BYTES)
    @recipe.image.attach(io: tf, filename: "test.jpg", content_type: "image/jpeg")

    # The variant object can be constructed without actually processing the
    # image (processing requires libvips and a real bitmap, which our 21-byte
    # placeholder isn't). This confirms the variant transformations are
    # registered on the attachment.
    assert_kind_of ActiveStorage::VariantWithRecord, @recipe.image.variant(:thumb)
    assert_kind_of ActiveStorage::VariantWithRecord, @recipe.image.variant(:detail)
  ensure
    tf&.close!
  end
end
