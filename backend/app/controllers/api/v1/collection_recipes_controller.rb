module Api
  module V1
    class CollectionRecipesController < ApplicationController
      before_action :authenticate!
      include HouseholdScoped

      before_action :load_collection

      # POST /api/v1/collections/:collection_apikey/recipes
      def create
        return unless authorize!(@collection, :add_recipe?)

        recipe = Current.household.recipes.find_by_apikey!(params[:recipe_apikey])
        collection_recipe = @collection.collection_recipes.build(recipe: recipe)

        if collection_recipe.save
          render json: { data: { collection_id: @collection.apikey, recipe_id: recipe.apikey } }, status: :created
        else
          render json: {
            error: {
              code: "validation_failed",
              message: collection_recipe.errors.full_messages.first
            }
          }, status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordNotFound
        render json: {
          error: { code: "not_found", message: "Recipe not found" }
        }, status: :not_found
      end

      # DELETE /api/v1/collections/:collection_apikey/recipes/:apikey
      def destroy
        return unless authorize!(@collection, :remove_recipe?)

        recipe = @collection.recipes.find_by_apikey!(params[:apikey])
        @collection.collection_recipes.find_by!(recipe: recipe).destroy!

        head :no_content
      rescue ActiveRecord::RecordNotFound
        render json: {
          error: { code: "not_found", message: "Recipe not in this collection" }
        }, status: :not_found
      end

      private

      def load_collection
        @collection = RecipeCollection.find_by_apikey!(params[:collection_apikey])
      rescue ActiveRecord::RecordNotFound
        render json: {
          error: { code: "not_found", message: "Collection not found" }
        }, status: :not_found
      end
    end
  end
end
