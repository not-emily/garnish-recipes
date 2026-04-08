module RecipeIngestion
  # Coordinates the PDF ingestion path: read the recipe's attached source
  # file, extract text via pdf-reader, and ask the LLM to structure it.
  #
  # Unlike UrlIngester, there's no free fallback path here — PDFs don't
  # carry Schema.org markup. The user must have LLM credentials configured
  # for this to do anything useful.
  #
  # Returns the same result hash shape as UrlIngester:
  #   { status: :complete | :needs_review | :failed, attributes: {...}, error: nil | "..." }
  class PdfIngester
    def self.call(recipe)
      new(recipe).call
    end

    def initialize(recipe)
      @recipe = recipe
      @user = recipe.contributed_by
    end

    def call
      unless @recipe.source_file.attached?
        return { status: :failed, attributes: {}, error: "No source file attached" }
      end

      text = extract_text
      if text.strip.empty?
        # pdf-reader only extracts embedded text — image-based PDFs (e.g.
        # cookbook scans dragged out of Preview) have zero extractable text.
        # Tell the user explicitly so they don't think the LLM call failed.
        return {
          status: :needs_review,
          attributes: { title: filename_title },
          error: "This PDF doesn't contain extractable text — it's likely a scanned image. " \
                 "Vision-based extraction (coming later) will handle these. For now you can " \
                 "fill in the recipe manually or run the PDF through OCR first."
        }
      end

      unless @user.has_llm_credentials?
        # Without LLM credentials we can't structure freeform text. Leave
        # the recipe as a draft with the source attached so the user can
        # fill it in manually (or configure a key and re-import).
        return {
          status: :needs_review,
          attributes: { title: filename_title },
          error: "Configure an LLM API key in Settings to auto-extract recipes from PDFs."
        }
      end

      llm_to_attrs(text)
    rescue PdfParser::ParseError => e
      { status: :failed, attributes: { title: filename_title }, error: e.message }
    end

    private

    def extract_text
      @recipe.source_file.open do |file|
        return PdfParser.extract_text(file.path)
      end
    end

    def llm_to_attrs(text)
      raw = LlmExtractor.call(user: @user, content: text, kind: :pdf)
      attrs = raw.transform_keys(&:to_sym)
      attrs[:title] = filename_title if attrs[:title].blank?

      status = sufficient?(attrs) ? :complete : :needs_review
      { status: status, attributes: attrs, error: nil }
    rescue LlmExtractor::ExtractionError => e
      {
        status: :needs_review,
        attributes: { title: filename_title },
        error: e.message
      }
    end

    def filename_title
      base = File.basename(@recipe.source_file.filename.to_s, ".*")
      base.tr("_-", "  ").squeeze(" ").strip.presence || "Imported PDF"
    end

    def sufficient?(attrs)
      attrs[:title].present? &&
        attrs[:ingredient_groups].is_a?(Array) &&
        attrs[:ingredient_groups].any? { |g| g["ingredients"]&.any? } &&
        attrs[:instructions].is_a?(Array) && attrs[:instructions].any?
    end
  end
end
