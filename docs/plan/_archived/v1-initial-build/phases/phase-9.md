# Phase 9: Ratings & Smart Browse

> **Depends on:** Phase 3 (recipes, browse page)
> **Enables:** Enhanced recipe discovery
>
> See: [Full Plan](../plan.md)

## Goal

Add per-member recipe ratings with household averages, and build smart browse sections that surface recipes based on usage patterns — recently used, favorites, haven't made in a while, and never tried.

## Key Deliverables

- Per-member recipe ratings (1-5 stars)
- Household average rating display
- Rating breakdown on recipe detail page
- Smart browse sections on the recipes page
- "Haven't Made in a While" section (rated 3+, not cooked in 30+ days)
- "Never Tried" section (in recipe box but never planned/cooked)
- "Favorites" section (rated 4+, cooked 3+ times)
- "Recently Used" section (cooked in last 2 weeks)

## Files to Create

### Backend
- `backend/app/models/recipe_rating.rb` — Per-user rating model
- `backend/app/controllers/api/v1/ratings_controller.rb` — Rate recipe endpoint
- `backend/app/controllers/api/v1/recipe_suggestions_controller.rb` — Smart section data
- `backend/app/services/recipe_suggester.rb` — Query logic for smart sections
- `backend/db/migrate/*_create_recipe_ratings.rb`

### Frontend
- `frontend/src/components/recipes/RatingStars.tsx` — Interactive star rating input
- `frontend/src/components/recipes/RatingDisplay.tsx` — Average rating display
- `frontend/src/components/recipes/RatingBreakdown.tsx` — Per-member breakdown on detail page
- `frontend/src/components/recipes/SmartSections.tsx` — Smart section container for browse page
- `frontend/src/components/recipes/RecipeCarousel.tsx` — Horizontal scrollable recipe row for sections
- `frontend/src/api/ratings.ts` — API client

## Dependencies

**Internal:** Phase 3 (recipe model, browse page), Phase 5 (meal plan entries for `last_cooked_at` and `times_cooked` tracking)

**External:** None

## Implementation Notes

### Data Model

```ruby
create_table :recipe_ratings do |t|
  t.references :recipe, null: false, foreign_key: true
  t.references :user, null: false, foreign_key: true
  t.references :household, null: false, foreign_key: true
  t.integer :score, null: false  # 1-5
  t.timestamps
  t.index [:recipe_id, :user_id], unique: true
end
```

### Rating Logic

- Each user can rate a recipe once (update replaces previous rating)
- `average_rating` and `rating_count` are cached on the recipe record for fast querying
- Recalculated on rating create/update/delete via callback
- Ratings are scoped to the household — if a recipe is copied to another household, ratings don't transfer

### Rating Display

**On recipe cards (browse page):**
```
⭐ 4.5 (2)
```
Average + count. If no ratings, show nothing (not empty stars).

**On recipe detail page:**
```
Household Rating: ⭐⭐⭐⭐½ (4.5)
  Emily:  ⭐⭐⭐⭐⭐
  Marcus: ⭐⭐⭐⭐

[Rate this recipe: ☆☆☆☆☆]
```

Tap stars to rate. If already rated, stars show your rating and tapping updates it.

### Smart Browse Sections

Each section is a horizontal scrollable row of recipe cards:

```
┌─────────────────────────────────────────────┐
│  🔍 Search recipes...                        │
│  [All] [Entrées] [Sides] [Soups] ...        │
│                                              │
│  Recently Used                       See All │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  →   │
│  │      │ │      │ │      │ │      │       │
│  └──────┘ └──────┘ └──────┘ └──────┘       │
│                                              │
│  Haven't Made in a While             See All │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  →   │
│  │      │ │      │ │      │ │      │       │
│  └──────┘ └──────┘ └──────┘ └──────┘       │
│                                              │
│  Never Tried                         See All │
│  ┌──────┐ ┌──────┐ ┌──────┐  →             │
│  │      │ │      │ │      │                 │
│  └──────┘ └──────┘ └──────┘                │
│                                              │
│  Quick Meals                         See All │
│  ┌──────┐ ┌──────┐  →                      │
│  │      │ │      │                          │
│  └──────┘ └──────┘                          │
└─────────────────────────────────────────────┘
```

### Section Queries

```ruby
class RecipeSuggester
  def initialize(household:)
    @recipes = household.recipes
  end

  def recently_used(limit: 10)
    @recipes.where('last_cooked_at > ?', 2.weeks.ago)
            .order(last_cooked_at: :desc)
            .limit(limit)
  end

  def favorites(limit: 10)
    @recipes.where('average_rating >= ? AND times_cooked >= ?', 4.0, 3)
            .order(average_rating: :desc)
            .limit(limit)
  end

  def havent_made_in_a_while(limit: 10)
    @recipes.where('last_cooked_at < ? AND last_cooked_at IS NOT NULL', 30.days.ago)
            .where('average_rating >= ? OR average_rating IS NULL', 3.0)
            .order(last_cooked_at: :asc)
            .limit(limit)
  end

  def never_tried(limit: 10)
    @recipes.where(times_cooked: 0)
            .order(created_at: :desc)
            .limit(limit)
  end

  def quick_meals(limit: 10)
    @recipes.where(recipe_type: 'quick_meal')
            .order(updated_at: :desc)
            .limit(limit)
  end
end
```

### Tracking `last_cooked_at` and `times_cooked`

These fields on the Recipe model are updated when meal plan entries are created/destroyed:

```ruby
# In MealPlanEntry after_commit callbacks
# When a recipe-type entry is created for a date in the past or today:
#   - Increment recipe.times_cooked
#   - Update recipe.last_cooked_at if this date is more recent

# When a recipe-type entry is destroyed:
#   - Decrement recipe.times_cooked
#   - Recalculate recipe.last_cooked_at from remaining entries
```

Note: This creates a dependency on Phase 5. If building Phase 9 before Phase 5, the smart sections will work but `last_cooked_at` and `times_cooked` will be empty. Ratings and "never tried" will still work.

## Validation

How do we know this phase is complete?

- [ ] User can rate a recipe 1-5 stars from the detail page
- [ ] Household average rating displays on recipe cards and detail page
- [ ] Rating breakdown shows each member's rating on detail page
- [ ] Updating a rating recalculates the average correctly
- [ ] Smart browse sections appear on the recipes page
- [ ] "Recently Used" shows recipes cooked in the last 2 weeks
- [ ] "Favorites" shows highly-rated, frequently-cooked recipes
- [ ] "Haven't Made in a While" shows well-rated recipes not cooked in 30+ days
- [ ] "Never Tried" shows recipes with zero cook history
- [ ] "Quick Meals" shows all quick meal type recipes
- [ ] Sections hide when empty (no "Recently Used" section if nothing cooked recently)
- [ ] "See All" expands each section to a full filtered view
