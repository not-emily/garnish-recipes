require "net/http"
require "uri"

module RecipeIngestion
  # Fetches an HTTP(S) URL and returns the response body. Guards against
  # SSRF (private/loopback addresses) and oversized responses.
  class UrlParser
    class FetchError < StandardError; end

    MAX_BYTES = 5 * 1024 * 1024 # 5 MB
    MAX_REDIRECTS = 5
    # Generous open timeout because Net::HTTP doesn't do "happy eyeballs":
    # if a host has a broken IPv6 record (or the local network has no IPv6
    # route), Ruby will try IPv6 first, time out, then fall back to IPv4 —
    # which can blow a tighter budget on a cold connection.
    OPEN_TIMEOUT = 15
    READ_TIMEOUT = 20
    USER_AGENT = "Mozilla/5.0 (compatible; GarnishRecipeBot/1.0; +https://garnish.app)".freeze

    def self.fetch(url)
      new(url).fetch
    end

    def initialize(url)
      @url = url
    end

    def fetch
      uri = parse_uri(@url)

      # Retry once on timeout (transient — cold IPv6 fallback, anti-bot
      # tarpitting). Other errors are deterministic and not retried.
      attempts = 0
      begin
        attempts += 1
        body = fetch_with_redirects(uri, MAX_REDIRECTS)
      rescue Net::OpenTimeout, Net::ReadTimeout => e
        retry if attempts < 2
        raise FetchError, "Timeout fetching URL: #{e.message}"
      rescue OpenSSL::SSL::SSLError => e
        raise FetchError, "SSL error fetching URL: #{e.message}"
      end

      { url: uri.to_s, html: body }
    end

    private

    def parse_uri(url)
      uri = URI.parse(url.to_s.strip)
      raise FetchError, "URL must be http or https" unless uri.is_a?(URI::HTTP) || uri.is_a?(URI::HTTPS)
      raise FetchError, "URL host is missing" if uri.host.blank?
      guard_against_private_address!(uri.host)
      uri
    rescue URI::InvalidURIError => e
      raise FetchError, "Invalid URL: #{e.message}"
    end

    def guard_against_private_address!(host)
      addrs = Addrinfo.getaddrinfo(host, nil, nil, :STREAM).map(&:ip_address)
      addrs.each do |addr|
        ip = IPAddr.new(addr)
        if ip.loopback? || ip.private? || ip.link_local?
          raise FetchError, "Refusing to fetch from private/internal address"
        end
      end
    rescue SocketError => e
      raise FetchError, "Could not resolve host: #{e.message}"
    end

    def fetch_with_redirects(uri, redirects_left)
      raise FetchError, "Too many redirects" if redirects_left.negative?

      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = uri.scheme == "https"
      http.open_timeout = OPEN_TIMEOUT
      http.read_timeout = READ_TIMEOUT

      request = Net::HTTP::Get.new(uri.request_uri)
      request["User-Agent"] = USER_AGENT
      request["Accept"] = "text/html,application/xhtml+xml"

      response = http.request(request)

      case response
      when Net::HTTPSuccess
        body = response.body.to_s
        raise FetchError, "Response too large" if body.bytesize > MAX_BYTES
        body
      when Net::HTTPRedirection
        location = response["location"]
        raise FetchError, "Redirect without location" if location.blank?
        new_uri = URI.join(uri, location)
        guard_against_private_address!(new_uri.host) if new_uri.host
        fetch_with_redirects(new_uri, redirects_left - 1)
      else
        raise FetchError, "HTTP #{response.code} fetching #{uri}"
      end
    end
  end
end
