module Api
  module V1
    class ImportsController < ApplicationController
      before_action :authenticate!
      include HouseholdScoped

      # POST /api/v1/imports
      #
      # Body: { url: "https://example.com/some-recipe" }
      #
      # Creates a draft Recipe with import_status=:importing, enqueues the
      # ingestion job, and returns the recipe immediately so the client can
      # navigate to its detail page and poll for completion.
      def create
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
