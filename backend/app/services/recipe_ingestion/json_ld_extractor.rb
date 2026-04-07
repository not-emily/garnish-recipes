require "nokogiri"
require "json"

module RecipeIngestion
  # Parses HTML and returns the first Schema.org Recipe object found in any
  # <script type="application/ld+json"> block. Returns nil if no Recipe is
  # present. Handles both top-level @type=Recipe and @graph wrappers.
  class JsonLdExtractor
    def self.extract(html)
      new(html).extract
    end

    def initialize(html)
      @html = html
    end

    def extract
      doc = Nokogiri::HTML(@html)
      doc.css('script[type="application/ld+json"]').each do |script|
        recipe = find_recipe(safe_parse(script.text))
        return recipe if recipe
      end
      nil
    end

    private

    def safe_parse(text)
      JSON.parse(text)
    rescue JSON::ParserError
      nil
    end

    # Recursively walks parsed JSON looking for a Recipe object.
    # Schema.org allows: {@type: "Recipe"}, {@graph: [...]}, arrays at root.
    def find_recipe(node)
      case node
      when Array
        node.each { |item| result = find_recipe(item); return result if result }
        nil
      when Hash
        return node if recipe?(node)
        if node["@graph"].is_a?(Array)
          result = find_recipe(node["@graph"])
          return result if result
        end
        nil
      end
    end

    def recipe?(hash)
      type = hash["@type"]
      Array(type).any? { |t| t.to_s == "Recipe" }
    end
  end
end
