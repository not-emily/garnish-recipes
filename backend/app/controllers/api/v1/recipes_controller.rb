module Api
  module V1
    class RecipesController < ApplicationController
      before_action :authenticate!
      include HouseholdScoped

      before_action :load_recipe, only: [:show, :update, :destroy]

      # GET /api/v1/recipes
      def index
        scope = policy_scope(Recipe)
        # Hide in-flight imports from the browse view — they have no title yet.
        # Use IS DISTINCT FROM so manually-created recipes (import_status NULL)
        # are still included; plain `where.not` would drop NULL rows.
        scope = scope.where(
          "import_status IS DISTINCT FROM ?",
          Recipe.import_statuses[:importing]
        )
        scope = filter_scope(scope)
        scope = sort_scope(scope)

        # Always allow index — policy_scope already filters out non-members
        render json: {
          data: scope.map { |r| serialize_recipe(r) },
          meta: { total: scope.size }
        }
      end

      # GET /api/v1/recipes/:apikey
      def show
        return unless authorize!(@recipe)
        render json: { data: serialize_recipe(@recipe, full: true) }
      end

      # POST /api/v1/recipes
      def create
        recipe = Current.household.recipes.build(recipe_params)
        recipe.contributed_by = current_user

        return unless authorize!(recipe)

        if recipe.save
          render json: { data: serialize_recipe(recipe, full: true) }, status: :created
        else
          render_validation_errors(recipe)
        end
      end

      # PATCH /api/v1/recipes/:apikey
      def update
        return unless authorize!(@recipe)

        if @recipe.update(recipe_params)
          render json: { data: serialize_recipe(@recipe, full: true) }
        else
          render_validation_errors(@recipe)
        end
      end

      # DELETE /api/v1/recipes/:apikey
      def destroy
        return unless authorize!(@recipe)
        @recipe.destroy!
        head :no_content
      end

      private

      def load_recipe
        @recipe = Current.household.recipes.find_by_apikey!(params[:apikey])
      rescue ActiveRecord::RecordNotFound
        render json: {
          error: { code: "not_found", message: "Recipe not found" }
        }, status: :not_found
      end

      def recipe_params
        permitted = params.require(:recipe).permit(
          :recipe_type, :title, :description, :category, :cuisine,
          :primary_protein, :prep_time_minutes, :cook_time_minutes,
          :difficulty, :servings, :source_url, :notes, :image_url,
          tags: [],
          ingredient_groups: [
            :label,
            { ingredients: [:name, :quantity, :unit, :preparation, :optional] }
          ],
          instructions: [:step, :text, :timer_minutes]
        )
        # Convert structured params to plain hashes for JSONB storage
        if permitted[:ingredient_groups].is_a?(Array)
          permitted[:ingredient_groups] = permitted[:ingredient_groups].map(&:to_h)
        end
        if permitted[:instructions].is_a?(Array)
          permitted[:instructions] = permitted[:instructions].map(&:to_h)
        end
        permitted
      end

      def filter_scope(scope)
        scope = scope.search(params[:q]) if params[:q].present?
        scope = scope.by_type(params[:recipe_type]) if params[:recipe_type].present?
        scope = scope.by_category(params[:category]) if params[:category].present?
        scope = scope.by_cuisine(params[:cuisine]) if params[:cuisine].present?
        scope = scope.by_protein(params[:protein]) if params[:protein].present?
        scope = scope.by_difficulty(params[:difficulty]) if params[:difficulty].present?
        scope = scope.with_tags(params[:tags]) if params[:tags].present?
        scope = scope.max_total_time(params[:max_time]) if params[:max_time].present?
        scope
      end

      def sort_scope(scope)
        case params[:sort]
        when "title"
          scope.order(title: :asc)
        when "recently_cooked"
          scope.order(last_cooked_at: :desc, updated_at: :desc)
        when "prep_time"
          scope.order(Arel.sql("total_time_minutes ASC NULLS LAST"))
        else
          scope.order(updated_at: :desc)
        end
      end

      def serialize_recipe(recipe, full: false)
        base = {
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
          times_cooked: recipe.times_cooked,
          last_cooked_at: recipe.last_cooked_at,
          updated_at: recipe.updated_at
        }
        return base unless full

        base.merge(
          source_url: recipe.source_url,
          notes: recipe.notes,
          ingredient_groups: recipe.ingredient_groups,
          instructions: recipe.instructions,
          import_status: recipe.import_status,
          import_source_type: recipe.import_source_type,
          import_error: recipe.import_error,
          contributed_by: {
            id: recipe.contributed_by.apikey,
            name: recipe.contributed_by.name
          }
        )
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
    end
  end
end
