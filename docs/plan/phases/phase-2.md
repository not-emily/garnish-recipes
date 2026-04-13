# Phase 2: Adaptive Bottom Nav

> **Depends on:** Phase 1 (header must be in place)
> **Enables:** Phase 3 (search page needs the collapsed nav state)
>
> See: [Full Plan](../plan.md)

## Goal

Rewrite the bottom navigation as an iOS 26-inspired adaptive nav: a rounded pill containing 3 tab icons with the active one highlighted, plus a separate search icon on the right. When the user navigates to `/search`, the nav morphs — the active tab's icon remains visible (as a back button), other tabs collapse out, and the search icon expands into a search bar.

## Key Deliverables

- Rewritten `BottomNav.tsx` with two visual states: **full** (3 tabs + search) and **collapsed** (1 tab + search bar)
- Nav state derived from `location.pathname` (full when on main tabs, collapsed when on `/search`)
- Framer Motion `layoutId` on shared elements for smooth morph animation
- Active tab highlighted with a pill/circle indicator
- Search icon on the right, separated from the main tab group
- In collapsed mode: active tab icon acts as back button (navigates to previous page), search bar is expanded and auto-focused
- Safe-area-inset support preserved for notched devices

## Files to Modify

- `frontend/src/components/layout/BottomNav.tsx` — full rewrite

## Dependencies

**Internal:** Phase 1 must be complete (Settings removed from nav items).

**External:**
- `framer-motion` — already installed, used for `motion`, `layoutId`, `AnimatePresence`
- `react-router` — `useLocation`, `useNavigate` for route-based state

## Implementation Notes

### Nav Structure (Full Mode)

```
┌─────────────────────────────────────────────────┐
│  ┌─────────────────────────────────┐    ┌───┐   │
│  │  [Recipes]  [MealPlan]  [Grocery] │    │ 🔍│   │
│  └─────────────────────────────────┘    └───┘   │
└─────────────────────────────────────────────────┘
```

- The 3 tabs are inside a rounded pill (bg-gray-100 or similar, rounded-full)
- Active tab has a highlighted background (bg-garnish-100 with garnish-600 icon/text)
- Search icon is in its own rounded circle, positioned to the right with a gap
- Icons only (no labels) to keep it compact — the pill shape + highlight is enough affordance

### Nav Structure (Collapsed Mode — on /search)

```
┌─────────────────────────────────────────────────┐
│  ┌───┐   ┌─────────────────────────────────┐    │
│  │ 📖│   │ 🔍 Search recipes...             │    │
│  └───┘   └─────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

- Previous active tab icon stays in its circle (acts as back button via `navigate(-1)`)
- Search bar expands from the search icon's position
- The morph animation: tab pills scale/fade out, search icon expands into bar

### layoutId Strategy

Key elements that need `layoutId` for the morph:

1. **The nav container** — `layoutId="nav-bar"` on the outer wrapper, so the overall shape transitions smoothly
2. **The search element** — `layoutId="nav-search"` on the search icon (full mode) and the search bar container (collapsed mode). This makes the search icon visually expand into the search bar.
3. **The active tab icon** — needs to persist and slide to the left position. Use `layoutId="nav-active"` on the active tab's circle in both modes.

Wrap both modes in a `LayoutGroup` to ensure Framer Motion correlates the `layoutId` elements across the two render branches.

### Route-Based State

```tsx
const { pathname } = useLocation();
const isSearchMode = pathname === "/search";
```

No local state needed. When the user taps the search icon, it's a `<Link to="/search">`. When they tap the back icon in collapsed mode, it's `navigate(-1)` to return to wherever they came from.

### Tracking the "Previous Page"

When on `/search`, we need to know which tab the user came from to show the correct icon. Options:
- Pass it via React Router's `location.state` when navigating to `/search`
- Derive it from `window.history` (fragile)
- Store it in a ref that updates whenever the user is on a main tab

**Recommended:** Pass via `location.state`:
```tsx
<Link to="/search" state={{ from: pathname }}>
```

Then in collapsed mode, read `location.state.from` to determine which icon to show. Default to the Recipes icon if state is missing (e.g., direct URL access to `/search`).

### Interaction Details

- Tapping a non-active tab in full mode navigates to that tab (standard nav)
- Tapping the search icon navigates to `/search`, triggering the morph
- Tapping the back icon in collapsed mode calls `navigate(-1)`
- The search input in collapsed mode auto-focuses on mount
- The search input value should be controlled by the SearchPage component (the nav bar's input is a visual element — actual search state lives in the page). Consider using a shared context or passing the input via the nav bar as a portal target.

### Search Input Ownership

The search bar in the collapsed nav is visually in the BottomNav but logically belongs to the SearchPage. Two approaches:

1. **Portal approach**: SearchPage renders its input into a portal target inside BottomNav
2. **Controlled via URL params**: The nav bar input updates `?q=` search params, which SearchPage reads

**Recommended:** URL search params. The nav bar input is a controlled component that reads/writes `?q=` via `useSearchParams`. The SearchPage also reads `?q=` for its query. This keeps them in sync without shared state or portals, and search terms survive page refreshes.

### Accessibility

- Nav container: `role="navigation"`, `aria-label="Main navigation"`
- In collapsed mode, the back icon button needs `aria-label="Back to [previous page]"`
- Search input needs proper `role="search"` or be wrapped in a `<form role="search">`

## Validation

- [ ] Bottom nav shows 3 tab icons (Recipes, Meal Plan, Grocery) in a pill + search icon on right
- [ ] Active tab has highlighted pill/circle indicator
- [ ] Tapping search icon navigates to `/search` with smooth morph animation
- [ ] On `/search`: only the previous tab's icon is visible (as back button) + expanded search bar
- [ ] Tapping back icon returns to the previous page
- [ ] Morph animation is smooth — no layout shift, no flash, no elements jumping
- [ ] `layoutId` transitions work on mobile Safari and Chrome
- [ ] Safe-area insets still work on notched devices
- [ ] Settings is not in the nav (confirmed from Phase 1)
- [ ] Direct navigation to `/search` (URL bar) works — shows collapsed nav with Recipes as default back icon
