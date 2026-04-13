# Phase 5: Add to Meal Plan Modal

> **Depends on:** None (can be built in parallel with nav work)
> **Enables:** Phase 7 (search integration happens in polish)
>
> See: [Full Plan](../plan.md)

## Goal

Create a reusable modal for adding a recipe to the meal plan from any surface — initially the recipe detail page, and later search results. The modal provides a date + meal slot picker, handles leftover prompting, and creates the meal plan entry via the existing API.

## Key Deliverables

- `AddToMealPlanModal` component with week navigation, date selection, and slot picker
- "Add to Meal Plan" button on the recipe detail page
- Integration with existing leftover calculation (from EntryPicker patterns)
- Confirmation feedback (toast on success)

## Files to Create

- `frontend/src/components/meal-plan/AddToMealPlanModal.tsx` — reusable date+slot picker modal

## Files to Modify

- `frontend/src/pages/RecipeDetail.tsx` — add "Add to Meal Plan" button
- `frontend/src/pages/Search.tsx` — add "Add to Meal Plan" action on recipe cards (can be deferred to Phase 7)

## Dependencies

**Internal:** None — uses existing meal plan API.

**External:**
- Existing `createEntry` API function (or equivalent in `@/api/mealPlan`)
- Existing `calculateLeftovers` from `@/hooks/useLeftoverCalculation`
- Existing `weekUtils` for date formatting

## Implementation Notes

### Modal Layout

```
┌────────────────────────────────────┐
│  Add to Meal Plan           [X]     │
│  "Chicken Tikka Masala"             │
├────────────────────────────────────┤
│                                     │
│  ◄  Apr 7 – Apr 13, 2026  ►        │  ← Week navigation
│                                     │
│  Mon  Tue  Wed  Thu  Fri  Sat  Sun  │  ← Date selector (today highlighted)
│  [7]  [8]  [9] [10] [11] [12] [13] │
│                                     │
│  Meal Slot                          │
│  [Breakfast] [Lunch] [Dinner]       │  ← Slot picker pills
│  [Snack]                            │
│                                     │
│  ┌──────────────────────────────┐   │
│  │         Add to plan           │   │
│  └──────────────────────────────┘   │
└────────────────────────────────────┘
```

### Week Navigation

Reuse the same Monday-canonicalized week logic from the meal plan page. The modal manages its own week state (starts on the current week). Previous/next arrows shift the week. Today's date is highlighted.

### Slot Selection

Use the existing `MealSlot` type: `"breakfast" | "lunch" | "dinner" | "snack"`. Default to "dinner" (most common use case). Show as pill buttons — tap to select.

### Date Selection

Show 7 date cells for the visible week. Tap to select a date. Selected date is highlighted with garnish color. Today has a subtle indicator (dot or ring).

### Creating the Entry

Use the existing meal plan entry creation API:

```tsx
const mutation = useMutation({
  mutationFn: () => createEntry({
    date: selectedDate,
    meal_slot: selectedSlot,
    recipe_id: recipeId,
  }),
  onSuccess: () => {
    toast({ title: `Added to ${selectedSlot} on ${formatDate(selectedDate)}` });
    onClose();
    queryClient.invalidateQueries({ queryKey: ["meal-plan"] });
  },
});
```

### Leftover Integration

If the recipe has enough servings for leftovers (using `calculateLeftovers`), show the LeftoverPrompt after the user selects a date+slot, similar to EntryPicker's flow. This reuses the existing `LeftoverPrompt` component.

### Recipe Detail Page Button

Add a prominent "Add to Meal Plan" button in the recipe detail page's action area (near the edit/delete buttons). Use the `CalendarPlus` icon from Lucide:

```tsx
<button onClick={() => setMealPlanModalOpen(true)}>
  <CalendarPlus className="h-4 w-4" />
  Add to Meal Plan
</button>
```

The button should be visible to all household members (not just owner/admin), since any member can add entries to the meal plan.

### Search Results Integration

For the search page, add an "Add to Meal Plan" action accessible via a long-press or a small icon button on each RecipeCard. This can be done in Phase 7 during polish, or by adding an `onAddToPlan` callback prop to RecipeCard.

## Validation

- [ ] "Add to Meal Plan" button appears on recipe detail page
- [ ] Tapping it opens a modal with week navigation and date/slot selection
- [ ] Week navigation works (previous/next week, today highlighted)
- [ ] Date cells are selectable, selected date is visually highlighted
- [ ] Slot pills work, default to "dinner"
- [ ] "Add to plan" creates the entry via API and shows success toast
- [ ] Leftover prompt appears for recipes with enough servings
- [ ] Modal closes on success or backdrop tap
- [ ] The meal plan page reflects the new entry when navigated to
- [ ] Works for all household members (not permission-gated beyond basic membership)
