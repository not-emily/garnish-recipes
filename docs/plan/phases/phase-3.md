# Phase 3: Search Page

> **Depends on:** Phase 2 (search page needs the collapsed nav state)
> **Enables:** Phase 5 (Add to Meal Plan from search results)
>
> See: [Full Plan](../plan.md)

## Goal

Create a dedicated search page at `/search` for recipe-focused discovery. The page provides full-text search with results displayed as a grid, and will later integrate with the filter panel (Phase 4) and Add to Meal Plan action (Phase 5).

## Key Deliverables

- New `/search` route in App.tsx (lazy-loaded, within AppShell)
- Search page component with recipe results grid
- Search driven by `?q=` URL search param (synced with nav bar input from Phase 2)
- Results use existing `RecipeCard` component in a grid layout
- Empty state with helpful prompt when no query entered
- No-results state when query doesn't match anything
- PageHeader with avatar on this page (consistent with main tabs)

## Files to Create

- `frontend/src/pages/Search.tsx` — search page route component

## Files to Modify

- `frontend/src/App.tsx` — add `/search` route inside AppShell
- `frontend/src/components/layout/BottomNav.tsx` — ensure collapsed mode search input syncs with `?q=` param

## Dependencies

**Internal:** Phase 2 must be complete (collapsed nav with search bar).

**External:** None — uses existing `listRecipes` API and `RecipeCard` component.

## Implementation Notes

### Search Page Layout

```
┌────────────────────────────────────┐
│  Search              [avatar]       │  ← PageHeader
├────────────────────────────────────┤
│                                     │
│  [result] [result] [result]         │  ← RecipeCard grid
│  [result] [result] [result]         │
│  [result] [result] ...              │
│                                     │
├────────────────────────────────────┤
│  [📖] [🔍 Search recipes...      ]  │  ← Collapsed nav with search bar
└────────────────────────────────────┘
```

### Search State via URL

The search query lives in `?q=` search params:

```tsx
const [searchParams, setSearchParams] = useSearchParams();
const query = searchParams.get("q") || "";
```

Both the nav bar's search input (Phase 2) and the SearchPage read from this. When the user types in the nav bar input, it updates `?q=` which triggers a re-render of SearchPage.

### Query Execution

Use `useQuery` with the search params:

```tsx
const deferredQuery = useDeferredValue(query);

const { data, isLoading } = useQuery({
  queryKey: ["recipes", { q: deferredQuery }],
  queryFn: () => listRecipes({ q: deferredQuery }),
  enabled: !!deferredQuery,
  placeholderData: keepPreviousData,
});
```

`enabled: !!deferredQuery` prevents fetching when the search bar is empty. `placeholderData: keepPreviousData` avoids skeleton flicker between keystrokes.

### Empty State (No Query)

When no query is entered, show a centered prompt:

```
🔍
Search your recipe library
Find recipes by name, ingredient, or description
```

This could later be enhanced with recent searches or suggested filters.

### No Results State

When query is entered but nothing matches:

```
No recipes match "[query]"
Try a different search term or [browse all recipes →]
```

The "browse all recipes" link navigates back to `/recipes`.

### Results Grid

Same grid layout as RecipeBrowser: 2 columns on mobile, 3 on tablet, 4 on desktop. Uses existing `RecipeCard` component.

### Route Registration

```tsx
// App.tsx — inside the AppShell route group
const Search = lazy(() => import("@/pages/Search"));

<Route path="/search" element={<Search />} />
```

### BottomNav Collapsed Mode on /search

The collapsed nav shows the active tab icon and the expanded search input. The search input should:
- Read its value from `?q=` search params
- Update `?q=` on change (with `replace: true` to avoid history spam)
- Auto-focus when the page loads

## Validation

- [ ] `/search` route loads correctly within AppShell
- [ ] Search bar in collapsed nav is synced with search results on the page
- [ ] Typing in the search bar filters recipes in real time (debounced)
- [ ] Empty search shows helpful empty state
- [ ] No-results shows appropriate message with link to browse
- [ ] Results display in responsive grid using RecipeCard
- [ ] Page is lazy-loaded (not in main bundle)
- [ ] PageHeader shows "Search" title with avatar
- [ ] Browser back from search returns to previous tab
- [ ] Direct URL access to `/search?q=chicken` works correctly
