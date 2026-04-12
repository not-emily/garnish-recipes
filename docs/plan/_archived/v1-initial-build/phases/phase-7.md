# Phase 7: Grocery Lists

> **Depends on:** Phase 5 (meal planning — entries to generate from)
> **Enables:** Phase 10 (polish — grocery list is a key mobile experience)
>
> See: [Full Plan](../plan.md)

## Goal

Build the collaborative grocery list system. Lists are generated from the meal plan (with ingredient aggregation and deduplication), support manual additions, show source provenance for each item, and sync in real-time across household members.

## Key Deliverables

- Grocery list generation from a week's meal plan
- Ingredient aggregation and deduplication across recipes
- Grocery category/aisle grouping
- Source tracking (which meal each item came from)
- Manual item additions
- Real-time sync via ActionCable (GroceryListChannel)
- Check-off and item management with role-based permissions
- Quick meal items in a "Frozen/Pre-made" section

## Files to Create

### Backend
- `backend/app/models/grocery_list.rb` — List container linked to household and week
- `backend/app/models/grocery_list_item.rb` — Individual list item
- `backend/app/services/grocery_generator.rb` — Generate list from meal plan entries
- `backend/app/controllers/api/v1/grocery_lists_controller.rb` — CRUD, generate
- `backend/app/channels/grocery_list_channel.rb` — Real-time sync
- `backend/app/policies/grocery_list_policy.rb` — Role-based permissions
- `backend/app/serializers/grocery_list_serializer.rb`
- `backend/db/migrate/*_create_grocery_lists.rb`
- `backend/db/migrate/*_create_grocery_list_items.rb`

### Frontend
- `frontend/src/pages/GroceryList.tsx` — Main grocery list page
- `frontend/src/components/grocery/GroceryList.tsx` — List display with category groups
- `frontend/src/components/grocery/GroceryCategory.tsx` — Collapsible category section
- `frontend/src/components/grocery/GroceryItem.tsx` — Single item with check-off
- `frontend/src/components/grocery/AddItemForm.tsx` — Manual item addition
- `frontend/src/components/grocery/ListGenerator.tsx` — Generate from meal plan UI
- `frontend/src/components/grocery/SourceBadge.tsx` — Small provenance indicator
- `frontend/src/api/groceryLists.ts` — API client
- `frontend/src/hooks/useGroceryList.ts` — List data + real-time subscription

## Dependencies

**Internal:** Phase 5 (meal plan entries with recipes and quick meals), Phase 2 (member grocery permissions)

**External:**
- ActionCable (already in Rails) — Real-time sync

## Implementation Notes

### Data Model

```ruby
create_table :grocery_lists do |t|
  t.references :household, null: false, foreign_key: true
  t.date :week_of, null: false
  t.timestamps
  t.index [:household_id, :week_of], unique: true
end

create_table :grocery_list_items do |t|
  t.references :grocery_list, null: false, foreign_key: true
  t.references :added_by, null: false, foreign_key: { to_table: :users }
  t.string :name, null: false
  t.decimal :quantity, precision: 10, scale: 2
  t.string :unit
  t.string :category  # produce, dairy, meat, frozen, pantry, household, etc.
  t.string :source_type  # recipe, quick_meal, manual
  t.jsonb :source_entries, default: []  # [{entry_id, title}, ...]
  t.boolean :checked, default: false
  t.integer :position
  t.timestamps
  t.index [:grocery_list_id, :checked]
end
```

### Grocery Generation Logic

```ruby
class GroceryGenerator
  def initialize(meal_plan:)
    @entries = meal_plan.entries
      .where(include_in_grocery: true)
      .where(is_leftover: false)  # leftovers don't add items
  end

  def generate
    items = []

    @entries.each do |entry|
      case entry.entry_type
      when 'recipe'
        items += ingredients_from_recipe(entry)
      when 'quick_meal'
        items << quick_meal_item(entry)
      # events and notes generate nothing
      end
    end

    aggregate_and_deduplicate(items)
  end

  private

  def ingredients_from_recipe(entry)
    recipe = entry.recipe
    scale = servings_scale(entry, recipe)

    recipe.all_ingredients.map do |ingredient|
      {
        name: ingredient['name'],
        quantity: (ingredient['quantity'] || 0) * scale,
        unit: ingredient['unit'],
        category: categorize_ingredient(ingredient['name']),
        source_type: 'recipe',
        source_entry: { id: entry.id, title: recipe.title }
      }
    end
  end

  def quick_meal_item(entry)
    {
      name: entry.title,
      quantity: 1,
      unit: nil,
      category: 'frozen_premade',
      source_type: 'quick_meal',
      source_entry: { id: entry.id, title: entry.title }
    }
  end

  def aggregate_and_deduplicate(items)
    # Group by normalized name + compatible unit
    # Sum quantities
    # Merge source_entries arrays
    # Example: "beef, 2 lbs" + "beef, 1 lb" → "beef, 3 lbs" (Mon dinner · Wed dinner)
  end
end
```

