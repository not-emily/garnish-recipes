require "down"

# Fetches an image from a public URL into a Tempfile, validating size,
# content-type, and scheme. Used by RecipesController when the user pastes
# an image URL into the recipe form's image picker.
#
# Returns a Result struct: on success, has tempfile/filename/content_type.
# On failure, has error (a user-facing string suitable for surfacing in the
# form's validation errors). Caller is responsible for closing the tempfile
# after attaching it (or it'll get GC'd eventually).
class ImageUrlFetcher
  ALLOWED_CONTENT_TYPES = %w[image/jpeg image/png image/webp image/heic image/heif].freeze
  MAX_SIZE = 10.megabytes
  MAX_REDIRECTS = 5
  TIMEOUT_SECONDS = 10

  Result = Struct.new(:tempfile, :filename, :content_type, :error, keyword_init: true)

  # Errors are phrased as predicates ("must be X", "URL is invalid") rather
  # than full sentences. Callers `errors.add(:image, msg)`; Rails'
  # `errors.full_messages` prepends the humanised field name automatically,
  # producing "Image must be X" / "Image URL is invalid". Including "Image"
  # in the message itself would double-prefix.
  def self.fetch(url)
    return Result.new(error: "URL is required") if url.blank?

    begin
      uri = URI.parse(url)
    rescue URI::InvalidURIError
      return Result.new(error: "URL is invalid")
    end

    # Scheme guard: only http(s). Blocks file://, ftp://, and other potential
    # SSRF vectors. (No private-IP block — at our threat model the trusted-
    # household assumption is fine. Revisit if exposing to untrusted users.)
    return Result.new(error: "URL must be http or https") unless %w[http https].include?(uri.scheme)

    begin
      tempfile = Down.download(
        url,
        max_size: MAX_SIZE,
        max_redirects: MAX_REDIRECTS,
        open_timeout: TIMEOUT_SECONDS,
        read_timeout: TIMEOUT_SECONDS
      )
    rescue Down::TooLarge
      return Result.new(error: "must be under 10 MB")
    rescue Down::TimeoutError
      return Result.new(error: "URL timed out")
    rescue Down::NotFound
      return Result.new(error: "URL was not found")
    rescue Down::Error => e
      # Underlying Net::HTTP / SSL errors carry implementation details (host
      # names, addresses, etc.) that are noisy to surface verbatim. Log the
      # specifics for debugging but show the user a friendly message.
      Rails.logger.warn("ImageUrlFetcher failed for #{url}: #{e.message}")
      return Result.new(error: "couldn't be loaded — check the URL and try again")
    end

    content_type = tempfile.content_type
    unless ALLOWED_CONTENT_TYPES.include?(content_type)
      tempfile.close!
      return Result.new(error: "must be JPEG, PNG, WebP, or HEIC")
    end

    Result.new(
      tempfile: tempfile,
      filename: filename_from(uri, content_type),
      content_type: content_type
    )
  end

  def self.filename_from(uri, content_type)
    base = File.basename(uri.path).presence || "image"
    return base if base.include?(".")

    ext = case content_type
          when "image/jpeg" then "jpg"
          when "image/png"  then "png"
          when "image/webp" then "webp"
          when "image/heic" then "heic"
          when "image/heif" then "heif"
          else "img"
          end
    "#{base}.#{ext}"
  end
end
