# Phase 6: EntryPicker Enhancement

> **Depends on:** Phase 4 (reuses filter patterns from RecipeFilterPanel)
> **Enables:** None
>
> See: [Full Plan](../plan.md)

## Goal

Wire up the additional filter parameters (protein, cuisine, difficulty) in the meal plan's EntryPicker recipe tab. The backend already supports these params — they just need UI controls in the EntryPicker.

## Key Deliverables

- Protein filter pills in EntryPicker's recipe tab (derived from household recipes)
- Cuisine filter pills (if cuisines exist in household)
- Difficulty filter pills
- Filters integrated with the existing recipe search query
- Compact filter layout that doesn't overwhelm the modal

## Files to Modify

- `frontend/src/components/meal-plan/EntryPicker.tsx` — add filter pills to RecipeTab

## Dependencies

**Internal:** Phase 4 patterns (how to derive available filter values from recipe list, pill styling).

**External:** None — backend already supports `protein`, `cuisine`, `difficulty` params.

## Implementation Notes

### Filter Layout in RecipeTab

The EntryPicker modal is already compact. Adding full multi-select panels would be too much. Instead, use a single row of horizontally scrollable filter pills below the existing type filter row:

```
[Search recipes and quick meals...        ]
[All] [Recipes] [Quick meals]              ← existing type pills
[Chicken] [Beef] [Fish] [Tofu] [Pork] ... ← NEW protein pills (scrollable)
```

Protein is the most-requested filter for meal planning ("what chicken recipes do I have?"), so it gets the primary position. Cuisine and difficulty can be secondary — either as additional pill rows or behind a small "More filters" expansion.

### Deriving Protein Values

Same pattern as Phase 4: fetch the unfiltered recipe list and extract unique `primary_protein` values:

```tsx
const { data: allData } = useQuery({
  queryKey: ["recipes", {}],
  queryFn: () => listRecipes({}),
});
const proteins = [...new Set(allData?.data.map(r => r.primary_protein).filter(Boolean))].sort();
```

This query is likely already cached from the main RecipeBrowser page.

### Compact Design for Modal Context

The EntryPicker is a modal — vertical space is precious. Design considerations:
- Protein pills row: show only if there are 2+ proteins in the household
- Each pill is small (text-xs, px-2.5 py-1) with horizontal scroll
- Selected protein is highlighted (garnish-600 bg)
- Multiple protein selection NOT needed here (single-select is fine for the meal plan "what should we have" use case)
- Tapping a selected protein deselects it (toggle behavior)

### Query Integration

Add protein/cuisine/difficulty to the existing query:

```tsx
const { data, isLoading } = useQuery({
  queryKey: ["recipes", {
    q: search || undefined,
    recipe_type: typeFilter === "all" ? undefined : typeFilter,
    protein: proteinFilter || undefined,
    // cuisine and difficulty if we add those pills
  }],
  queryFn: () => listRecipes({
    q: search || undefined,
    recipe_type: typeFilter === "all" ? undefined : typeFilter,
    protein: proteinFilter || undefined,
  }),
  placeholderData: keepPreviousData,
});
```

## Validation

- [ ] Protein filter pills appear in EntryPicker's recipe tab (when proteins exist)
- [ ] Selecting a protein filters the recipe list to only show that protein
- [ ] Tapping the selected protein deselects it (shows all again)
- [ ] Protein pills only show values that exist in the household's recipes
- [ ] Filter works in combination with the existing type filter and search
- [ ] The modal doesn't feel cramped — pills are compact and scrollable
- [ ] No regression in existing EntryPicker functionality (events, notes, leftovers)
