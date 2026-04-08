require "pdf-reader"

module RecipeIngestion
  # Extracts plain text from a PDF file (path or IO). Returns the
  # concatenated text from every page, separated by form feeds. Raises
  # ParseError on a malformed PDF.
  class PdfParser
    class ParseError < StandardError; end

    # Cap on the total characters returned. PDFs of cookbooks can be
    # enormous; we only want enough text for the LLM to extract one recipe,
    # not gigabytes of OCR-grade output. The LlmExtractor truncates further
    # before sending to the model, but capping early limits memory use.
    MAX_CHARS = 200_000

    def self.extract_text(io_or_path)
      new(io_or_path).extract_text
    end

    def initialize(io_or_path)
      @source = io_or_path
    end

    def extract_text
      reader = PDF::Reader.new(@source)
      pages = reader.pages.map { |p| p.text.to_s }
      pages.join("\n\f\n").byteslice(0, MAX_CHARS).to_s
    rescue PDF::Reader::MalformedPDFError, PDF::Reader::UnsupportedFeatureError => e
      raise ParseError, "Could not read PDF: #{e.message}"
    end
  end
end
