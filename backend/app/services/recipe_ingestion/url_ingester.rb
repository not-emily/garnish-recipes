module RecipeIngestion
  # Coordinates the URL ingestion path. Tries extractors in order of cost
  # and fidelity, stopping as soon as it has a complete recipe:
  #
  #   1. JSON-LD (free, accurate — most modern recipe sites)
  #   2. Microdata (free, accurate — Smitten Kitchen and many WordPress blogs)
  #   3. LLM extraction via sage-rb (paid, accurate — only if user opted in
  #      with their own API key, and only when 1 & 2 didn't yield a complete
  #      result; covers the long tail of sites with no structured data)
  #   4. Open Graph (free, partial — last resort, gives at least title/image)
  #
  # Returns a result hash:
  #   { status: :complete | :needs_review | :failed, attributes: {...}, error: nil | "..." }
  class UrlIngester
    def self.call(url, user: nil)
      new(url, user: user).call
    end

    def initialize(url, user: nil)
      @url = url
      @user = user
    end

    def call
      result = UrlParser.fetch(@url)
      html = result[:html]
      source_url = result[:url]

      attrs = try_structured_extractors(html, source_url)

      # If structured extractors didn't get us a complete recipe AND the user
      # has opted into LLM extraction, ask the model to fill in the gaps.
      if !sufficient?(attrs) && @user&.has_llm_credentials?
        attrs = try_llm(html, source_url, fallback: attrs) || attrs
      end

      # Final fallback: if we still have nothing useful, scrape Open Graph
      # tags for at least a title/description/image so the user has a head start.
      attrs = try_open_graph(html, source_url) || attrs if attrs[:title].blank?

      status = sufficient?(attrs) ? :complete : :needs_review
      { status: status, attributes: attrs, error: nil }
    rescue UrlParser::FetchError => e
      { status: :failed, attributes: {}, error: e.message }
    end

    private

    def try_structured_extractors(html, source_url)
      raw = JsonLdExtractor.extract(html) || MicrodataExtractor.extract(html)
      return { source_url: source_url } unless raw
      Normalizer.from_schema_org(raw).merge(source_url: source_url)
    end

    # Run LLM extraction. Returns a Garnish-shaped attrs hash on success or
    # nil on failure. Errors are logged but never bubble up — LLM is a best-
    # effort enhancement, never a hard requirement.
    def try_llm(html, source_url, fallback:)
      raw = LlmExtractor.call(user: @user, content: html, kind: :html)
      attrs = raw.transform_keys(&:to_sym).merge(source_url: source_url)

      # If the LLM gave us something complete, prefer it. Otherwise prefer
      # whichever (LLM or structured) result is closer to complete — measured
      # by ingredient + instruction counts.
      sufficient?(attrs) ? attrs : merge_best(fallback, attrs)
    rescue LlmExtractor::ExtractionError => e
      Rails.logger.warn("RecipeIngestion LLM extraction failed: #{e.message}")
      nil
    end

    def try_open_graph(html, source_url)
      raw = OpenGraphExtractor.extract(html)
      return nil unless raw
      Normalizer.from_schema_org(raw).merge(source_url: source_url)
    end

    # Merge two partial attribute hashes, preferring whichever has the field
    # populated. The LLM result wins on ties for ingredients/instructions
    # (since it parses the actual content rather than guessing from markup).
    def merge_best(base, llm)
      merged = base.dup
      llm.each do |key, value|
        next if value.blank?
        merged[key] = value if merged[key].blank?
      end
      # Always prefer the LLM's ingredients/instructions if it has any —
      # the structured extractors might have given us partial data.
      merged[:ingredient_groups] = llm[:ingredient_groups] if llm[:ingredient_groups].present?
      merged[:instructions] = llm[:instructions] if llm[:instructions].present?
      merged
    end

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
