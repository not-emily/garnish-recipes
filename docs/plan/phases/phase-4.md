# Phase 4: Recipe Filter Panel

> **Depends on:** None (can be built in parallel with Phases 2-3)
> **Enables:** Phase 6 (EntryPicker uses same filter patterns)
>
> See: [Full Plan](../plan.md)

## Goal

Replace the smart browse carousels on the recipe index page with a slide-up filter panel. The panel provides multi-select protein, category, cuisine, difficulty, time ranges, smart filters, and sort options. Active filters show as removable chips below the search bar, with a badge count on the filter button.

## Key Deliverables

- `RecipeFilterPanel` slide-up sheet component with all filter options
- Filter button (funnel icon) with active filter count badge
- Removable filter chips displayed below search bar when filters are active
- Smart filters: "Highly rated", "Haven't made in a while", "Never tried", "Recently used"
- Multi-select for protein, category, cuisine
- Single-select for difficulty, smart filter, sort
- Time range selector (e.g., under 30 min, under 1 hour, any)
- `SmartBrowse.tsx` removed from `RecipeBrowser.tsx` (deletion happens in Phase 7)
- RecipeBrowser updated to use the new filter state

## Files to Create

- `frontend/src/components/recipes/RecipeFilterPanel.tsx` — the slide-up filter sheet

## Files to Modify

- `frontend/src/components/recipes/RecipeBrowser.tsx` — remove SmartBrowse, add filter button + chips, integrate filter state with query
- `frontend/src/pages/Recipes.tsx` — minor layout adjustments if needed

## Dependencies

**Internal:** None — this can be built independently.

**External:** None — all filter params already supported by the backend (`protein`, `cuisine`, `difficulty`, `max_time`, `sort`).

## Implementation Notes

### Filter Panel Layout

