Rails.application.config.active_storage.variant_processor = :mini_magick

# Tell mini_magick where ImageMagick's `convert` lives. Production runs
# under launchd, which inherits a minimal PATH that excludes /usr/local/bin
# (Intel Macs) and /opt/homebrew/bin (Apple Silicon). Without this, every
# variant generation 500s with "executable not found: convert" (status 127).
# On Arch dev machines /usr/bin is always on PATH, so the fallback to
# default PATH lookup kicks in there.
require "mini_magick"
%w[/usr/local/bin /opt/homebrew/bin].each do |dir|
  if File.executable?(File.join(dir, "convert"))
    MiniMagick.cli_path = dir
    break
  end
end

# Set long-lived Cache-Control on ActiveStorage proxy responses so Cloudflare
# caches at the edge after the first hit. Safe to mark `immutable` because
# blob URLs are signed with `signed_id` — the URL changes if the underlying
# blob does.
#
# ActiveStorage's defaults are `max-age=3600, private` for blobs and 5 min for
# variants — short enough that CF wouldn't cache effectively.

Rails.application.config.after_initialize do
  ActiveStorage::Blobs::ProxyController.class_eval do
    after_action only: :show do
      response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    end
  end

  ActiveStorage::Representations::ProxyController.class_eval do
    after_action only: :show do
      response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    end
  end
end
