module Api
  module V1
    class ImportsController < ApplicationController
      before_action :authenticate!
      include HouseholdScoped

      # POST /api/v1/imports
      #
      # Accepts either:
      #   { url: "https://example.com/some-recipe" }    (JSON, source_type: url)
      #   multipart/form-data with `file` field         (PDF/image upload)
      #
      # Creates a draft Recipe with import_status=:importing, enqueues the
      # ingestion job, and returns the recipe immediately so the client can
      # navigate to its detail page and poll for completion.
      def create
        if params[:file].present?
          create_file_import
        else
          create_url_import
        end
      end

      # GET /api/v1/imports/:apikey
      #
      # Status endpoint for the frontend to poll while the job runs.
      def show
        recipe = Current.household.recipes.find_by_apikey!(params[:apikey])
        return unless authorize!(recipe, :show?)
        render json: { data: serialize_import(recipe) }
      rescue ActiveRecord::RecordNotFound
        render_error("not_found", "Import not found", :not_found)
      end

      private

      def create_url_import
        url = params[:url].to_s.strip
        if url.blank?
          return render_error("validation_failed", "url is required", :unprocessable_entity)
        end

        recipe = build_draft_recipe(source_url: url, source_type: "url")
        return unless authorize!(recipe, :create?)

        if recipe.save
          RecipeIngestionJob.perform_later(recipe.id)
          render json: { data: serialize_import(recipe) }, status: :accepted
        else
          render_validation_errors(recipe)
        end
      end

      def create_file_import
        file = params[:file]
        source_type = detect_source_type(file)

        unless source_type
          return render_error("validation_failed",
                              "Unsupported file type — must be PDF or image",
                              :unprocessable_entity)
        end

        # Peek at the first page to decide how to route this PDF. Cookbooks
        # are built uniformly — if page 1 has no text layer, the whole
        # document is image-based, and our text-extraction path can't help.
        # We still attach the file (vision support will re-process it later)
        # but skip the job and land directly in needs_review so the user
        # gets instant feedback instead of a confusing post-job banner.
        text_layer_missing = source_type == "pdf" && pdf_has_no_text?(file)

        recipe = build_draft_recipe(source_url: nil, source_type: source_type)
        return unless authorize!(recipe, :create?)

        recipe.source_file.attach(file)

        if text_layer_missing
          recipe.title = derive_filename_title(file)
          recipe.import_status = :needs_review
          recipe.import_error =
            "This PDF doesn't contain selectable text — it's likely a scanned " \
            "image. Vision-based extraction is coming soon, and the file is saved " \
            "so it will auto-process once that ships. For now you can fill in the " \
            "recipe manually."
          recipe.import_completed_at = Time.current
        end

        if recipe.save
          RecipeIngestionJob.perform_later(recipe.id) unless text_layer_missing
          render json: { data: serialize_import(recipe) }, status: :accepted
        else
          render_validation_errors(recipe)
        end
      end

      # Returns true when the uploaded PDF's first page has no extractable
      # text. We only inspect page 1 — that's enough to tell whether the
      # document was built with a text layer or as a scan. Worst case is
      # ~100-500ms on a cold pdf-reader load, which is fine for an upload.
      #
      # Any parsing exception is treated as "unknown — let the job try" so
      # we don't block uploads on edge cases (encrypted PDFs, unusual
      # encodings) that pdf-reader balks at but the downstream path can
      # still make progress on.
      def pdf_has_no_text?(uploaded_file)
        path = uploaded_file.respond_to?(:tempfile) ? uploaded_file.tempfile.path : nil
        return false unless path && File.exist?(path)

        require "pdf-reader"
        reader = PDF::Reader.new(path)
        first_page = reader.pages.first
        return true if first_page.nil?
        first_page.text.to_s.strip.empty?
      rescue StandardError => e
        Rails.logger.warn("PDF first-page peek failed: #{e.class}: #{e.message}")
        false
      end

      def derive_filename_title(uploaded_file)
        raw = uploaded_file.respond_to?(:original_filename) ? uploaded_file.original_filename : nil
        base = File.basename(raw.to_s, ".*")
        base.tr("_-", "  ").squeeze(" ").strip.presence || "Imported PDF"
      end

      def detect_source_type(uploaded_file)
        content_type = uploaded_file.respond_to?(:content_type) ? uploaded_file.content_type : nil
        return "pdf" if content_type == "application/pdf"
        return "image" if content_type.to_s.start_with?("image/")
        nil
      end

      def build_draft_recipe(source_url:, source_type:)
        Current.household.recipes.build(
          contributed_by: current_user,
          recipe_type: "full",
          source_url: source_url,
          import_source_type: source_type,
          import_status: :importing
        )
      end

      def serialize_import(recipe)
        {
          id: recipe.apikey,
          import_status: recipe.import_status,
          import_source_type: recipe.import_source_type,
          import_error: recipe.import_error,
          import_completed_at: recipe.import_completed_at,
          source_url: recipe.source_url,
          title: recipe.title
        }
      end

      def render_validation_errors(recipe)
        render json: {
          error: {
            code: "validation_failed",
            message: recipe.errors.full_messages.first,
            details: recipe.errors.messages
          }
        }, status: :unprocessable_entity
      end

      def render_error(code, message, status)
        render json: { error: { code: code, message: message } }, status: status
      end
    end
  end
end
