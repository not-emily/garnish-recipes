# Phase 4: Features — Sharing, Favorites, Cook Stats

> **Depends on:** Phase 1 (mutation + pending patterns used by new forms/buttons)
> **Enables:** First post-MVP feature set; ambient data for future rediscovery filters
>
> See: [Full Plan](../plan.md)

## Goal

Ship three user-requested features that came out of real usage:

1. **Link-based recipe sharing** — opt-in share links that let anyone (including non-users) view a recipe and copy it to their household
2. **Personal favorites + not-rated filters** — filter recipe browse by "my favorites" (my_rating ≥ 4) and "not rated by me" (my_rating is null); add "My rating" sort
3. **Cook tracking correctness + stats surface** — fix the `MealPlanEntry after_commit` trigger so cook count reflects "date passed without deletion" (not schedule time); surface "Last made X · Made N times" on recipe detail

Each sub-feature is independently shippable — pick the order that fits the session.

## Key Deliverables

### Sub-phase 4A — Recipe Share Links

**Backend:**
- Add `share_token :string, nullable` to `recipes` table (indexed, unique when present)
- `Recipe#generate_share_token!` — creates if null, idempotent
- `Recipe#revoke_share_token!` — nils the token
- `POST /api/v1/recipes/:id/share` — returns `{ share_token, share_url }` (generates if null)
- `DELETE /api/v1/recipes/:id/share` — 204, revokes
- `GET /api/v1/shared_recipes/:token` — public, no auth; returns recipe JSON with flag `can_copy: bool` (true if current user is logged in)
- `POST /api/v1/shared_recipes/:token/copy` — requires auth; copies recipe to current user's active household with provenance (same semantics as collection cross-household copy)
- `SharedRecipePolicy` — allow read without auth when valid token

**Frontend:**
- `ShareRecipeDialog` component — triggered from recipe detail menu; shows "Copy link", "Revoke", and current share status
- Public route `/r/shared/:token` → `SharedRecipe` page:
  - Renders read-only recipe view
  - Logged-in users see an "Add to my recipes" button → copies and redirects to the new recipe
  - Logged-out users see a "Sign up to save" CTA linking to signup
- Recipe detail menu gets a "Share" entry; reflects active share state
- Copy URL to clipboard action; fallback display of URL if clipboard API fails

### Sub-phase 4B — Favorites + Not-Rated Filters

**Backend:**
- Confirm `ratings` table has `user_id` (not just household) so we can scope per-member
- `GET /api/v1/recipes?my_rating=favorites` filter: recipes where current user has a rating ≥ 4
- `GET /api/v1/recipes?my_rating=unrated` filter: recipes where current user has no rating
- `GET /api/v1/recipes?sort=my_rating` — order by current user's rating desc, null last
- Alternative if performance is a concern: compute `my_rating` client-side by joining into the cached ratings data the recipe card already shows

**Frontend:**
- `RecipeFilterPanel` adds two new filter chips in a "My Ratings" group:
  - "My favorites" (single-select, sets `my_rating=favorites`)
  - "Not rated by me" (single-select, sets `my_rating=unrated`)
  - These two are mutually exclusive (picking one unselects the other)
- Sort By list adds "My rating" option (descending, null last)
- Active filter chips under the search bar show `My favorites` / `Not rated` with remove buttons
- No change to recipe card face (household avg remains the visible rating; personal rating stays on the detail page)

### Sub-phase 4C — Cook Tracking Correctness + Stats Surface

**Backend:**
- Verify current `MealPlanEntry` callback behavior (likely `after_commit :increment_cook_count` on create, wrong)
- Remove incorrect trigger
- Add `TallyCooksJob` — runs nightly, finds `MealPlanEntry.where(date: Date.yesterday).where.not(deleted_at: ...)` (if soft-deleted) or `exists?` equivalents, groups by recipe, and:
  - Increments `recipes.cook_count` by count-per-recipe
  - Sets `recipes.last_cooked_at = max(meal_plan_entry.date)` for that recipe
