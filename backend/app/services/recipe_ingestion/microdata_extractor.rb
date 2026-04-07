require "nokogiri"

module RecipeIngestion
  # Parses Schema.org Microdata embedded in HTML attributes (an alternative
  # to JSON-LD that uses itemscope/itemtype/itemprop). Returns a hash shaped
  # like the Schema.org Recipe object that JsonLdExtractor returns, so the
  # same Normalizer can process it.
  #
  # Example:
  #   <div itemscope itemtype="https://schema.org/Recipe">
  #     <h1 itemprop="name">Pasta</h1>
  #     <ul>
  #       <li itemprop="recipeIngredient">1 lb pasta</li>
  #       <li itemprop="recipeIngredient">2 cloves garlic</li>
  #     </ul>
  #     <div itemprop="recipeInstructions" itemscope itemtype="https://schema.org/HowToStep">
  #       <span itemprop="text">Boil the pasta.</span>
  #     </div>
  #   </div>
  class MicrodataExtractor
    def self.extract(html)
      new(html).extract
    end

    def initialize(html)
      @html = html
    end

    def extract
      doc = Nokogiri::HTML(@html)
      recipe_node = doc.at_css('[itemscope][itemtype*="Recipe"]')
      return nil unless recipe_node
      parse_scope(recipe_node)
    end

    private

    # Walk a single itemscope and return its properties as a hash. Multi-value
    # properties (recipeIngredient, recipeInstructions) are collected as arrays.
    # Nested itemscopes recurse and produce nested hashes.
    def parse_scope(node)
      result = {}
      result["@type"] = scope_type(node)
      walk_into(node, result)
      result
    end

    def scope_type(node)
      types = node["itemtype"].to_s.split(/\s+/)
      # Take the last URL path segment of the first itemtype: "schema.org/Recipe" → "Recipe"
      first = types.first.to_s
      first.split("/").last.presence || "Recipe"
    end

    def walk_into(node, result)
      node.children.each do |child|
        next unless child.element?
        prop = child["itemprop"]

        if prop
          value = if child["itemscope"]
                    parse_scope(child)
                  else
                    extract_value(child)
                  end
          add_property(result, prop, value)
        end

        # Don't descend into a nested itemscope — its descendants belong to
        # the nested scope, which we've already parsed via parse_scope.
        next if child["itemscope"]

        # Descend into non-scope children to find more properties of the
        # current scope (microdata allows itemprop elements at any depth).
        walk_into(child, result)
      end
    end

    def add_property(result, name, value)
      if result.key?(name)
        result[name] = [ result[name] ] unless result[name].is_a?(Array)
        result[name] << value
      else
        result[name] = value
      end
    end

    # Extract the property value from a non-itemscope element. The HTML5
    # microdata spec defines element-specific value sources.
    def extract_value(node)
      case node.name
      when "meta"             then node["content"].to_s
      when "img"              then node["src"].to_s
      when "audio", "embed", "iframe", "source", "track", "video"
        node["src"].to_s
      when "a", "area", "link" then node["href"].to_s
      when "object"           then node["data"].to_s
      when "time"             then node["datetime"].presence || node.text.strip
      when "data", "meter"    then node["value"].to_s
      else
        # Some sites still set a content attribute on a div/span — honor it.
        node["content"].presence || node.text.strip
      end
    end
  end
end
