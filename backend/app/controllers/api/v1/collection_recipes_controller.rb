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

      # POST /api/v1/collections/:collection_apikey/recipes/:apikey/copy
      # Copies a recipe from a shared collection into the current user's household.
      def copy
        return unless authorize!(@collection, :copy_recipe?)

        source = @collection.recipes.find_by_apikey!(params[:apikey])

        provenance = "From #{@collection.user.name}'s \"#{@collection.name}\" collection"
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
          render json: {
            data: {
              id: copy.apikey,
              title: copy.title
            }
          }, status: :created
        else
          render json: {
            error: { code: "validation_failed", message: copy.errors.full_messages.first }
          }, status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordNotFound
        render json: {
          error: { code: "not_found", message: "Recipe not found in this collection" }
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
