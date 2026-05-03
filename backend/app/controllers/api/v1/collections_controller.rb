module Api
  module V1
    class CollectionsController < ApplicationController
      before_action :authenticate!
      include HouseholdScoped

      before_action :load_collection, only: [:show, :update, :destroy, :shares, :create_share, :destroy_share, :leave, :export]

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

      # --- Sharing ---

      # GET /api/v1/collections/:apikey/shares
      def shares
        return unless authorize!(@collection, :share?)

        shares = @collection.collection_shares.includes(:shared_with)
        render json: {
          data: shares.map { |s|
            {
              id: s.id,
              user: { id: s.shared_with.apikey, name: s.shared_with.name, email: s.shared_with.email },
              permission: s.permission,
              created_at: s.created_at
            }
          }
        }
      end

      # POST /api/v1/collections/:apikey/shares
      def create_share
        return unless authorize!(@collection, :share?)

        email = params[:email].to_s.strip.downcase
        target_user = User.find_by(email: email)

        unless target_user
          return render json: {
            error: { code: "not_found", message: "No user found with that email" }
          }, status: :not_found
        end

        if target_user.id == current_user.id
          return render json: {
            error: { code: "validation_failed", message: "You can't share a collection with yourself" }
          }, status: :unprocessable_entity
        end

        share = @collection.collection_shares.build(shared_with: target_user)

        if share.save
          render json: {
            data: {
              id: share.id,
              user: { id: target_user.apikey, name: target_user.name, email: target_user.email },
              permission: share.permission,
              created_at: share.created_at
            }
          }, status: :created
        else
          render json: {
            error: { code: "validation_failed", message: share.errors.full_messages.first }
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/collections/:apikey/shares/:id
      def destroy_share
        share = @collection.collection_shares.find_by(id: params[:share_id])
        unless share
          return render json: {
            error: { code: "not_found", message: "Share not found" }
          }, status: :not_found
        end

        # Owner can revoke any share; shared user can remove themselves
        unless @collection.owned_by?(current_user) || share.shared_with_id == current_user.id
          return render json: {
            error: { code: "forbidden", message: "Not authorized" }
          }, status: :forbidden
        end

        share.destroy!
        head :no_content
      end

      # DELETE /api/v1/collections/:apikey/leave
      # Shared recipient removes themselves from a shared collection.
      def leave
        share = @collection.collection_shares.find_by(shared_with: current_user)
        unless share
          return render json: {
            error: { code: "not_found", message: "You are not a shared member of this collection" }
          }, status: :not_found
        end

        share.destroy!
        head :no_content
      end

      # --- Export ---

      # GET /api/v1/collections/:apikey/export
      def export
        return unless authorize!(@collection, :export?)

        recipes = @collection.recipes.includes(:contributed_by)
        json = JSON.pretty_generate(recipes.map { |r| serialize_recipe_export(r) })

        send_data json,
                  type: "application/json",
                  disposition: "attachment",
                  filename: "#{@collection.name.parameterize}-recipes.json"
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
        is_shared = !collection.owned_by?(current_user) &&
                    collection.household_id != Current.household&.id

        base = {
          id: collection.apikey,
          name: collection.name,
          description: collection.description,
          visibility: collection.visibility,
          recipe_count: collection.collection_recipes.size,
          is_mine: collection.user_id == current_user.id,
          is_shared: is_shared,
          share_count: collection.owned_by?(current_user) ? collection.collection_shares.size : nil,
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
          recipes: recipes.map { |r| serialize_recipe(r) }
        )
      end

      def serialize_recipe_export(recipe)
        {
          title: recipe.title,
          recipe_type: recipe.recipe_type,
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
          source_url: recipe.source_url,
          image_url: recipe.image_url,
          notes: recipe.notes,
          ingredient_groups: recipe.ingredient_groups,
          instructions: recipe.instructions,
          contributed_by: recipe.contributed_by.name
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
