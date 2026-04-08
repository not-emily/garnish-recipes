class RecipeIngestionJob < ApplicationJob
  queue_as :default

  # Don't auto-retry on application errors — failures are surfaced to the user
  # via import_status: :failed so they can decide what to do.
  discard_on StandardError do |job, error|
    recipe = Recipe.find_by(id: job.arguments.first)
    next unless recipe
    recipe.update_columns(
      import_status: Recipe.import_statuses[:failed],
      import_error: "#{error.class}: #{error.message}",
      import_completed_at: Time.current
    )
    Rails.logger.error("RecipeIngestionJob discarded: #{error.class}: #{error.message}")
  end

  def perform(recipe_id)
    recipe = Recipe.find_by(id: recipe_id)
    return unless recipe
    return unless recipe.import_status == "importing"

    case recipe.import_source_type
    when "url"
      ingest(recipe) { RecipeIngestion::UrlIngester.call(recipe.source_url, user: recipe.contributed_by) }
    when "pdf"
      ingest(recipe) { RecipeIngestion::PdfIngester.call(recipe) }
    when "image"
      # TODO: vision support — pending sage-rb image API. Until then,
      # the source image is attached but not auto-parsed.
      mark_failed(recipe, "Image ingestion not yet implemented")
    else
      mark_failed(recipe, "Unknown import_source_type: #{recipe.import_source_type.inspect}")
    end
  end

  private

  # Common ingestion flow: call the per-source-type ingester and apply
  # whatever it returned to the recipe row.
  def ingest(recipe)
    result = yield

    case result[:status]
    when :complete
      apply_attributes(recipe, result[:attributes])
      recipe.import_status = :complete
      recipe.import_completed_at = Time.current
      recipe.save!
    when :needs_review
      apply_attributes(recipe, result[:attributes])
      # Ensure title is present so the validations on save pass — fall back to
      # something derivable if the parser didn't find one.
      recipe.title = recipe.title.presence || derive_fallback_title(recipe.source_url)
      recipe.import_status = :needs_review
      recipe.import_error = result[:error]  # nil for clean partial parses, set for explained ones
      recipe.import_completed_at = Time.current
      recipe.save!
    when :failed
      mark_failed(recipe, result[:error])
    end
  end

  def apply_attributes(recipe, attrs)
    # Only assign keys we know are safe to write — Normalizer is internal but
    # let's be explicit so future fields require an opt-in here.
    permitted = attrs.slice(
      :title, :description, :servings, :prep_time_minutes, :cook_time_minutes,
      :category, :cuisine, :image_url, :ingredient_groups, :instructions, :source_url
    )
    recipe.assign_attributes(permitted)
  end

  def derive_fallback_title(url)
    URI.parse(url.to_s).host.to_s.sub(/^www\./, "").presence&.then { |h| "Recipe from #{h}" } || "Imported recipe"
  rescue URI::InvalidURIError
    "Imported recipe"
  end

  def mark_failed(recipe, message)
    # Always give failed recipes a title so they render in the browse view —
    # otherwise downstream UIs that read .title hit nil and crash.
    fallback_title = recipe.title.presence || derive_fallback_title(recipe.source_url)
    recipe.update_columns(
      title: fallback_title,
      import_status: Recipe.import_statuses[:failed],
      import_error: message,
      import_completed_at: Time.current
    )
  end
end
