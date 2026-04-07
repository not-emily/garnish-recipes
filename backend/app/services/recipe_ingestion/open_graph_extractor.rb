require "nokogiri"

module RecipeIngestion
  # Last-resort fallback: pull whatever we can from <meta property="og:*">
  # tags so the user gets a partial recipe to start from instead of a blank
  # sheet. Returns a Schema.org-shaped hash that the Normalizer can process,
  # or nil if no useful tags are found.
  #
  # Open Graph gives us at most title/description/image — never ingredients
  # or instructions — so anything from this path lands in `needs_review`.
  class OpenGraphExtractor
    def self.extract(html)
      new(html).extract
    end

    def initialize(html)
      @html = html
    end

    def extract
      doc = Nokogiri::HTML(@html)

      title = meta(doc, "og:title") || meta(doc, "twitter:title") || doc.at_css("title")&.text&.strip
      description = meta(doc, "og:description") || meta(doc, "twitter:description") || meta_name(doc, "description")
      image = meta(doc, "og:image") || meta(doc, "twitter:image")

      return nil if title.blank? && description.blank? && image.blank?

      {
        "@type" => "Recipe",
        "name" => title,
        "description" => description,
        "image" => image
      }.compact
    end

    private

    def meta(doc, property)
      doc.at_css("meta[property=\"#{property}\"]")&.[]("content").presence
    end

    def meta_name(doc, name)
      doc.at_css("meta[name=\"#{name}\"]")&.[]("content").presence
    end
  end
end
