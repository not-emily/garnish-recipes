# Navigation & Search UX Rework

> **Status:** Planning complete | Last updated: 2026-04-12
> 
> Phase files: [phases/](phases/)

## Overview

A comprehensive redesign of Garnish's navigation, search, and recipe filtering UX. The current 4-tab bottom nav with inline smart browse carousels is being replaced with an iOS 26-inspired adaptive navigation system: a 3-tab pill group (Recipes, Meal Plan, Grocery) with a separate search icon that morphs the nav into an expanded search bar. Settings moves to a header avatar icon.

The recipe browse page gets a proper filter panel (replacing carousels) with protein, category, cuisine, time, and smart filters. A dedicated search page provides focused recipe discovery. "Add to Meal Plan" becomes available from recipe detail and search results, not just from within the meal plan's EntryPicker.

This is a frontend-only rework — no backend changes needed. The backend already supports all filter parameters (protein, cuisine, difficulty, max_time, tags, sort).

## Core Vision

- **Contextual minimalism**: Navigation adapts to what the user is doing — full nav when browsing, collapsed when searching. Screen real estate is always used for the most relevant content.
- **Filter over browse**: Replace passive carousels with active filtering. Users find recipes faster with multi-select protein + category + smart filters than by scrolling horizontal lists.
- **Add-to-plan everywhere**: The path from "I found a recipe" to "it's on the meal plan" should be 1-2 taps from any surface, not just the meal plan page.

## Requirements