- Schedule via GoodJob recurring schedule (see `good_job_configuration` in `config/initializers` or `config/recurring.yml` if using Rails 8 solid_queue pattern)
- Backfill migration (optional): recompute `cook_count` and `last_cooked_at` for all recipes from historical `MealPlanEntry` data once, on deploy
- Verify `last_cooked_at` column exists; if not, add to `recipes` table

**Frontend:**
- `RecipeDetail` page adds a small stats line: "Last made 3 weeks ago · Made 12 times"
  - Use relative-time formatter for `last_cooked_at` ("Never made" if null)
  - Hide "Made N times" if `cook_count === 0`
  - Positioned subtly near the title, not as a hero element
- No changes to recipe card face

## Files to Create

**Backend:**
- `backend/db/migrate/YYYYMMDDHHMMSS_add_share_token_to_recipes.rb` — adds nullable, unique, indexed `share_token`
- `backend/db/migrate/YYYYMMDDHHMMSS_ensure_cook_stats_on_recipes.rb` — adds `last_cooked_at` and `cook_count` if missing (idempotent check)
- `backend/db/migrate/YYYYMMDDHHMMSS_backfill_cook_stats.rb` — one-time recompute from historical MealPlanEntry data
- `backend/app/controllers/api/v1/shared_recipes_controller.rb` — public show + authenticated copy
- `backend/app/policies/shared_recipe_policy.rb` — read without auth via token
- `backend/app/jobs/tally_cooks_job.rb` — nightly tally
- `backend/spec/requests/api/v1/shared_recipes_spec.rb` — request specs
- `backend/spec/jobs/tally_cooks_job_spec.rb` — job specs

**Frontend:**
- `frontend/src/pages/SharedRecipe.tsx` — public recipe view
- `frontend/src/components/recipes/ShareRecipeDialog.tsx` — share-link dialog

## Files to Modify

**Backend:**
- `backend/app/models/recipe.rb` — share_token methods, scopes for `my_rating=favorites|unrated`, `sort=my_rating`
- `backend/app/controllers/api/v1/recipes_controller.rb` — wire new filter/sort params; add `share` / `unshare` member actions (or a dedicated controller if preferred)
- `backend/config/routes.rb` — `/api/v1/recipes/:id/share` (POST, DELETE); `/api/v1/shared_recipes/:token` (GET); `/api/v1/shared_recipes/:token/copy` (POST)
- `backend/app/models/meal_plan_entry.rb` — remove incorrect cook-count after_commit if present
- `backend/config/recurring.yml` or GoodJob equivalent — schedule `TallyCooksJob` nightly
- Any serializer for Recipe — expose `share_token` + `share_url` to household members only (not public)

**Frontend:**
- `frontend/src/App.tsx` — add public route `/r/shared/:token` (outside the auth guard)
- `frontend/src/components/recipes/RecipeDetail.tsx` — add Share menu entry; add stats line
- `frontend/src/components/recipes/RecipeFilterPanel.tsx` — add "My Ratings" filter group; add "My rating" to sort options
- `frontend/src/components/recipes/RecipeBrowser.tsx` — wire new filter params; active-chip rendering
- `frontend/src/hooks/useRecipeFilters.ts` (if created in Phase 3) — include new filter dimensions in URL sync
- `frontend/src/lib/api.ts` — `shareRecipe`, `revokeShare`, `fetchSharedRecipe`, `copySharedRecipe` functions

## Dependencies

**Internal:**
- Phase 1: use `useOptimisticMutation` and `MutationButton` for new mutations (share, copy); use `ApiError` taxonomy for share-link-not-found handling
- Phase 3 (if done first): new filters integrate with `useRecipeFilters` URL sync — if Phase 3 hasn't shipped, add URL sync locally for the new filters

