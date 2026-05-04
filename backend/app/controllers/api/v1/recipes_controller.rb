module Api
  module V1
    class RecipesController < ApplicationController
      before_action :authenticate!
      include HouseholdScoped

      before_action :load_recipe, only: [:show, :update, :destroy, :collections, :share, :unshare]

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

      # GET /api/v1/recipes/smart_sections
      def smart_sections
        base = policy_scope(Recipe)
                 .where("import_status IS DISTINCT FROM ?", Recipe.import_statuses[:importing])
                 .where.not(recipe_type: "event")
        limit = 10

        render json: {
          data: {
            recently_used: base.where("last_cooked_at > ?", 30.days.ago)
                               .order(last_cooked_at: :desc)
                               .limit(limit)
                               .map { |r| serialize_recipe(r) },
            favorites: base.where("rating_count > 0")
                           .order(average_rating: :desc)
                           .limit(limit)
                           .map { |r| serialize_recipe(r) },
            havent_made_in_a_while: base.where(last_cooked_at: 180.days.ago..30.days.ago)
                                       .order(last_cooked_at: :asc)
                                       .limit(limit)
                                       .map { |r| serialize_recipe(r) },
            never_tried: base.where(times_cooked: 0)
                             .order(created_at: :desc)
                             .limit(limit)
                             .map { |r| serialize_recipe(r) },
            quick_meals: base.where(recipe_type: "quick_meal")
                             .order(updated_at: :desc)
                             .limit(limit)
                             .map { |r| serialize_recipe(r) }
          }
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
        attrs, _remove_image, fetch_error = extract_recipe_params

        recipe = Current.household.recipes.build(attrs.except(:image))
        recipe.contributed_by = current_user

        return unless authorize!(recipe)

        if fetch_error
          recipe.errors.add(:image, fetch_error)
          return render_validation_errors(recipe)
        end

        recipe.image = attrs[:image] if attrs.key?(:image)

        if recipe.save
          warm_image_variants(recipe) if attrs.key?(:image)
          render json: { data: serialize_recipe(recipe, full: true) }, status: :created
        else
          render_validation_errors(recipe)
        end
      end

      # PATCH /api/v1/recipes/:apikey
      def update
        return unless authorize!(@recipe)

        attrs, remove_image, fetch_error = extract_recipe_params

        if fetch_error
          @recipe.errors.add(:image, fetch_error)
          return render_validation_errors(@recipe)
        end

        if @recipe.update(attrs)
          # Honour `remove_image: true` only when no new image was also passed —
          # if the user picked a replacement, that wins and we shouldn't purge.
          if remove_image && !attrs.key?(:image) && @recipe.image.attached?
            @recipe.image.purge
          end
          warm_image_variants(@recipe) if attrs.key?(:image)
          render json: { data: serialize_recipe(@recipe.reload, full: true) }
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

      # POST /api/v1/recipes/:apikey/share
      # Idempotent: returns the existing token if already shared, generates
      # a new one if not. Response is the token plus a frontend-facing URL
      # so the share dialog can copy-to-clipboard without reconstructing it.
      def share
        return unless authorize!(@recipe, :share?)
        @recipe.generate_share_token!
        render json: { data: share_payload(@recipe) }
      end

      # DELETE /api/v1/recipes/:apikey/share
      # Nulls the token; any existing shared URLs immediately 404. The next
      # call to `share` generates a fresh token — old and new are unlinked.
      def unshare
        return unless authorize!(@recipe, :revoke_share?)
        @recipe.revoke_share_token!
        head :no_content
      end

      private

      def share_payload(recipe)
        {
          share_token: recipe.share_token,
          share_url: "#{ENV.fetch('FRONTEND_URL')}/r/shared/#{recipe.share_token}"
        }
      end

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

      # Nullable string/enum fields that should be stored as nil — not as
      # empty string — when the user clears them. JSON callers send `null`
      # natively; FormData callers send `""` (no native null in multipart).
      # Normalising here keeps both paths equivalent.
      NILIFY_BLANK = %i[description category cuisine primary_protein difficulty source_url image_url notes].freeze

      # Array-of-object fields that the FormData path delivers as a single
      # JSON-encoded string. Rack's nested-params parser treats
      # `foo[0][bar]=baz` as a hash (`{"0" => {...}}`), not an array element,
      # so the frontend ships these as JSON strings instead and we decode
      # before strong params runs.
      JSON_ARRAY_FIELDS = %i[ingredient_groups instructions].freeze

      def recipe_params
        decode_json_array_fields(params[:recipe]) if params[:recipe].present?

        permitted = params.require(:recipe).permit(
          :recipe_type, :title, :description, :category, :cuisine,
          :primary_protein, :prep_time_minutes, :cook_time_minutes,
          :difficulty, :servings, :source_url, :notes, :image_url,
          :image, :remove_image, :image_url_to_fetch,
          tags: [],
          ingredient_groups: [
            :label,
            { ingredients: [:name, :quantity, :unit, :preparation, :optional] }
          ],
          instructions: [:step, :text, :timer_minutes]
        )
        # FormData can't represent an empty array directly — clients send
        # `recipe[tags][]=""` as the empty-array marker. Strip blanks so we
        # store [] rather than [""].
        if permitted[:tags].is_a?(Array)
          permitted[:tags] = permitted[:tags].compact_blank
        end
        NILIFY_BLANK.each do |k|
          permitted[k] = nil if permitted.key?(k) && permitted[k].is_a?(String) && permitted[k].blank?
        end
        # Convert structured params to plain hashes for JSONB storage
        if permitted[:ingredient_groups].is_a?(Array)
          permitted[:ingredient_groups] = permitted[:ingredient_groups].map(&:to_h)
        end
        if permitted[:instructions].is_a?(Array)
          permitted[:instructions] = permitted[:instructions].map(&:to_h)
        end
        permitted
      end

      # When the FormData path is used, array-of-object fields arrive as JSON
      # strings (see frontend `appendNested` for the why). Decode them in
      # place on the params hash before strong-params runs. JSON-only callers
      # send these as native arrays/hashes and pass through untouched.
      def decode_json_array_fields(recipe_params_input)
        JSON_ARRAY_FIELDS.each do |key|
          val = recipe_params_input[key]
          next unless val.is_a?(String)
          begin
            parsed = JSON.parse(val)
          rescue JSON::ParserError
            next # Leave it; strong params or model validation will surface the issue.
          end
          recipe_params_input[key] = parsed
        end
      end

      # Pre-warms the recipe's thumb + detail variants in the background so
      # the first user to hit the variant URL doesn't pay the (R2 download
      # → ImageMagick convert → stream) cost. Called after a successful
      # save where an image was attached. Safe to enqueue redundantly —
      # `.processed` is idempotent.
      def warm_image_variants(recipe)
        WarmRecipeImageVariantsJob.perform_later(recipe.id)
      end

      # Splits controller-level intents off from the standard recipe attributes:
      #   - `remove_image: true` — purge the existing attachment
      #   - `image_url_to_fetch: "https://..."` — server fetches the URL,
      #     attaches the resulting bytes (treated as if the user had uploaded a
      #     file). Multipart `image:` upload wins if both are present.
      #
      # Returns [attrs, remove_image, fetch_error]. fetch_error is a user-facing
      # string when the URL fetch failed; caller should surface it via
      # render_validation_errors without saving anything.
      def extract_recipe_params
        perm = recipe_params

        flag = perm.delete(:remove_image)
        remove_image = [ true, "true", "1", 1 ].include?(flag)

        fetch_url = perm.delete(:image_url_to_fetch)
        fetch_error = nil

        if fetch_url.present? && !perm.key?(:image)
          result = ImageUrlFetcher.fetch(fetch_url)
          if result.error
            fetch_error = result.error
          else
            perm[:image] = ActionDispatch::Http::UploadedFile.new(
              tempfile: result.tempfile,
              filename: result.filename,
              type: result.content_type
            )
          end
        end

        [ perm, remove_image, fetch_error ]
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
          # NULLS LAST + alphabetical tiebreak: cooked recipes lead (newest cook
          # first), never-cooked recipes fall to the bottom sorted by title.
          # The previous updated_at tiebreaker pushed freshly-imported-but-
          # never-cooked recipes to the top, which read as "recently edited".
          scope.order(Arel.sql("last_cooked_at DESC NULLS LAST, title ASC"))
        when "prep_time"
          scope.order(Arel.sql("total_time_minutes ASC NULLS LAST"))
        when "rating"
          scope.order(Arel.sql("average_rating DESC NULLS LAST, title ASC"))
        when "my_rating"
          # LEFT JOIN restricted to current user's ratings; recipes the user
          # hasn't rated land at the bottom (NULLS LAST), tie-broken by
          # title. The user_id is parameter-bound through quote(); using
          # interpolation directly would be SQL-injectable in principle.
          quoted_uid = ActiveRecord::Base.connection.quote(current_user.id)
          scope.joins(
            "LEFT JOIN recipe_ratings ON recipe_ratings.recipe_id = recipes.id " \
            "AND recipe_ratings.user_id = #{quoted_uid}"
          ).order(Arel.sql("recipe_ratings.score DESC NULLS LAST, recipes.title ASC"))
        when "updated_at"
          scope.order(updated_at: :desc)
        else
          scope.order(Arel.sql("last_cooked_at DESC NULLS LAST, title ASC"))
        end
      end

    end
  end
end
