Rails.application.config.active_storage.variant_processor = :mini_magick

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
