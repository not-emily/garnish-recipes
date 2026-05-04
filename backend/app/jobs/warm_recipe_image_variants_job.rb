class WarmRecipeImageVariantsJob < ApplicationJob
  queue_as :default

  # Pre-generates the recipe's thumb + detail variants so the first user to
  # hit the variant URL doesn't pay the (R2 download → ImageMagick convert →
  # stream back) round-trip cost — we eat it in a background job instead.
  # After this runs, ProxyController serves cached bytes in <50ms; CF then
  # caches edge-side after the first edge hit.
  #
  # Idempotent: `.processed` is a no-op if the variant_record already exists.
  # Safe to enqueue redundantly. Skips silently if the recipe was deleted
  # between enqueue and perform, or if the attachment was purged.
  def perform(recipe_id)
    recipe = Recipe.find_by(id: recipe_id)
    return unless recipe&.image&.attached?

    %i[thumb detail].each do |variant_name|
      recipe.image.variant(variant_name).processed
    rescue StandardError => e
      Rails.logger.warn(
        "WarmRecipeImageVariantsJob: failed to process #{variant_name} for recipe #{recipe_id}: #{e.message}"
      )
    end
  end
end