### Must Have
- Adaptive bottom nav: 3-tab pill group + search icon, morph animation on search tap
- Settings relocated to user avatar in page header (main tab pages + search page only)
- Dedicated search page at `/search` with full-text recipe search
- Recipe browse filter panel (slide-up sheet) replacing smart browse carousels
- Filter panel includes: primary protein (multi-select), category, cuisine, difficulty, time ranges, smart filters (highly rated, haven't made in a while, never tried, recently used), sort options
- Active filter count badge on filter button + removable filter chips
- "Add to Meal Plan" button on recipe detail page (date + slot picker modal)
- "Add to Meal Plan" action on search result cards
- EntryPicker gets protein/cuisine/difficulty filter pills wired up

### Nice to Have
- Haptic feedback on nav morph (if available via Vibration API)
- Recent searches shown on empty search page
- Search result highlighting (bold matched terms)
- Keyboard shortcut for search (desktop: Cmd/Ctrl+K)

### Out of Scope
- Visual re-theme / color changes — separate initiative
- Backend API changes — all needed endpoints and filter params already exist
- Tutorial/coachmark system — separate initiative
- Global search (meal plan entries, grocery items) — recipe-focused only for now

## Constraints

- **Tech stack**: React 19, TypeScript, Tailwind CSS, Framer Motion, React Router, TanStack Query
- **Team**: Solo developer
- **Platform**: Mobile-first PWA, must work well on iOS Safari and Android Chrome
- **Existing patterns**: Must work within current AppShell/Outlet routing architecture
- **Performance**: Filter panel and search page must lazy-load; main bundle should not grow

## Success Metrics

- Bottom nav reduced from 4 to 3 items + search icon
- Settings accessible from header on main pages
- Recipe browse page has no carousels; filter panel covers all use cases
- Search page is a standalone route with full recipe search + filters
- "Add to Meal Plan" available from recipe detail and search results
- Nav morph animation is smooth (no layout shift, no flash)
- All existing navigation paths still work (no broken routes)

## Architecture Decisions

### 1. Framer Motion `layoutId` for Nav Morph
**Choice:** Use `layoutId` on shared elements (active tab icon, search icon container) to animate the nav state transition when entering/leaving search.
**Rationale:** `layoutId` handles the interpolation between two layout positions automatically — the active tab icon slides to its collapsed position, the search icon morphs into the search bar. This is the standard Framer Motion approach for "shared element transitions."
**Trade-offs:** Requires careful component structure — the elements with `layoutId` must exist in both the expanded and collapsed nav states. May need `LayoutGroup` wrapper if they're in different component trees.

### 2. Nav State via Route (not local state)
**Choice:** The nav's expanded/collapsed state is derived from `location.pathname === '/search'` rather than a useState toggle.
**Rationale:** This means the search page is a real route with a real URL, which gives us: browser back button works naturally, deep-linking to search works, page refreshes preserve state, and the nav component is a pure function of route state.
**Trade-offs:** Navigating to/from `/search` goes through React Router's transition, but the morph animation via `layoutId` will mask this.

### 3. Filter Panel as Slide-Up Sheet (not inline)
**Choice:** The recipe browse filter panel opens as a bottom sheet overlay, not inline filter rows.
**Rationale:** Multi-select protein, category grid, time slider, and smart filter toggles need more space than horizontal pill rows can provide. A slide-up sheet is the established mobile pattern for complex filters (Airbnb, DoorDash, etc.). It also keeps the recipe grid visible at full width when filters aren't being adjusted.
**Trade-offs:** Extra tap to access filters vs. always-visible pills. Mitigated by: filter chips shown below the search bar for quick removal, and the filter button shows an active count badge.

### 4. Shared AddToMealPlanModal Component
**Choice:** A single reusable modal component for the "Add to Meal Plan" flow, used from recipe detail page, search results, and potentially collections.
**Rationale:** The date + slot picker logic is non-trivial (week navigation, slot selection, leftover prompting). Building it once and reusing it avoids divergence.
**Trade-offs:** The component needs to work without the MealPlan page's context (no existing week state), so it must manage its own week navigation internally.

### 5. Keep SmartBrowse Endpoint, Repurpose for Smart Filters
**Choice:** Keep the existing `GET /api/v1/recipes/smart_sections` endpoint but use its data to power the smart filter options in the filter panel rather than carousels.
**Rationale:** The endpoint already computes "recently used", "favorites", "haven't made in a while", and "never tried" server-side. Rather than duplicating that logic as filter params, we can use the section membership to determine which recipes match a smart filter.
**Trade-offs:** Smart filters will need a client-side approach: fetch smart sections + apply as a secondary filter on the recipe list. Alternatively, add backend `smart_filter` param in a future iteration. For MVP, the backend `sort` param (`recently_cooked`) covers the most common case, and the smart sections data can label cards.

## Project Structure

No new directories. Changes are within existing frontend structure:

```
frontend/src/
├── components/
│   ├── layout/
│   │   ├── BottomNav.tsx          # Rewrite: adaptive 3-tab pill + search icon
│   │   ├── AppShell.tsx           # Update: add PageHeader, adjust layout
│   │   └── PageHeader.tsx         # NEW: page title + avatar icon
│   ├── recipes/
│   │   ├── RecipeBrowser.tsx      # Update: remove SmartBrowse, add filter button + chips
│   │   ├── SmartBrowse.tsx        # DELETE (replaced by filter panel)
│   │   ├── RecipeCarousel.tsx     # DELETE (no longer used)
│   │   ├── RecipeFilterPanel.tsx  # NEW: slide-up filter sheet
│   │   └── RecipeCardCompact.tsx  # Keep (may be used in search results)
│   ├── meal-plan/
│   │   ├── EntryPicker.tsx        # Update: add protein/cuisine/difficulty filters
│   │   └── AddToMealPlanModal.tsx # NEW: date+slot picker for adding from outside meal plan
│   └── search/
│       └── SearchPage.tsx         # NEW: dedicated search page component
├── pages/
│   ├── Search.tsx                 # NEW: search page route
│   └── Recipes.tsx                # Update: remove carousels, add filter panel
└── App.tsx                        # Update: add /search route
```

### Key Files
- `BottomNav.tsx` — The centerpiece: adaptive nav with morph animation
- `PageHeader.tsx` — Shared header with page title and settings avatar
- `RecipeFilterPanel.tsx` — Slide-up filter sheet replacing carousels
- `SearchPage.tsx` — Dedicated search page with recipe-focused search
- `AddToMealPlanModal.tsx` — Reusable date+slot picker for add-to-plan flow

## Core Interfaces

### BottomNav States

```typescript
// Nav derives its state from the current route
type NavMode = "full" | "collapsed";

// Full mode: 3 tabs + search icon (on /recipes, /meal-plan, /grocery-list)
// Collapsed mode: active tab icon (back) + expanded search bar (on /search)
```

### RecipeFilterPanel Props

```typescript
interface RecipeFilterPanelProps {
  open: boolean;
  onClose: () => void;
  filters: RecipeFilterState;
  onApply: (filters: RecipeFilterState) => void;
  onReset: () => void;
}

interface RecipeFilterState {
  proteins: string[];           // multi-select
  categories: RecipeCategory[]; // multi-select
  cuisines: string[];           // multi-select
  difficulty: Difficulty | null;
  maxTime: number | null;       // minutes
  smartFilter: SmartFilter | null; // single-select
  sort: RecipeSortOption;
}

type SmartFilter = "highly_rated" | "havent_made" | "never_tried" | "recently_used";
type RecipeSortOption = "title" | "recently_cooked" | "prep_time" | "updated_at" | "rating";
```

### AddToMealPlanModal Props

```typescript
interface AddToMealPlanModalProps {
  open: boolean;
  onClose: () => void;
  recipeId: string;
  recipeTitle: string;
  recipeServings?: number | null;
}
```

### PageHeader Props

```typescript
interface PageHeaderProps {
  title: string;
  actions?: ReactNode;    // right side actions (Import, Add buttons)
  showAvatar?: boolean;   // default true on main pages
}
```

## Implementation Phases

| Phase | Name | Scope | Depends On | Key Outputs |
|-------|------|-------|------------|-------------|
| 1 | Header & Settings Relocation | PageHeader component, move Settings out of BottomNav | — | PageHeader.tsx, updated AppShell, Settings accessible via avatar |
| 2 | Adaptive Bottom Nav | 3-tab pill nav + search icon, morph animation, collapsed state | Phase 1 | Rewritten BottomNav.tsx with Framer Motion layoutId |
| 3 | Search Page | Dedicated /search route with recipe search | Phase 2 | SearchPage.tsx, Search.tsx route, App.tsx update |
| 4 | Recipe Filter Panel | Slide-up filter sheet replacing carousels on browse page | — | RecipeFilterPanel.tsx, updated RecipeBrowser.tsx |
| 5 | Add to Meal Plan | Reusable modal for adding recipes to meal plan from any surface | — | AddToMealPlanModal.tsx, updated RecipeDetail, search integration |
| 6 | EntryPicker Enhancement | Wire up protein/cuisine/difficulty filters in meal plan's EntryPicker | Phase 4 | Updated EntryPicker.tsx |
| 7 | Polish & Cleanup | Remove dead code, test all flows, fix edge cases | Phases 1-6 | SmartBrowse.tsx deleted, RecipeCarousel.tsx deleted, all routes tested |

### Critical Path
Phases 1 → 2 → 3 are sequential (header must exist before nav rework, nav must morph before search page makes sense). Phases 4, 5 can be built in parallel with the nav work. Phase 6 depends on the filter patterns established in Phase 4. Phase 7 is final cleanup.

### Phase Details
- [Phase 1: Header & Settings Relocation](phases/phase-1.md)
- [Phase 2: Adaptive Bottom Nav](phases/phase-2.md)
- [Phase 3: Search Page](phases/phase-3.md)
- [Phase 4: Recipe Filter Panel](phases/phase-4.md)
- [Phase 5: Add to Meal Plan Modal](phases/phase-5.md)
- [Phase 6: EntryPicker Enhancement](phases/phase-6.md)
- [Phase 7: Polish & Cleanup](phases/phase-7.md)

## Tech Stack

| Category | Choice | Notes |
|----------|--------|-------|
| Animation | Framer Motion (`layoutId`, `AnimatePresence`) | Already in use; powers the morph transition |
| Routing | React Router 7 | Search page is a real route, nav state derived from pathname |
| State | TanStack Query + local useState | Filters are local component state; results are query-cached |
| Styling | Tailwind CSS 4 | Existing design system, garnish color palette |
| Icons | Lucide React | Consistent with existing icon usage |

## Future Considerations

- **Global search**: Extend search to meal plan entries, grocery items, collections (currently recipe-only)
- **Search history / suggestions**: Recent searches, popular in household, auto-suggestions
- **Backend smart_filter param**: Move smart filter logic server-side for better performance at scale
- **Visual re-theme**: Color palette and typography refresh, planned as a separate initiative
- **Keyboard navigation**: Full keyboard accessibility for filter panel and search
