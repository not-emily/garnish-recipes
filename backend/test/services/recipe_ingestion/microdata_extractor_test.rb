require "test_helper"

module RecipeIngestion
  class MicrodataExtractorTest < ActiveSupport::TestCase
    test "returns nil when no microdata Recipe scope is present" do
      assert_nil MicrodataExtractor.extract("<html><body>nothing</body></html>")
    end

    test "extracts a basic Recipe with name and ingredients" do
      html = <<~HTML
        <div itemscope itemtype="https://schema.org/Recipe">
          <h1 itemprop="name">Test Pasta</h1>
          <ul>
            <li itemprop="recipeIngredient">1 lb spaghetti</li>
            <li itemprop="recipeIngredient">2 cloves garlic</li>
            <li itemprop="recipeIngredient">olive oil</li>
          </ul>
        </div>
      HTML
      result = MicrodataExtractor.extract(html)
      assert_equal "Recipe", result["@type"]
      assert_equal "Test Pasta", result["name"]
      assert_equal [ "1 lb spaghetti", "2 cloves garlic", "olive oil" ], result["recipeIngredient"]
    end

    test "extracts time elements via the datetime attribute" do
      html = <<~HTML
        <div itemscope itemtype="https://schema.org/Recipe">
          <h1 itemprop="name">x</h1>
          <time itemprop="prepTime" datetime="PT10M">10 minutes</time>
          <time itemprop="cookTime" datetime="PT1H">1 hour</time>
        </div>
      HTML
      result = MicrodataExtractor.extract(html)
      assert_equal "PT10M", result["prepTime"]
      assert_equal "PT1H", result["cookTime"]
    end

    test "extracts img elements via the src attribute" do
      html = <<~HTML
        <div itemscope itemtype="https://schema.org/Recipe">
          <img itemprop="image" src="https://example.com/pic.jpg" alt="x">
        </div>
      HTML
      assert_equal "https://example.com/pic.jpg", MicrodataExtractor.extract(html)["image"]
    end

    test "extracts meta elements via the content attribute" do
      html = <<~HTML
        <div itemscope itemtype="https://schema.org/Recipe">
          <meta itemprop="recipeYield" content="4 servings">
          <h1 itemprop="name">x</h1>
        </div>
      HTML
      assert_equal "4 servings", MicrodataExtractor.extract(html)["recipeYield"]
    end

    test "recurses into nested HowToStep itemscopes for instructions" do
      html = <<~HTML
        <div itemscope itemtype="https://schema.org/Recipe">
          <h1 itemprop="name">x</h1>
          <div itemprop="recipeInstructions" itemscope itemtype="https://schema.org/HowToStep">
            <span itemprop="text">Boil water</span>
          </div>
          <div itemprop="recipeInstructions" itemscope itemtype="https://schema.org/HowToStep">
            <span itemprop="text">Add pasta</span>
          </div>
        </div>
      HTML
      result = MicrodataExtractor.extract(html)
      steps = result["recipeInstructions"]
      assert_kind_of Array, steps
      assert_equal 2, steps.size
      assert_equal "Boil water", steps[0]["text"]
      assert_equal "Add pasta", steps[1]["text"]
    end

    test "does not collect itemprops from a nested itemscope into the parent scope" do
      # The nested HowToStep has its own `text` itemprop. That should belong
      # to the HowToStep, not bubble up to the Recipe scope.
      html = <<~HTML
        <div itemscope itemtype="https://schema.org/Recipe">
          <h1 itemprop="name">Recipe Name</h1>
          <div itemprop="recipeInstructions" itemscope itemtype="https://schema.org/HowToStep">
            <span itemprop="text">Should not be on Recipe</span>
          </div>
        </div>
      HTML
      result = MicrodataExtractor.extract(html)
      refute result.key?("text"), "text should belong to HowToStep, not Recipe"
    end

    test "ignores other Recipe scopes after the first" do
      html = <<~HTML
        <div itemscope itemtype="https://schema.org/Recipe">
          <h1 itemprop="name">First</h1>
        </div>
        <div itemscope itemtype="https://schema.org/Recipe">
          <h1 itemprop="name">Second</h1>
        </div>
      HTML
      assert_equal "First", MicrodataExtractor.extract(html)["name"]
    end

    test "matches itemtype with http or https schema.org URLs" do
      [ "http://schema.org/Recipe", "https://schema.org/Recipe" ].each do |url|
        html = %(<div itemscope itemtype="#{url}"><span itemprop="name">x</span></div>)
        refute_nil MicrodataExtractor.extract(html), "should match #{url}"
      end
    end
  end
end
