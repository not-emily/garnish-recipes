require "sage"
require "json"

module RecipeIngestion
  # Wraps sage-rb so each call uses a fresh per-user Sage::Configuration —
  # this avoids the global-state race that the module-level `Sage.complete`
  # would cause when multiple users hit the ingestion job concurrently.
  #
  # The wrapper is text-only. Image extraction requires sage-rb to grow
  # vision support; until then, image imports get attached but not parsed.
  class LlmExtractor
    class ExtractionError < StandardError; end

    # Trim source content before sending it to the model. We don't need
    # the entire HTML body — most of it is navigation/comments/ads. The
    # extractor should still get plenty of context for typical recipes.
    MAX_CONTENT_BYTES = 100_000

    def self.call(user:, content:, kind: :html)
      new(user: user, content: content, kind: kind).call
    end

    def initialize(user:, content:, kind:)
      @user = user
      @content = content.to_s
      @kind = kind
    end

    def call
      raise ExtractionError, "User has no LLM credentials configured" unless @user.has_llm_credentials?
      raise ExtractionError, "Content is empty" if @content.strip.empty?

      response = sage_client.complete(
        :recipe_extractor,
        prompt: build_prompt,
        system: SYSTEM_PROMPT,
        max_tokens: 4096
      )

      parse_json(response.content)
    rescue Sage::Error => e
      raise ExtractionError, "LLM provider error: #{e.message}"
    end

    private

    SYSTEM_PROMPT = <<~PROMPT.freeze
      You are a recipe extraction assistant. Given the contents of a webpage
      or document that contains a recipe, extract the recipe into a strict
      JSON object. Output ONLY the JSON object — no markdown, no commentary,
      no code fences. Use null for fields you cannot determine.

      Required JSON shape:
      {
        "title": "string",
        "description": "string or null",
        "servings": integer or null,
        "prep_time_minutes": integer or null,
        "cook_time_minutes": integer or null,
        "category": "entree|side|appetizer|soup_stew|salad|breakfast|dessert|snack|beverage|sauce_dressing or null",
        "cuisine": "string or null",
        "ingredient_groups": [
          {
            "label": "string or null",
            "ingredients": [
              { "name": "string", "quantity": "string or null", "unit": "string or null", "preparation": "string or null" }
            ]
          }
        ],
        "instructions": [
          { "text": "string", "timer_minutes": integer or null }
        ]
      }

      Rules:
      - Only include ingredients/instructions that you find in the source.
      - If the source contains multiple ingredient groups (e.g. "for the dough", "for the filling"), preserve them as separate groups with labels.
      - For instructions, split numbered steps into separate entries. If timing is mentioned ("bake for 25 minutes"), set timer_minutes.
      - Use minutes (integers) for times, not strings.
      - For category, choose the closest match from the enum or null if unclear.
      - Return ONLY the JSON. No prose before or after.
    PROMPT

    def build_prompt
      content = @content.byteslice(0, MAX_CONTENT_BYTES).to_s
      <<~PROMPT
        Source kind: #{@kind}

        --- BEGIN SOURCE ---
        #{content}
        --- END SOURCE ---
      PROMPT
    end

    # Build a fresh sage-rb Configuration for this user. Crucially we do
    # NOT touch `Sage.configure` (the module-level singleton) — we build
    # a Client around our own Configuration so concurrent jobs running
    # for different users can't trample each other's credentials.
    def sage_client
      config = Sage::Configuration.new
      config.provider(@user.llm_provider.to_sym, api_key: @user.llm_api_key)
      config.profile(:recipe_extractor,
                     provider: @user.llm_provider.to_sym,
                     model: @user.llm_model)
      Sage::Client.new(config)
    end

    # The model is instructed to return raw JSON, but real-world LLM
    # output sometimes wraps it in markdown fences. Strip those before
    # parsing.
    def parse_json(content)
      stripped = content.to_s.strip
      stripped = stripped.sub(/\A```(?:json)?\s*/, "").sub(/\s*```\z/, "")
      JSON.parse(stripped)
    rescue JSON::ParserError => e
      raise ExtractionError, "Could not parse LLM response as JSON: #{e.message}"
    end
  end
end
