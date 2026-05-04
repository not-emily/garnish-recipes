Rails.application.config.active_storage.variant_processor = :mini_magick

# Make sure ImageMagick's `convert` is on PATH for the Rails process.
# Production runs Puma under launchd, whose inherited PATH doesn't include
# /usr/local/bin (Intel Macs) or /opt/homebrew/bin (Apple Silicon), so
# mini_magick's PATH-lookup fails with status 127 and every variant URL
# 500s. mini_magick 5.x has no cli_path setter, so we prepend the
# directory to the process's PATH directly. On Arch dev machines /usr/bin
# is always present and we skip the prepend.
%w[/usr/local/bin /opt/homebrew/bin].each do |dir|
  next unless File.executable?(File.join(dir, "convert"))
  ENV["PATH"] = "#{dir}:#{ENV['PATH']}" unless ENV["PATH"].to_s.split(":").include?(dir)
  break
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
