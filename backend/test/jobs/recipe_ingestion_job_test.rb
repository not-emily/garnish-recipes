require "test_helper"

class RecipeIngestionJobTest < ActiveSupport::TestCase
  def setup
    @user = User.create!(name: "Cook", email: "cook@test.com",
                         password: "password123", password_confirmation: "password123")
    @household = Household.create!(name: "HH")
    @household.household_memberships.create!(user: @user, role: "owner",
                                              grocery_permission: "full", status: "active")
  end

  def teardown
    # Restore the real UrlParser.fetch in case a test stubbed it
    if RecipeIngestion::UrlParser.singleton_class.method_defined?(:fetch)
      RecipeIngestion::UrlParser.singleton_class.send(:remove_method, :fetch) rescue nil
    end
  end

  def make_draft(source_url: "https://example.com/r")
    @household.recipes.create!(
      contributed_by: @user, recipe_type: "full",
      source_url: source_url, import_source_type: "url", import_status: :importing
    )
  end

  def stub_fetch(url:, html:)
    RecipeIngestion::UrlParser.define_singleton_method(:fetch) do |_|
      { url: url, html: html }
    end
  end

  def stub_fetch_raises(error)
    RecipeIngestion::UrlParser.define_singleton_method(:fetch) do |_|
      raise error
    end
  end

  test "URL with full Schema.org Recipe → status complete + populated fields" do
    html = <<~HTML
      <script type="application/ld+json">
      {"@type":"Recipe","name":"Test Pasta","recipeYield":"4",
       "prepTime":"PT5M","cookTime":"PT15M","recipeCategory":"Main Course",
       "recipeIngredient":["1 lb pasta","2 cloves garlic"],
       "recipeInstructions":[{"@type":"HowToStep","text":"Boil"}]}
      </script>
    HTML
    stub_fetch(url: "https://example.com/r", html: html)

    recipe = make_draft
    RecipeIngestionJob.perform_now(recipe.id)
    recipe.reload

    assert_equal "complete", recipe.import_status
    assert_equal "Test Pasta", recipe.title
    assert_equal 4, recipe.servings
    assert_equal 5, recipe.prep_time_minutes
    assert_equal 15, recipe.cook_time_minutes
    assert_equal "entree", recipe.category
    assert_equal 2, recipe.ingredient_groups.first["ingredients"].size
    assert_equal 1, recipe.instructions.size
    assert_not_nil recipe.import_completed_at
  end

  test "URL with no JSON-LD → status needs_review with fallback title" do
    stub_fetch(url: "https://example.com/blog/recipe-post",
               html: "<html><body>just plain text</body></html>")

    recipe = make_draft(source_url: "https://example.com/blog/recipe-post")
    RecipeIngestionJob.perform_now(recipe.id)
    recipe.reload

    assert_equal "needs_review", recipe.import_status
    assert_equal "Recipe from example.com", recipe.title
    assert_equal "https://example.com/blog/recipe-post", recipe.source_url
  end

  test "URL with JSON-LD missing ingredients → status needs_review" do
    html = <<~HTML
      <script type="application/ld+json">
      {"@type":"Recipe","name":"Mystery Dish"}
      </script>
    HTML
    stub_fetch(url: "https://example.com/r", html: html)

    recipe = make_draft
    RecipeIngestionJob.perform_now(recipe.id)
    recipe.reload

    assert_equal "needs_review", recipe.import_status
    assert_equal "Mystery Dish", recipe.title
  end

  test "fetch error → status failed with error message" do
    stub_fetch_raises(RecipeIngestion::UrlParser::FetchError.new("HTTP 404"))

    recipe = make_draft
    RecipeIngestionJob.perform_now(recipe.id)
    recipe.reload

    assert_equal "failed", recipe.import_status
    assert_match(/HTTP 404/, recipe.import_error)
  end

  test "no-op when recipe is already complete" do
    stub_fetch(url: "x", html: "should not run")

    recipe = make_draft
    recipe.update_columns(import_status: Recipe.import_statuses[:complete], title: "Already done")

    RecipeIngestionJob.perform_now(recipe.id)
    recipe.reload
    assert_equal "Already done", recipe.title
  end

  test "no-op when recipe id does not exist" do
    assert_nothing_raised { RecipeIngestionJob.perform_now(999_999) }
  end
end