### Ingredient Categorization

Default categories for grocery aisle grouping:
```ruby
CATEGORIES = {
  produce: %w[onion garlic tomato lettuce carrot celery ...],
  dairy: %w[milk cheese butter cream yogurt eggs ...],
  meat: %w[beef chicken pork turkey salmon shrimp ...],
  frozen_premade: [],  # quick meals go here
  pantry: %w[flour sugar salt oil vinegar rice pasta ...],
  spices: %w[cumin paprika oregano thyme basil ...],
  bakery: %w[bread rolls tortillas ...],
  beverages: %w[juice soda water ...],
  household: [],  # manual adds like "paper towels"
  other: []  # catch-all
}
```

This is a starting heuristic. Users can recategorize items, and the system can learn from corrections over time (future enhancement).

### Grocery List UI

```
┌─────────────────────────────────────────────┐
│  Grocery List — Week of Apr 6               │
│  [Generate from Meal Plan]  [+ Add Item]    │
│                                              │
│  🥩 Meat                                     │
│  □ Beef, 3 lbs         Mon · Wed dinner     │
│  □ Ground turkey, 1 lb Thu dinner            │
│                                              │
│  🧊 Frozen / Pre-made                       │
│  □ Orange chicken       Tue dinner           │
│                                              │
│  🥬 Produce                                  │
│  □ Onions, 3           Mon · Thu dinner      │
│  □ Carrots, 1 lb       Mon dinner            │
│  □ Lettuce, 1 head                           │
│                                              │
│  🏠 Household                                │
│  □ Paper towels                              │
│                                              │
│  ── Checked ──                               │
│  ☑ Garlic, 3 cloves    Mon dinner            │
└─────────────────────────────────────────────┘
```

- Items grouped by category with emoji headers
- Source meals shown as small muted text to the right
- Checked items sink to a collapsible "Checked" section at the bottom
- Manual additions show no source indicator
- Swipe right to check off (mobile), or tap the checkbox

### Real-Time Sync

```ruby
class GroceryListChannel < ApplicationCable::Channel
  def subscribed
    grocery_list = GroceryList.find_or_create_by(
      household: current_user.active_household,
      week_of: params[:week_of]
    )
    stream_for grocery_list
  end
end
```

Broadcasts: `item_added`, `item_checked`, `item_unchecked`, `item_updated`, `item_removed`.

Both household members in a store see the same list updating in real-time. One checks off milk, the other sees it move to the checked section instantly.

### Permission Enforcement

| Action | Owner/Admin | Member (full) | Member (contribute) | Member (read) |
|--------|------------|---------------|---------------------|---------------|
| View list | Yes | Yes | Yes | Yes |
| Check off items | Yes | Yes | No | No |
| Add items | Yes | Yes | Yes | No |
| Edit items | Yes | Yes | No | No |
| Remove items | Yes | Yes | No | No |
| Generate from plan | Yes | No | No | No |

### Generate vs. Regenerate

- **First generation**: Creates a new grocery list from the meal plan. List is a draft — user reviews before shopping.
- **Regeneration**: If the meal plan changes after generation, user can "Refresh from meal plan" which:
  - Adds new items from new meal plan entries
  - Flags removed items (meal removed from plan) but doesn't auto-delete (user may have already bought them)
  - Preserves manual additions and check states
  - Preserves quantity adjustments the user made

## Validation

How do we know this phase is complete?

- [ ] Grocery list generates from the current week's meal plan
- [ ] Ingredients are aggregated and deduplicated across recipes (same ingredient from different meals combined)
- [ ] Items are grouped by grocery category/aisle
- [ ] Source meals are shown as muted text next to each item
- [ ] Quick meals appear in a "Frozen/Pre-made" category
- [ ] Leftovers and events don't generate grocery items
- [ ] User can manually add items to the list
- [ ] Items can be checked off and sink to "Checked" section
- [ ] Real-time sync: two household members see the same list updating live
- [ ] Role-based permissions: members with "contribute" can only add, "read" can only view
- [ ] Regeneration preserves manual additions and check states
- [ ] Excluded meal plan entries (include_in_grocery: false) don't generate items