**External:**
- `SecureRandom.urlsafe_base64(24)` for share tokens (Ruby stdlib, already available)
- No new gems

## Implementation Notes

### Share Token Generation (4A)

```ruby
class Recipe < ApplicationRecord
  def generate_share_token!
    return share_token if share_token.present?
    update!(share_token: SecureRandom.urlsafe_base64(24))
    share_token
  end

  def revoke_share_token!
    update!(share_token: nil)
  end

  def share_url
    return nil unless share_token
    "#{ENV.fetch('FRONTEND_URL')}/r/shared/#{share_token}"
  end
end
```

Index:

```ruby
add_column :recipes, :share_token, :string
add_index :recipes, :share_token, unique: true, where: "share_token IS NOT NULL"
```

Partial unique index means the common case (null token) doesn't consume the uniqueness constraint.

### Share Dialog UX (4A)

```
┌────────────────────────────────┐
│  Share this recipe              │
├────────────────────────────────┤
│                                 │
│  Anyone with this link can view │
│  and copy this recipe.          │
│                                 │
│  https://garnish.app/r/shared/  │
│  abc123def456ghi789jkl...       │
│  [ Copy link ]                  │
│                                 │
│  [ Stop sharing ]               │
│                                 │
└────────────────────────────────┘
```

If `share_token` is null at open: just show "Share this recipe" with a "Generate link" button. Tapping generates the token and morphs the dialog to the above state.

### Copy-on-Save Semantics (4A)

The existing collection-share flow copies a recipe with provenance — keep the same pattern:

```ruby
# shared_recipes_controller#copy
def copy
  source = Recipe.find_by!(share_token: params[:token])
  copy = source.deep_copy_to!(current_user.active_household, contributed_by: current_user)
  copy.provenance = {
    source_recipe_id: source.id,
    source_household_id: source.household_id,
    copied_via: "share_link",
    copied_at: Time.current,
  }
  copy.save!
  render json: copy
end
```

If there's a `Recipe#deep_copy_to!` helper from the collection-sharing work, reuse it. Otherwise factor it out now.

### My-Rating Filter (4B)

Backend query (pseudo):

```ruby
# in Recipe or a query object
scope :my_rating_favorites, ->(user) {
  joins("LEFT JOIN ratings ON ratings.recipe_id = recipes.id AND ratings.user_id = #{user.id}")
    .where("ratings.value >= 4")
}

scope :my_rating_unrated, ->(user) {
  joins("LEFT JOIN ratings ON ratings.recipe_id = recipes.id AND ratings.user_id = #{user.id}")
    .where("ratings.id IS NULL")
}
```

(Use parameterized queries; the above is pseudo-SQL for clarity.)

For sort `my_rating` desc with nulls last:

```ruby
scope :sort_by_my_rating, ->(user) {
  joins("LEFT JOIN ratings ON ratings.recipe_id = recipes.id AND ratings.user_id = #{user.id}")
    .order(Arel.sql("ratings.value DESC NULLS LAST, recipes.title ASC"))
}
```

### Cook Tracking Fix (4C)

First, find and understand the current trigger. Likely in `app/models/meal_plan_entry.rb`:

```ruby
# CURRENT (suspected, wrong)
after_commit :increment_cook_count, on: :create

def increment_cook_count
  recipe&.increment!(:cook_count)
  recipe&.update!(last_cooked_at: Time.current)
end
```

Remove. Replace with the nightly job:

```ruby
# app/jobs/tally_cooks_job.rb
class TallyCooksJob < ApplicationJob
  def perform(date = Date.yesterday)
    entries = MealPlanEntry.where(date: date).where.not(recipe_id: nil)
    entries.group(:recipe_id).count.each do |recipe_id, count|
      Recipe.where(id: recipe_id).update_all(
        "cook_count = cook_count + #{count.to_i}, last_cooked_at = GREATEST(COALESCE(last_cooked_at, '1970-01-01'), '#{date}'::date)"
      )
    end
  end
end
```

