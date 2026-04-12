module Api
  module V1
    class RecipesController < ApplicationController
      before_action :authenticate!
      include HouseholdScoped

      before_action :load_recipe, only: [:show, :update, :destroy, :collections]

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
        # Events aren't "recipes" in the library sense — they're meal plan
        # annotations ("dinner at mom's") stored in the recipes table for
        # reuse. Hide them from the default browse view. Callers that need
        # them (the meal plan event picker) pass recipe_type=event explicitly.
        scope = scope.where.not(recipe_type: "event") unless params[:recipe_type] == "event"
        scope = filter_scope(scope)
        scope = sort_scope(scope)

        # Optional row cap — used by the meal plan event picker so a
        # household with hundreds of past events doesn't dump them all
        # into the bottom sheet. Clamp to a sane ceiling so a pathological
        # client can't request a million rows.
        total = scope.size
        if params[:limit].present?
          limit = params[:limit].to_i.clamp(1, 200)
          scope = scope.limit(limit)
        end

        # Always allow index — policy_scope already filters out non-members
        render json: {
          data: scope.map { |r| serialize_recipe(r) },
          meta: { total: total }
        }
      end

      # GET /api/v1/recipes/:apikey
      def show
        # If loaded through a shared collection, access was already verified
        # in load_recipe — skip the household-scoped policy check.
        unless @loaded_via_collection
          return unless authorize!(@recipe)
        end
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

      # GET /api/v1/recipes/:apikey/collections
      # Returns which of the current user's collections contain this recipe.
      def collections
        return unless authorize!(@recipe, :show?)

        user_collections = current_user.recipe_collections
                                       .where(household: Current.household)
                                       .order(:name)
        member_ids = user_collections
                       .joins(:collection_recipes)
                       .where(collection_recipes: { recipe_id: @recipe.id })
                       .pluck(:id)
                       .to_set

        render json: {
          data: user_collections.map { |c|
            {
              id: c.apikey,
              name: c.name,
              has_recipe: member_ids.include?(c.id)
            }
          }
        }
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
        # If a collection param is provided, try loading the recipe through a
        # shared collection. This allows shared collection recipients to view
        # recipes that belong to another household.
        if params[:collection].present?
          collection = RecipeCollection.find_by(apikey: params[:collection])
          if collection
            policy = CollectionPolicy.new(Current.membership, collection)
            if policy.show?[:allowed]
              @recipe = collection.recipes.find_by_apikey!(params[:apikey])
              @loaded_via_collection = true
              return
            end
          end
        end

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