The panel opens as a bottom sheet (similar to EntryPicker's modal pattern — fixed overlay with rounded-t-2xl card):

```
┌────────────────────────────────────┐
│  Filters                    [Reset] │
├────────────────────────────────────┤
│                                     │
│  Smart Filters                      │
│  [Highly rated] [Haven't made]      │
│  [Never tried]  [Recently used]     │
│                                     │
│  Primary Protein                    │
│  [Chicken] [Beef] [Pork] [Fish]     │
│  [Shrimp] [Tofu] [Turkey] ...       │
│                                     │
│  Category                           │
│  [Entrée] [Side] [Soup] [Salad]     │
│  [Breakfast] [Dessert] ...          │
│                                     │
│  Cuisine                            │
│  [Italian] [Mexican] [Thai] ...     │
│                                     │
│  Difficulty                         │
│  [Easy] [Medium] [Hard]             │
│                                     │
│  Time to Make                       │
│  [Under 30 min] [Under 1 hr] [Any]  │
│                                     │
│  Sort By                            │
│  [Title] [Rating] [Recently cooked] │
│  [Prep time] [Last updated]         │
│                                     │
│  ┌──────────────────────────────┐   │
│  │       Show N recipes          │   │
│  └──────────────────────────────┘   │
├────────────────────────────────────┤
```

### Protein and Cuisine Values

These are free-text fields on recipes, so we need to derive available values from the household's recipes. Two approaches:

1. **From the unfiltered recipe list** (already fetched in RecipeBrowser as `allData`): Extract unique `primary_protein` and `cuisine` values.
2. **New API endpoint**: A dedicated `/api/v1/recipes/filter_options` endpoint. 

**Recommended:** Approach 1 for now — the unfiltered recipe list is already being fetched. Extract unique values client-side:

```tsx
const proteins = [...new Set(allRecipes.map(r => r.primary_protein).filter(Boolean))].sort();
const cuisines = [...new Set(allRecipes.map(r => r.cuisine).filter(Boolean))].sort();
```

This means protein/cuisine pills only show values that actually exist in the household's recipes.

### Smart Filter Implementation

Smart filters map to the existing `smart_sections` endpoint data. When a smart filter is active:

1. Fetch the smart sections data (`useQuery(["smart-sections"])`)
2. Get the recipe IDs from the relevant section (e.g., `favorites` for "Highly rated")
3. Client-side filter the recipe list to only show those IDs

For "Recently used", we can alternatively use `sort: "recently_cooked"` backend param. For "Highly rated", sort by `rating` descending. This hybrid approach (backend sort + client-side intersection for the smart sections) gives the best UX.

**Simplified approach for MVP:** Smart filters just set the sort param and optionally limit results:
- "Highly rated" → `sort: "rating"` (needs backend support — currently not in sort options). Fallback: client-side sort by `average_rating`.
- "Recently used" → `sort: "recently_cooked"`
- "Haven't made in a while" → `sort: "recently_cooked"` ascending (reverse). Fallback: client-side filter using smart sections data.
- "Never tried" → filter where `times_cooked === 0` (client-side from the smart sections `never_tried` list)

### Filter State Management

Keep filter state in `RecipeBrowser` via `useState`. The filter panel receives current state and returns updated state on "Apply":

```tsx
const [filterState, setFilterState] = useState<RecipeFilterState>(DEFAULT_FILTERS);

// Map filterState to API params
const apiFilters: RecipeFilters = {
  q: deferredSearch || undefined,
  recipe_type: typeFilter === "all" ? undefined : typeFilter,
  category: filterState.categories.length === 1 ? filterState.categories[0] : undefined,
  protein: filterState.proteins.length === 1 ? filterState.proteins[0] : undefined,
  cuisine: filterState.cuisines.length === 1 ? filterState.cuisines[0] : undefined,
  difficulty: filterState.difficulty || undefined,
  max_time: filterState.maxTime || undefined,
  sort: filterState.sort,
};
```

Note: The backend's `protein` and `cuisine` filters are single-value. For multi-select, we'll need client-side filtering on the full list. If the user selects multiple proteins, fetch all recipes and filter client-side. For single selections, use the backend param.

### Filter Chips

Below the search bar, show removable chips for each active filter:

```tsx
{filterState.proteins.map(p => (
  <FilterChip key={p} label={p} onRemove={() => removeProtein(p)} />
))}
```

Each chip has the filter value text + an X button to remove it.

### Filter Button

A circular button with a funnel icon, positioned next to the search bar. When filters are active, show a badge with the count:

```tsx
<button onClick={() => setFilterOpen(true)} className="relative ...">
  <SlidersHorizontal className="h-4 w-4" />
  {activeFilterCount > 0 && (
    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-garnish-600 text-[10px] text-white">
      {activeFilterCount}
    </span>
  )}
</button>
```

### Removing the Type Filter Pills

The existing type filter pills (All / Recipes / Quick Meals) and category pills can be absorbed into the filter panel. The search bar + filter button replaces the current search bar + inline pills layout. This makes the recipe grid taller and cleaner.

Alternatively, keep the type pills as a quick-access row since they're the most-used filter. Decision: **move them into the filter panel** for consistency — the filter chips provide quick visibility and removal for any active filter.

## Validation

- [ ] Filter button (funnel icon) appears next to the recipe search bar
- [ ] Tapping filter button opens a slide-up panel with all filter options
- [ ] Protein filter shows only proteins that exist in household recipes (multi-select)
- [ ] Category filter shows only categories that exist (multi-select)
- [ ] Cuisine filter shows only cuisines that exist (multi-select)
- [ ] Smart filters work: "Highly rated", "Haven't made in a while", "Never tried", "Recently used"
- [ ] Time filter limits results by total_time_minutes
- [ ] Sort options change result ordering
- [ ] Active filter count badge appears on the filter button
- [ ] Filter chips appear below search bar and can be individually removed
- [ ] "Reset" button in panel clears all filters
- [ ] "Show N recipes" button at bottom shows the count and closes the panel
- [ ] Smart browse carousels are no longer shown on the recipe browse page
- [ ] Old type/category pill rows are removed (absorbed into filter panel)
