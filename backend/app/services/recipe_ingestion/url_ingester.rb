module RecipeIngestion
  # Coordinates the URL ingestion path: fetch the page, find Schema.org
  # Recipe JSON-LD, normalize it, and assign attributes to the recipe.
  #
  # Returns a result hash:
  #   { status: :complete | :needs_review | :failed, attributes: {...}, error: nil | "..." }
  class UrlIngester
    def self.call(url)
      new(url).call
    end

    def initialize(url)
      @url = url
    end

    def call
      result = UrlParser.fetch(@url)

      # Try extractors in order of fidelity:
      #   1. JSON-LD (most modern recipe sites; Google's preferred format)
      #   2. Microdata (Smitten Kitchen and many WordPress food blogs)
      #   3. Open Graph (last resort — title/description/image only, but
      #      better than a blank sheet for sites with no structured data)
      raw = JsonLdExtractor.extract(result[:html]) ||
            MicrodataExtractor.extract(result[:html]) ||
            OpenGraphExtractor.extract(result[:html])

      attrs = if raw
                Normalizer.from_schema_org(raw).merge(source_url: result[:url])
              else
                { source_url: result[:url] }
              end

      status = sufficient?(attrs) ? :complete : :needs_review
      { status: status, attributes: attrs, error: nil }
    rescue UrlParser::FetchError => e
      { status: :failed, attributes: {}, error: e.message }
    end

    private

    # A recipe is "complete" if it has a title, at least one ingredient, AND
    # at least one instruction step. Anything less needs human review — for
    # example, microdata sites that mark ingredients but write instructions
    # as freeform prose, or pages where we only got Open Graph metadata.
    def sufficient?(attrs)
      return false unless attrs[:title].present?

      has_ingredients = attrs[:ingredient_groups].is_a?(Array) &&
                        attrs[:ingredient_groups].any? { |g| g["ingredients"]&.any? }
      has_instructions = attrs[:instructions].is_a?(Array) && attrs[:instructions].any?

      has_ingredients && has_instructions
    end
  end
end
