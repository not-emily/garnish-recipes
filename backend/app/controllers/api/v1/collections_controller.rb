module Api
  module V1
    class CollectionsController < ApplicationController
      before_action :authenticate!
      include HouseholdScoped

      before_action :load_collection, only: [:show, :update, :destroy]

      # GET /api/v1/collections
      def index
        scope = policy_scope(RecipeCollection)
        scope = scope.search(params[:q]) if params[:q].present?
        scope = scope.order(updated_at: :desc)

        render json: {
          data: scope.map { |c| serialize_collection(c) },
          meta: { total: scope.size }
        }
      end

      # GET /api/v1/collections/:apikey
      def show
        return unless authorize!(@collection)

        render json: {
          data: serialize_collection(@collection, full: true)
        }
      end

      # POST /api/v1/collections
      def create
        collection = Current.household.recipe_collections.build(collection_params)
        collection.user = current_user

        return unless authorize!(collection)

        if collection.save
          render json: { data: serialize_collection(collection) }, status: :created
        else
          render_validation_errors(collection)
        end
      end

      # PATCH /api/v1/collections/:apikey
      def update
        return unless authorize!(@collection)

        if @collection.update(collection_params)
          render json: { data: serialize_collection(@collection) }
        else
          render_validation_errors(@collection)
        end
      end

      # DELETE /api/v1/collections/:apikey
      def destroy
        return unless authorize!(@collection)
        @collection.destroy!
        head :no_content
      end

      private

      def load_collection
        @collection = RecipeCollection.find_by_apikey!(params[:apikey])
      rescue ActiveRecord::RecordNotFound
        render json: {
          error: { code: "not_found", message: "Collection not found" }
        }, status: :not_found
      end

      def collection_params
        params.require(:collection).permit(:name, :description, :visibility)
      end

      def serialize_collection(collection, full: false)
        base = {
          id: collection.apikey,
          name: collection.name,
          description: collection.description,
          visibility: collection.visibility,
          recipe_count: collection.collection_recipes.size,
          is_mine: collection.user_id == current_user.id,
          owner: {
            id: collection.user.apikey,
            name: collection.user.name
          },
          created_at: collection.created_at,
          updated_at: collection.updated_at
        }
        return base unless full

        recipes = collection.recipes
                    .where.not(recipe_type: "event")
                    .order("collection_recipes.created_at ASC")
                    .includes(:contributed_by)

        base.merge(
          recipes: recipes.map { |r| serialize_recipe_summary(r) }
        )
      end

      def serialize_recipe_summary(recipe)
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
          times_cooked: recipe.times_cooked,
          last_cooked_at: recipe.last_cooked_at,
          updated_at: recipe.updated_at
        }
      end

      def render_validation_errors(collection)
        render json: {
          error: {
            code: "validation_failed",
            message: collection.errors.full_messages.first,
            details: collection.errors.messages
          }
        }, status: :unprocessable_entity
      end
    end
  end
end
