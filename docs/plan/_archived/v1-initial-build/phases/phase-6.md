# Phase 6: Leftovers

> **Depends on:** Phase 5 (meal planning, meal plan entries)
> **Enables:** Enhanced meal planning experience (not a blocker for other phases)
>
> See: [Full Plan](../plan.md)

## Goal

Add smart leftover calculation and management to the meal planner. When a recipe makes more meals than the household needs, suggest spreading leftovers across future slots. Handle partial leftovers via a "leftover tray" that shows available servings.

## Key Deliverables

- Leftover calculation based on recipe servings and household default diners
- Smart leftover suggestion prompt when adding recipes
- Leftover tray showing available partial leftovers
- Leftover entries linked to their source meal
- Visual connection between original meal and leftover entries
- Configurable leftover behavior per household
- Per-meal diner overrides (for guests or absent members)

## Files to Create

### Backend
- `backend/app/services/leftover_calculator.rb` — Calculate meals, remaining servings, suggestions
- `backend/app/controllers/api/v1/leftovers_controller.rb` — Leftover tray endpoint
- `backend/app/serializers/leftover_serializer.rb`

### Frontend
- `frontend/src/components/meal-plan/LeftoverPrompt.tsx` — Suggestion UI when adding a recipe
- `frontend/src/components/meal-plan/LeftoverTray.tsx` — Available leftovers display
- `frontend/src/components/meal-plan/LeftoverEntry.tsx` — Leftover entry in meal slot (linked to source)
- `frontend/src/hooks/useLeftoverCalculation.ts` — Client-side leftover math

## Dependencies

**Internal:** Phase 5 (meal plan entries, slot system), Phase 2 (household settings for default_diners and leftover preferences)

**External:** None

## Implementation Notes

### Leftover Calculation Logic

```ruby
class LeftoverCalculator
  def initialize(recipe:, household:, diners_override: nil)
    @servings = recipe.servings
    @diners = diners_override || household.default_diners
  end

  def meals_count
    (@servings.to_f / @diners).floor
  end

  def remaining_servings
    @servings % @diners
  end

  def has_full_leftover_meals?
    meals_count > 1
  end

  def has_partial_leftovers?
    remaining_servings > 0
  end

  def suggested_leftover_count
    meals_count - 1  # subtract the original meal
  end
end
```

### Leftover Prompt UX

When adding a recipe to a meal slot, if the recipe makes more than 1 meal:

```
┌─────────────────────────────────────────────┐
│  Beef Stew makes 3 meals for your           │
│  household.                                  │
│                                              │
│  Plan leftovers?  [On] / Off                │
│                                              │
│   Wed  [ Lunch ▾ ]                          │
│   Thu  [ Lunch ▾ ]                          │
│                                              │
│  [ Save ]                                    │
└─────────────────────────────────────────────┘
```

- Toggle defaults based on household preference (`leftover_suggestion` setting: on/off/ask)
- Slot dropdowns default to the household's `leftover_default_slot` preference
- User picks which day and slot for each leftover
- Dates auto-fill sequentially from the day after the original meal

### Partial Leftovers

When a recipe doesn't divide evenly (e.g., 5 servings ÷ 4 diners = 1 full meal + 1 extra serving):

- Prompt mentions the extra: "Pasta Bake makes 1 meal with 1 extra serving"
- Leftover toggle defaults to off for partials (not enough for a full meal)
- Extra servings appear in the **Leftover Tray**

### Leftover Tray

A collapsible section at the top of the meal plan view:

```
🍱 Available leftovers: Pasta Bake (1 serving), Soup (2 servings)
```

- Shows partial leftovers that aren't assigned to slots
- User can drag (desktop) or tap (mobile) a tray item into any slot
- When added to a slot, it becomes a leftover entry with the specific serving count
- Tray items auto-expire after a configurable number of days (default: 3) — food goes bad

### Leftover Entries in the Plan

Leftover entries are visually distinct:
- Show the original recipe title + "(leftovers)"
- Subtle visual link to the original (matching accent color or a small link icon)
- Leftover entries don't generate grocery items
- Clicking a leftover entry navigates to the original recipe

### Data Flow

```
1. User adds Beef Stew (6 servings) to Monday dinner
2. Calculator: 6 ÷ 2 diners = 3 meals
3. Prompt: "Plan leftovers?" → User accepts Tue lunch, Wed lunch
4. System creates:
   - MealPlanEntry: Monday dinner, recipe: Beef Stew, is_leftover: false
   - MealPlanEntry: Tuesday lunch, leftover_of: Monday entry, is_leftover: true
   - MealPlanEntry: Wednesday lunch, leftover_of: Monday entry, is_leftover: true
5. If user deletes the original Monday entry:
   - Prompt: "This has 2 leftover entries. Remove those too?" (yes/no)
```

### Household Leftover Preferences

From Phase 2 household settings:
```ruby
leftover_suggestion: 'on' | 'off' | 'ask'   # default prompt behavior
leftover_default_slot: 'lunch' | 'dinner' | 'breakfast' | 'ask'  # pre-fill slot
```

- `on`: prompt appears with toggle pre-set to on
- `off`: prompt doesn't appear (user can still manually add leftovers)
- `ask`: prompt appears with toggle pre-set to off (user opts in each time)

## Validation

How do we know this phase is complete?

- [ ] Adding a recipe triggers leftover calculation based on household diners
- [ ] Leftover prompt appears with correct meal count and slot suggestions
- [ ] User can accept/dismiss leftover suggestions
- [ ] User can choose which slot each leftover goes to via inline dropdown
- [ ] Leftover entries appear in the plan linked to their source
- [ ] Leftover entries are visually distinct from regular entries
- [ ] Leftover tray shows partial leftovers (not enough for a full meal)
- [ ] Tray items can be added to meal slots
- [ ] Deleting an original entry prompts about associated leftovers
- [ ] Household leftover preferences control default prompt behavior
- [ ] Per-meal diner override changes the leftover calculation
- [ ] Leftover entries do not generate grocery list items
