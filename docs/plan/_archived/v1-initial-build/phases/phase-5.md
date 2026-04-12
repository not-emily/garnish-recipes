# Phase 5: Meal Planning

> **Depends on:** Phase 3 (recipes, quick meals, events)
> **Enables:** Phase 6 (leftovers), Phase 7 (grocery lists)
>
> See: [Full Plan](../plan.md)

## Goal

Build the weekly meal planning interface where users can assign recipes, quick meals, events, and notes to breakfast/lunch/dinner slots across a week. Meal slots support multiple entries. The UI should feel like a native calendar app on mobile.

## Key Deliverables

- Weekly meal plan view (7 days x 3 meal slots)
- Add entries to meal slots (recipe, quick meal, event, note)
- Multiple entries per slot
- Entry picker: search recipes, create quick meal inline, add event/note
- Drag-and-drop reordering within and across slots (desktop/tablet)
- Tap-to-move on mobile
- Week navigation (previous/next week)
- Per-entry overrides (servings, diners, exclude from grocery list)
- Real-time sync via ActionCable (MealPlanChannel)

## Files to Create

### Backend
- `backend/app/models/meal_plan.rb` — Weekly meal plan container
- `backend/app/models/meal_plan_entry.rb` — Individual entry in a slot
- `backend/app/controllers/api/v1/meal_plans_controller.rb` — Week view, entry CRUD
- `backend/app/policies/meal_plan_policy.rb` — Authorization
- `backend/app/channels/meal_plan_channel.rb` — Real-time updates
- `backend/app/serializers/meal_plan_serializer.rb`
- `backend/db/migrate/*_create_meal_plans.rb`
- `backend/db/migrate/*_create_meal_plan_entries.rb`

### Frontend
- `frontend/src/pages/MealPlan.tsx` — Weekly meal plan page
- `frontend/src/components/meal-plan/WeekView.tsx` — 7-day grid layout
- `frontend/src/components/meal-plan/DayColumn.tsx` — Single day with 3 slots
- `frontend/src/components/meal-plan/MealSlot.tsx` — Slot container (multiple entries)
- `frontend/src/components/meal-plan/MealEntry.tsx` — Single entry display
- `frontend/src/components/meal-plan/EntryPicker.tsx` — Bottom sheet/modal to add entries
- `frontend/src/components/meal-plan/EntryOptions.tsx` — Per-entry settings (servings, grocery toggle)
- `frontend/src/api/mealPlans.ts` — API client
- `frontend/src/hooks/useMealPlan.ts` — Week data + real-time subscription

## Dependencies

**Internal:** Phase 3 (recipe model, browse/search for entry picker)

**External:**
- `@dnd-kit/core` — Drag-and-drop for meal entries (desktop/tablet)
- `framer-motion` — Animations for entry transitions

## Implementation Notes

### Data Model

```ruby
create_table :meal_plans do |t|
  t.references :household, null: false, foreign_key: true
  t.date :week_start, null: false  # always a Monday
  t.timestamps
  t.index [:household_id, :week_start], unique: true
end

create_table :meal_plan_entries do |t|
  t.references :meal_plan, null: false, foreign_key: true
  t.references :recipe, foreign_key: true  # null for notes
  t.date :date, null: false
  t.string :meal_slot, null: false  # breakfast, lunch, dinner
  t.string :entry_type, null: false  # recipe, quick_meal, event, note
  t.string :title  # display title (from recipe or manual for events/notes)
  t.integer :servings_override
  t.integer :diners_override
  t.boolean :is_leftover, default: false
  t.references :leftover_of, foreign_key: { to_table: :meal_plan_entries }
  t.integer :leftover_servings
  t.boolean :include_in_grocery, default: true
  t.integer :position, null: false, default: 0  # ordering within slot
  t.timestamps
  t.index [:meal_plan_id, :date, :meal_slot]
end
```

### Week View Layout

**Mobile (portrait):** Single-day view with swipe to navigate days. Each day shows 3 meal slot rows vertically, each containing its entries.

**Mobile (landscape) / Tablet:** 7-column grid. Each column is a day, each row is a meal slot. Compact entry cards.

**Desktop:** Full 7-column grid with more detail visible per entry.

### Adding an Entry

When user taps the "+" on a meal slot, a bottom sheet opens:

```
┌─────────────────────────────────────┐
│  Add to Tuesday Dinner              │
│                                     │
│  🔍 Search recipes...               │
│                                     │
│  [📖 Recipe]  [🍕 Quick Meal]       │
│  [📅 Event]   [📝 Note]             │
│                                     │
│  Recent:                            │
│  ┌──────┐ ┌──────┐ ┌──────┐       │
│  │Stew  │ │Tacos │ │Pizza │       │
│  └──────┘ └──────┘ └──────┘       │
└─────────────────────────────────────┘
```

- **Recipe**: Opens recipe browser (from Phase 3), tap to add
- **Quick Meal**: Inline form — just type a name, optional tags. Can also pick from existing quick meals.
- **Event**: Inline form — title + optional description
- **Note**: Inline form — freeform text

### Multiple Entries Per Slot

Entries stack vertically within a slot. Each entry shows:
- Type icon (recipe/quick meal/event/note)
- Title
- Servings info (if recipe)
- Leftover indicator (if leftover)
- Meatball menu → edit, move, remove, exclude from grocery

### Real-Time Sync

MealPlanChannel broadcasts entry changes to all household members viewing the same week:
```ruby
class MealPlanChannel < ApplicationCable::Channel
  def subscribed
    meal_plan = MealPlan.find_or_create_by(
      household: current_user.active_household,
      week_start: params[:week_start]
    )
    stream_for meal_plan
  end
end
```

Broadcast events: `entry_added`, `entry_updated`, `entry_removed`, `entry_moved`.

### Meal Plan Auto-Creation

Meal plans are created lazily — when a user navigates to a week that doesn't have a plan yet, one is created automatically. No explicit "create plan" step needed.

## Validation

How do we know this phase is complete?

- [ ] Weekly view displays 7 days with breakfast/lunch/dinner slots
- [ ] User can add recipes from the recipe browser to meal slots
- [ ] User can add quick meals, events, and notes to meal slots
- [ ] Multiple entries can exist in a single slot
- [ ] Entries can be reordered within a slot (drag on desktop, tap-to-move on mobile)
- [ ] Entries can be moved between slots
- [ ] Week navigation works (previous/next week)
- [ ] Per-entry settings: servings override, diners override, grocery toggle
- [ ] Real-time sync: changes by one household member appear for others
- [ ] Mobile layout: single-day swipe view in portrait
- [ ] Tablet/desktop layout: full 7-column grid
- [ ] Authorization: owner/admin can CRUD entries, members can read only
