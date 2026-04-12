module Api
  module V1
    class RatingsController < ApplicationController
      before_action :authenticate!
      include HouseholdScoped

      before_action :load_recipe

      # GET /api/v1/recipes/:apikey/ratings
      def index
        ratings = @recipe.recipe_ratings.includes(:user)
        my_rating = ratings.find { |r| r.user_id == current_user.id }

        render json: {
          data: {
            average_rating: @recipe.average_rating&.to_f,
            rating_count: @recipe.rating_count,
            my_rating: my_rating&.score,
            ratings: ratings.map { |r|
              {
                user: { id: r.user.apikey, name: r.user.name },
                score: r.score
              }
            }
          }
        }
      end

      # POST /api/v1/recipes/:apikey/ratings
      def upsert
        score = params.dig(:rating, :score) || params[:score]

        rating = @recipe.recipe_ratings.find_or_initialize_by(user: current_user)
        rating.score = score

        if rating.save
          render json: {
            data: {
              score: rating.score,
              average_rating: @recipe.reload.average_rating&.to_f,
              rating_count: @recipe.rating_count
            }
          }, status: rating.previously_new_record? ? :created : :ok
        else
          render json: {
            error: {
              code: "validation_failed",
              message: rating.errors.full_messages.first
            }
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/recipes/:apikey/ratings
      def destroy
        rating = @recipe.recipe_ratings.find_by(user: current_user)
        unless rating
          return render json: {
            error: { code: "not_found", message: "You haven't rated this recipe" }
          }, status: :not_found
        end

        rating.destroy!
        render json: {
          data: {
            average_rating: @recipe.reload.average_rating&.to_f,
            rating_count: @recipe.rating_count
          }
        }
      end

      private

      def load_recipe
        @recipe = Current.household.recipes.find_by_apikey!(params[:apikey])
      rescue ActiveRecord::RecordNotFound
        render json: {
          error: { code: "not_found", message: "Recipe not found" }
        }, status: :not_found
      end
    end
  end
end
