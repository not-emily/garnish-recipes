require "test_helper"

module RecipeIngestion
  class JsonLdExtractorTest < ActiveSupport::TestCase
    test "returns nil when no JSON-LD is present" do
      assert_nil JsonLdExtractor.extract("<html><body>nothing here</body></html>")
    end

    test "returns nil when JSON-LD is present but contains no Recipe" do
      html = <<~HTML
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","name":"Not a recipe"}
        </script>
      HTML
      assert_nil JsonLdExtractor.extract(html)
    end

    test "extracts a top-level Recipe" do
      html = <<~HTML
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Recipe","name":"Cookies"}
        </script>
      HTML
      result = JsonLdExtractor.extract(html)
      assert_equal "Cookies", result["name"]
    end

    test "extracts a Recipe nested inside @graph" do
      html = <<~HTML
        <script type="application/ld+json">
        {"@context":"https://schema.org","@graph":[
          {"@type":"WebPage","name":"Article page"},
          {"@type":"Recipe","name":"Pasta"}
        ]}
        </script>
      HTML
      result = JsonLdExtractor.extract(html)
      assert_equal "Pasta", result["name"]
    end

    test "extracts a Recipe from an array of root JSON-LD objects" do
      html = <<~HTML
        <script type="application/ld+json">
        [{"@type":"Organization","name":"Site"},{"@type":"Recipe","name":"Soup"}]
        </script>
      HTML
      result = JsonLdExtractor.extract(html)
      assert_equal "Soup", result["name"]
    end

    test "handles @type as an array containing Recipe" do
      html = <<~HTML
        <script type="application/ld+json">
        {"@type":["Recipe","Thing"],"name":"Bread"}
        </script>
      HTML
      result = JsonLdExtractor.extract(html)
      assert_equal "Bread", result["name"]
    end

    test "ignores invalid JSON in one block but finds Recipe in another" do
      html = <<~HTML
        <script type="application/ld+json">{ this is broken</script>
        <script type="application/ld+json">
        {"@type":"Recipe","name":"Salad"}
        </script>
      HTML
      result = JsonLdExtractor.extract(html)
      assert_equal "Salad", result["name"]
    end
  end
end
