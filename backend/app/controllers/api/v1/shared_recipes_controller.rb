module Api
  module V1
    # Public-and-authenticated endpoints for recipe share links.
    #
    # `show` is fully public — the share_token is the authorization. Skipping
    # `authenticate!` lets signed-out users view a shared recipe when someone
    # sends them the URL (matching Notion/Google Docs "share to web" UX).
    #
    # `copy` requires authentication because the result is a write into the
    # current user's household. An unauthenticated copy would have nowhere
    # to go.
    class SharedRecipesController < ApplicationController
      before_action :authenticate!, only: :copy
      before_action :require_household, only: :copy
      before_action :set_optional_household, only: :show

      # Deliberately NOT including HouseholdScoped at the class level — it
      # enforces "you must have a household" on every action, which is wrong
      # for the public `show` endpoint. Each action picks the variant it
      # needs: `copy` requires a household, `show` optionally sets one so
      # that `can_copy` can be computed for logged-in viewers without
      # blocking anonymous viewers.

      # GET /api/v1/shared_recipes/:token
      # Returns the full recipe as read-only, plus `can_copy` so the frontend
      # knows whether to show "Add to my recipes" or "Sign up to save".
      def show
        recipe = Recipe.find_by(share_token: params[:token])
        return render_not_found unless recipe

        render json: {
          data: serialize_public_recipe(recipe).merge(
            can_copy: current_user.present? && Current.membership.present?
          )
        }
      end

      # POST /api/v1/shared_recipes/:token/copy
      # Copies the shared recipe into the authenticated user's active
      # household, preserving a provenance note so the recipient can trace
      # where it came from.
      def copy
        source = Recipe.find_by(share_token: params[:token])
        return render_not_found unless source

        provenance = "Shared from #{source.household.name}"
        notes = [provenance, source.notes.presence].compact.join("\n\n")

        copy = Current.household.recipes.build(
          contributed_by: current_user,
          recipe_type: source.recipe_type,
          title: source.title,
          description: source.description,
          category: source.category,
          cuisine: source.cuisine,
          tags: source.tags,
          primary_protein: source.primary_protein,
          prep_time_minutes: source.prep_time_minutes,
          cook_time_minutes: source.cook_time_minutes,
          difficulty: source.difficulty,
          servings: source.servings,
          source_url: source.source_url,
          image_url: source.image_url,
          notes: notes,
          ingredient_groups: source.ingredient_groups,
          instructions: source.instructions
        )

        if copy.save
          render json: { data: { id: copy.apikey, title: copy.title } }, status: :created
        else
          render json: {
            error: { code: "validation_failed", message: copy.errors.full_messages.first }
          }, status: :unprocessable_entity
        end
      end

      private

      def require_household
        Current.household = current_user&.active_household
        Current.membership = current_user&.membership_for(Current.household)
        unless Current.household
          render json: {
            error: { code: "no_household", message: "You must create or join a household first" }
          }, status: :precondition_required
        end
      end

      def set_optional_household
        return unless current_user
        Current.household = current_user.active_household
        Current.membership = current_user.membership_for(Current.household) if Current.household
      end

      def render_not_found
        render json: {
          error: { code: "not_found", message: "This share link is no longer valid." }
        }, status: :not_found
      end

      # Deliberately excludes share_token, my_rating, and anything household-
      # scoped — the viewer may not even be logged in, and the token is
      # already in their URL.
      def serialize_public_recipe(recipe)
        {
          id: recipe.apikey,
          recipe_type: recipe.recipe_type,
          title: recipe.title,
          description: recipe.description,
          category: recipe.category,
          cuisine: recipe.cuisine,
          tags: recipe.tags,
          primary_protein: recipe.primary_protein,
          prep_time_minutes: recipe.prep_time_minutes,
          cook_time_minutes: recipe.cook_time_minutes,
          total_time_minutes: recipe.total_time_minutes,
          difficulty: recipe.difficulty,
          servings: recipe.servings,
          image_url: recipe.image_url,
          source_url: recipe.source_url,
          notes: recipe.notes,
          ingredient_groups: recipe.ingredient_groups,
          instructions: recipe.instructions,
          shared_by_household: recipe.household.name
        }
      end
    end
  end
end