(Prefer ActiveRecord-safe equivalents over raw SQL if the interpolation feels sketchy — the shape above is for brevity.)

Scheduling — if Garnish already uses GoodJob's recurring jobs via `good_job.rb`:

```ruby
# config/initializers/good_job.rb (or wherever schedules live)
GoodJob.configure do |config|
  config.cron = {
    tally_cooks: {
      cron: "0 2 * * *",  # 2am daily
      class: "TallyCooksJob",
    }
  }
end
```

Backfill migration: recompute stats from historical `MealPlanEntry` data:

```ruby
class BackfillCookStats < ActiveRecord::Migration[8.0]
  def up
    execute <<~SQL
      UPDATE recipes
      SET
        cook_count = subq.count,
        last_cooked_at = subq.last_date
      FROM (
        SELECT
          recipe_id,
          COUNT(*) AS count,
          MAX(date) AS last_date
        FROM meal_plan_entries
        WHERE recipe_id IS NOT NULL AND date <= CURRENT_DATE
        GROUP BY recipe_id
      ) subq
      WHERE recipes.id = subq.recipe_id;
    SQL
  end

  def down
    # non-reversible; data fix only
  end
end
```

### Stats Line on Recipe Detail (4C)

```tsx
{recipe.last_cooked_at || recipe.cook_count > 0 ? (
  <p className="text-sm text-gray-500">
    {recipe.last_cooked_at && `Last made ${formatRelative(recipe.last_cooked_at)}`}
    {recipe.cook_count > 0 && ` · Made ${recipe.cook_count} ${recipe.cook_count === 1 ? "time" : "times"}`}
  </p>
) : null}
```

Keep visual weight minimal — this is ambient info, not a headline.

## Validation

### Sharing (4A)
- [ ] Migration adds `share_token` column + partial unique index
- [ ] POST `/api/v1/recipes/:id/share` returns a token and URL; idempotent on repeat calls
- [ ] DELETE `/api/v1/recipes/:id/share` nulls the token; next share generates a new one (old URL 404s)
- [ ] GET `/api/v1/shared_recipes/:token` returns recipe JSON without auth; 404 on unknown/revoked tokens
- [ ] POST `/api/v1/shared_recipes/:token/copy` (authenticated) copies recipe to current user's household with provenance
- [ ] `/r/shared/:token` route renders outside the auth shell; shows recipe read-only
- [ ] Logged-in user sees "Add to my recipes" → copies and navigates to the new recipe
- [ ] Logged-out user sees "Sign up to save" CTA
- [ ] Recipe detail menu shows Share entry; dialog shows generate / copy link / revoke
- [ ] Clipboard copy works; fallback shows URL text for manual copy

### Favorites (4B)
- [ ] "My favorites" filter chip shows only recipes where current user has rated ≥ 4
- [ ] "Not rated by me" filter chip shows only recipes the current user hasn't rated
- [ ] These two chips are mutually exclusive in the UI
- [ ] "My rating" sort option orders by current user's rating desc, then title asc, null last
- [ ] Active filter chip appears below search bar when applied; removing it clears the filter
- [ ] Recipe card face is unchanged (household avg only)

### Cook Stats (4C)
- [ ] Old `MealPlanEntry after_commit` cook-count trigger is removed
- [ ] `TallyCooksJob` exists, is tested, and is scheduled nightly
- [ ] Manually running `TallyCooksJob.perform_now(Date.yesterday)` increments counts and updates `last_cooked_at` for yesterday's entries
- [ ] Backfill migration ran successfully — spot-check a few recipes' `cook_count` matches a manual query against meal_plan_entries
- [ ] Recipe detail page shows "Last made X" when `last_cooked_at` is present; "Never made" otherwise (or the line hides)
- [ ] Recipe detail page shows "· Made N times" only when `cook_count > 0`
- [ ] No changes visible on recipe card face
