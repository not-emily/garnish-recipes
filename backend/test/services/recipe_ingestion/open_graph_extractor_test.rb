require "test_helper"

module RecipeIngestion
  class OpenGraphExtractorTest < ActiveSupport::TestCase
    test "returns nil when no OG or fallback metadata is present" do
      assert_nil OpenGraphExtractor.extract("<html><body>nothing</body></html>")
    end

    test "extracts og:title, og:description, og:image" do
      html = <<~HTML
        <html><head>
          <meta property="og:title" content="Black Bean Salad">
          <meta property="og:description" content="A vibrant summer salad.">
          <meta property="og:image" content="https://example.com/salad.jpg">
        </head></html>
      HTML
      result = OpenGraphExtractor.extract(html)
      assert_equal "Recipe", result["@type"]
      assert_equal "Black Bean Salad", result["name"]
      assert_equal "A vibrant summer salad.", result["description"]
      assert_equal "https://example.com/salad.jpg", result["image"]
    end

    test "falls back to <title> when og:title is missing" do
      html = "<html><head><title>Document Title</title></head></html>"
      assert_equal "Document Title", OpenGraphExtractor.extract(html)["name"]
    end

    test "falls back to twitter:title and twitter:image" do
      html = <<~HTML
        <meta name="twitter:title" content="Tweet Title">
        <meta name="twitter:image" content="https://example.com/t.jpg">
      HTML
      # twitter:* tags use the property attribute on some sites
      html2 = <<~HTML
        <meta property="twitter:title" content="Tweet Title">
        <meta property="twitter:image" content="https://example.com/t.jpg">
      HTML
      result = OpenGraphExtractor.extract(html2)
      assert_equal "Tweet Title", result["name"]
      assert_equal "https://example.com/t.jpg", result["image"]
    end

    test "falls back to <meta name=description> when og:description is missing" do
      html = '<meta name="description" content="A page description.">'
      assert_equal "A page description.", OpenGraphExtractor.extract(html)["description"]
    end

    test "compacts away missing fields" do
      html = '<meta property="og:title" content="Just a title">'
      result = OpenGraphExtractor.extract(html)
      assert_equal "Just a title", result["name"]
      refute result.key?("description")
      refute result.key?("image")
    end
  end
end
