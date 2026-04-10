require "cgi"

module RecipeIngestion
  # Maps a Schema.org Recipe hash to attributes that match Garnish's Recipe
  # model. Returns a hash suitable for `recipe.assign_attributes(...)`.
  #
  # Schema.org reference: https://schema.org/Recipe
  class Normalizer
    def self.from_schema_org(json_ld)
      new(json_ld).normalize
    end

    def initialize(json_ld)
      @data = json_ld || {}
    end

    def normalize
      {
        title: string(@data["name"]),
        description: string(@data["description"]),
        servings: parse_servings(@data["recipeYield"]),
        prep_time_minutes: iso8601_to_minutes(@data["prepTime"]),
        cook_time_minutes: iso8601_to_minutes(@data["cookTime"]),
        # totalTime is set explicitly by some sites (Smitten Kitchen, others
        # that don't break time into prep/cook). The Recipe model auto-
        # computes total from prep+cook on save, but only when one of those
        # is set — so we pass total directly to handle the prep/cook-empty case.
        total_time_minutes: iso8601_to_minutes(@data["totalTime"]),
        category: normalize_category(@data["recipeCategory"]),
        cuisine: string(first(@data["recipeCuisine"])),
        image_url: extract_image(@data["image"]),
        ingredient_groups: build_ingredient_groups(@data["recipeIngredient"]),
        instructions: build_instructions(@data["recipeInstructions"])
      }.compact
    end

    private

    def string(val)
      s = CGI.unescapeHTML(first(val).to_s).strip
      s.presence
    end

    def first(val)
      val.is_a?(Array) ? val.first : val
    end

    # ISO 8601 duration → minutes. Handles "PT30M", "PT1H", "PT1H30M", "PT2H15M".
    # Returns nil for unparseable values.
    def iso8601_to_minutes(value)
      return nil if value.blank?
      str = value.to_s
      return nil unless str.start_with?("PT") || str.start_with?("P")
      hours = str[/(\d+)H/, 1].to_i
      minutes = str[/(\d+)M/, 1].to_i
      total = hours * 60 + minutes
      total.positive? ? total : nil
    end

    # recipeYield can be "4", 4, "4 servings", ["4 servings", "4"]
    def parse_servings(value)
      return nil if value.blank?
      candidate = first(value).to_s
      match = candidate.match(/\d+/)
      match ? match[0].to_i : nil
    end

    # Schema.org recipeCategory values are freeform; we map common ones to our
    # CATEGORIES enum and fall back to nil so the user can pick later.
    def normalize_category(value)
      return nil if value.blank?
      raw = first(value).to_s.downcase.strip
      return nil if raw.empty?

      mapping = {
        "main course" => "entree", "main dish" => "entree", "main" => "entree",
        "entree" => "entree", "entrée" => "entree", "dinner" => "entree",
        "side dish" => "side", "side" => "side",
        "appetizer" => "appetizer", "starter" => "appetizer",
        "soup" => "soup_stew", "stew" => "soup_stew", "soup or stew" => "soup_stew",
        "salad" => "salad",
        "breakfast" => "breakfast", "brunch" => "breakfast",
        "dessert" => "dessert",
        "snack" => "snack",
        "drink" => "beverage", "beverage" => "beverage", "cocktail" => "beverage",
        "sauce" => "sauce_dressing", "dressing" => "sauce_dressing", "condiment" => "sauce_dressing"
      }
      mapping[raw]
    end

    def extract_image(value)
      return nil if value.blank?
      candidate = first(value)
      case candidate
      when String then candidate
      when Hash then candidate["url"] || candidate["@id"]
      end
    end

    def build_ingredient_groups(ingredients)
      list = Array(ingredients).map { |i| { "name" => i.to_s.strip } }.reject { |i| i["name"].empty? }
      return nil if list.empty?
      [ { "heading" => nil, "ingredients" => list } ]
    end

    # recipeInstructions can be:
    #   - a string (newline-separated)
    #   - an array of strings
    #   - an array of HowToStep objects ({@type: "HowToStep", text: "..."})
    #   - an array of HowToSection containing itemListElement
    def build_instructions(instructions)
      steps = flatten_steps(instructions)
      return nil if steps.empty?
      steps.map { |text| { "text" => text } }
    end

    def flatten_steps(node)
      case node
      when nil then []
      when String then node.split(/\r?\n+/).map(&:strip).reject(&:empty?)
      when Array then node.flat_map { |n| flatten_steps(n) }
      when Hash
        type = Array(node["@type"]).map(&:to_s)
        if type.include?("HowToSection") && node["itemListElement"]
          flatten_steps(node["itemListElement"])
        elsif node["text"]
          [ node["text"].to_s.strip ].reject(&:empty?)
        elsif node["name"]
          [ node["name"].to_s.strip ].reject(&:empty?)
        else
          []
        end
      else []
      end
    end
  end
end
