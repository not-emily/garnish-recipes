require "test_helper"

module RecipeIngestion
  class NormalizerTest < ActiveSupport::TestCase
    test "maps standard Schema.org Recipe fields" do
      attrs = Normalizer.from_schema_org(
        "name" => "Pancakes",
        "description" => "Fluffy.",
        "recipeYield" => "4 servings",
        "prepTime" => "PT10M",
        "cookTime" => "PT15M",
        "recipeCategory" => "Breakfast",
        "recipeCuisine" => "American",
        "image" => "https://example.com/p.jpg",
        "recipeIngredient" => [ "2 cups flour", "1 tbsp sugar" ],
        "recipeInstructions" => [
          { "@type" => "HowToStep", "text" => "Mix" },
          { "@type" => "HowToStep", "text" => "Cook" }
        ]
      )

      assert_equal "Pancakes", attrs[:title]
      assert_equal "Fluffy.", attrs[:description]
      assert_equal 4, attrs[:servings]
      assert_equal 10, attrs[:prep_time_minutes]
      assert_equal 15, attrs[:cook_time_minutes]
      assert_equal "breakfast", attrs[:category]
      assert_equal "American", attrs[:cuisine]
      assert_equal "https://example.com/p.jpg", attrs[:image_url]
      assert_equal 2, attrs[:ingredient_groups].first["ingredients"].size
      assert_equal 2, attrs[:instructions].size
      assert_equal "Mix", attrs[:instructions].first["text"]
    end

    test "ISO 8601 durations: PT1H30M parses to 90 minutes" do
      attrs = Normalizer.from_schema_org("name" => "X", "prepTime" => "PT1H30M")
      assert_equal 90, attrs[:prep_time_minutes]
    end

    test "ISO 8601 durations: PT2H parses to 120 minutes" do
      attrs = Normalizer.from_schema_org("name" => "X", "cookTime" => "PT2H")
      assert_equal 120, attrs[:cook_time_minutes]
    end

    test "ISO 8601 durations: missing or unparseable returns nil (not in hash)" do
      attrs = Normalizer.from_schema_org("name" => "X", "prepTime" => "garbage")
      refute attrs.key?(:prep_time_minutes)
    end

    test "recipeYield: pulls digits from a freeform string" do
      attrs = Normalizer.from_schema_org("name" => "X", "recipeYield" => "Makes 12 cookies")
      assert_equal 12, attrs[:servings]
    end

    test "recipeYield: accepts integer" do
      attrs = Normalizer.from_schema_org("name" => "X", "recipeYield" => 6)
      assert_equal 6, attrs[:servings]
    end

    test "recipeYield: array — uses first" do
      attrs = Normalizer.from_schema_org("name" => "X", "recipeYield" => [ "8 servings", "8" ])
      assert_equal 8, attrs[:servings]
    end

    test "category mapping: known values map to canonical category" do
      assert_equal "entree", Normalizer.from_schema_org("name" => "x", "recipeCategory" => "Main Course")[:category]
      assert_equal "soup_stew", Normalizer.from_schema_org("name" => "x", "recipeCategory" => "Soup")[:category]
      assert_equal "dessert", Normalizer.from_schema_org("name" => "x", "recipeCategory" => "Dessert")[:category]
    end

    test "category mapping: unknown values are dropped (not in hash)" do
      attrs = Normalizer.from_schema_org("name" => "x", "recipeCategory" => "Cosmic Goo")
      refute attrs.key?(:category)
    end

    test "image: extracts URL from a hash with @id" do
      attrs = Normalizer.from_schema_org(
        "name" => "x",
        "image" => { "@type" => "ImageObject", "@id" => "https://x.com/i.jpg" }
      )
      assert_equal "https://x.com/i.jpg", attrs[:image_url]
    end

    test "image: extracts first URL from an array of strings" do
      attrs = Normalizer.from_schema_org(
        "name" => "x",
        "image" => [ "https://x.com/a.jpg", "https://x.com/b.jpg" ]
      )
      assert_equal "https://x.com/a.jpg", attrs[:image_url]
    end

    test "instructions: handles a plain string with newline-separated steps" do
      attrs = Normalizer.from_schema_org(
        "name" => "x",
        "recipeInstructions" => "Boil water.\nAdd pasta.\n\nServe."
      )
      assert_equal 3, attrs[:instructions].size
      assert_equal "Boil water.", attrs[:instructions][0]["text"]
    end

    test "instructions: handles an array of plain strings" do
      attrs = Normalizer.from_schema_org(
        "name" => "x",
        "recipeInstructions" => [ "Step one", "Step two" ]
      )
      assert_equal 2, attrs[:instructions].size
    end

    test "instructions: flattens HowToSection itemListElement" do
      attrs = Normalizer.from_schema_org(
        "name" => "x",
        "recipeInstructions" => [
          {
            "@type" => "HowToSection",
            "name" => "Make the dough",
            "itemListElement" => [
              { "@type" => "HowToStep", "text" => "Mix flour and water" },
              { "@type" => "HowToStep", "text" => "Knead for 5 minutes" }
            ]
          },
          {
            "@type" => "HowToSection",
            "name" => "Bake",
            "itemListElement" => [
              { "@type" => "HowToStep", "text" => "Bake at 400F for 30 minutes" }
            ]
          }
        ]
      )
      assert_equal 3, attrs[:instructions].size
      assert_equal "Mix flour and water", attrs[:instructions][0]["text"]
      assert_equal "Bake at 400F for 30 minutes", attrs[:instructions][2]["text"]
    end

    test "ingredients: empty array maps to no ingredient_groups key" do
      attrs = Normalizer.from_schema_org("name" => "x", "recipeIngredient" => [])
      refute attrs.key?(:ingredient_groups)
    end

    test "ingredients: skips blank entries" do
      attrs = Normalizer.from_schema_org(
        "name" => "x",
        "recipeIngredient" => [ "1 cup flour", "", "  " ]
      )
      assert_equal 1, attrs[:ingredient_groups].first["ingredients"].size
    end

    test "blank input produces an empty hash" do
      assert_equal({}, Normalizer.from_schema_org(nil))
      assert_equal({}, Normalizer.from_schema_org({}))
    end
  end
end
