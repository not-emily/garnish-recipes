# Phase 3: Recipes Core

> **Depends on:** Phase 2 (households, authorization)
> **Enables:** Phase 4 (ingestion), Phase 5 (meal planning), Phase 8 (collections), Phase 9 (ratings)
>
> See: [Full Plan](../plan.md)

## Goal

Implement the full recipe management system: creating, editing, browsing, and searching recipes within a household. This includes all three recipe types (full, quick meal, event), the structured ingredient/instruction editor, taxonomy (category, cuisine, tags), and the recipe browse experience.

## Key Deliverables

- Recipe model with JSONB ingredients and instructions
- Recipe CRUD for all types (full, quick_meal, event)
- Structured ingredient editor with sections/groups
- Structured instruction editor with optional timers
- Recipe taxonomy (category, cuisine, tags, primary protein, time, difficulty)
- Recipe browse page with search, filters, and grid layout
- Recipe detail page
- Quick meal and event creation (lightweight forms)
- Recipe export (single and bulk)

## Files to Create

### Backend
- `backend/app/models/recipe.rb` — Recipe model with JSONB fields
- `backend/app/controllers/api/v1/recipes_controller.rb` — Full CRUD + search/filter
- `backend/app/policies/recipe_policy.rb` — Authorization (owner/admin: CRUD, member: read)
- `backend/app/serializers/recipe_serializer.rb` — JSON response shaping
- `backend/db/migrate/*_create_recipes.rb`

### Frontend
- `frontend/src/pages/Recipes.tsx` — Browse page with search, filters, grid
- `frontend/src/pages/RecipeDetail.tsx` — Full recipe view
- `frontend/src/pages/RecipeNew.tsx` — Create recipe (routes to appropriate form by type)
- `frontend/src/pages/RecipeEdit.tsx` — Edit recipe
- `frontend/src/components/recipes/RecipeCard.tsx` — Card for grid view
- `frontend/src/components/recipes/RecipeForm.tsx` — Full recipe form
- `frontend/src/components/recipes/IngredientEditor.tsx` — Structured ingredient input with sections
- `frontend/src/components/recipes/InstructionEditor.tsx` — Ordered step input with timers
- `frontend/src/components/recipes/RecipeBrowser.tsx` — Search + filter + results
- `frontend/src/components/recipes/QuickMealForm.tsx` — Lightweight quick meal form
- `frontend/src/components/recipes/EventForm.tsx` — Lightweight event form
- `frontend/src/components/recipes/RecipeTypeSelector.tsx` — Choose recipe type on create
- `frontend/src/api/recipes.ts` — API client for recipe endpoints
- `frontend/src/types/recipe.ts` — Recipe TypeScript types

## Dependencies

**Internal:** Phase 2 (household scoping, authorization policies)

**External:**
- `pg_search` — Full-text search on recipes (title, tags, cuisine, ingredients)
- No additional frontend packages

## Implementation Notes

### Data Model

```ruby
create_table :recipes do |t|
  t.references :household, null: false, foreign_key: true
  t.references :contributed_by, null: false, foreign_key: { to_table: :users }
  t.string :recipe_type, null: false, default: 'full'  # full, quick_meal, event
  t.string :title, null: false
  t.text :description
  t.string :category  # entree, side, appetizer, soup_stew, etc.
  t.string :cuisine
  t.string :tags, array: true, default: []
  t.string :primary_protein
  t.integer :prep_time_minutes
  t.integer :cook_time_minutes
  t.integer :total_time_minutes
  t.string :difficulty  # easy, medium, hard
  t.integer :servings
  t.string :source_url
  t.jsonb :ingredient_groups, default: []
  t.jsonb :instructions, default: []
  t.text :notes
  t.integer :times_cooked, default: 0
  t.date :last_cooked_at
  t.timestamps
end

add_index :recipes, :household_id
add_index :recipes, :recipe_type
add_index :recipes, :category
add_index :recipes, :tags, using: :gin
add_index :recipes, :cuisine
```

### JSONB Structures

Ingredient groups:
```json
[
  {
    "label": "For the stew",
    "ingredients": [
      { "name": "beef chuck", "quantity": 3, "unit": "lbs", "preparation": "cubed", "optional": false },
      { "name": "onions", "quantity": 2, "unit": null, "preparation": "diced", "optional": false }
    ]
  },
  {
    "label": "For the garnish",
    "ingredients": [
      { "name": "fresh parsley", "quantity": 0.25, "unit": "cup", "preparation": "chopped", "optional": true }
    ]
  }
]
```

Instructions:
```json
[
  { "step": 1, "text": "Preheat oven to 375°F", "timer_minutes": null },
  { "step": 2, "text": "Season beef with salt and pepper", "timer_minutes": null },
  { "step": 3, "text": "Roast for 45 minutes", "timer_minutes": 45 }
]
```

### Ingredient Editor UX
- Each row: quantity (number input) + unit (dropdown) + name (text with autocomplete from household's existing ingredients) + preparation (optional text)
- Rows are draggable for reordering
- Sections are optional. Default: one section with no label. "Add section" button adds a labeled group.
- Delete button on each row and each section
- Autocomplete for ingredient names helps consistency and speeds up entry

### Instruction Editor UX
- Each step: text area + optional timer input
- Steps are draggable for reordering
- Auto-numbered (no manual step numbers)
- "Add step" button at the bottom

### Browse & Search
- Full-text search across title, tags, cuisine, ingredient names
- Filter chips: category, cuisine, tags, protein, time range, difficulty, recipe type
- Sort: recently added, recently cooked, alphabetical, prep time
- Grid layout with recipe cards (image, title, time, rating placeholder)
- Responsive: 1 column on phone, 2 on tablet, 3-4 on desktop

### Recipe Type Differences in UI

| Field | Full Recipe | Quick Meal | Event |
|-------|------------|------------|-------|
| Title | Required | Required | Required |
| Description | Optional | Optional | Optional |
| Category | Required | Optional | — |
| Cuisine | Optional | Optional | — |
| Tags | Optional | Optional | — |
| Ingredients | Full editor | — | — |
| Instructions | Full editor | — | — |
| Servings | Required | — | — |
| Prep/cook time | Optional | Optional | — |
| Notes | Optional | Optional (e.g., "Trader Joe's, aisle 7") | Optional (e.g., "At mom's house") |
| Image | Optional | Optional | — |
| Source URL | Optional | — | — |

### Export
- Single recipe export: download as JSON (structured) or plain text (human-readable)
- Bulk export: select multiple recipes → download as ZIP of JSON files
- Export is available anytime via a meatball menu on the recipe detail page and a bulk action on the browse page

## Validation

How do we know this phase is complete?

- [ ] User can create a full recipe with structured ingredients (sections) and instructions (with timers)
- [ ] User can create a quick meal (title + optional fields)
- [ ] User can create an event (title + optional notes)
- [ ] User can edit and delete recipes
- [ ] Ingredient editor supports sections, reordering, autocomplete
- [ ] Instruction editor supports reordering and optional timers
- [ ] Browse page shows all household recipes in a searchable, filterable grid
- [ ] Full-text search works across title, tags, cuisine, ingredients
- [ ] Filters work: category, cuisine, tags, protein, time, difficulty, type
- [ ] Recipe detail page shows all information clearly on mobile
- [ ] Single and bulk recipe export works
- [ ] Authorization: owner/admin can CRUD, members can read only
- [ ] All recipes are scoped to the household
