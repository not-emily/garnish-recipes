# Phase 3: UX Polish

> **Depends on:** Phase 1 (mutation/pending patterns used across updates)
> **Enables:** Smoother day-to-day use; lower "feels broken" background noise
>
> See: [Full Plan](../plan.md)

## Goal

Clean up the sharp edges that have shown up in a week of real usage: nav sizing and dead-zones, the weird slide-to-delete gesture on grocery items, missing filter and scroll persistence on back-navigation, and the intermittent iOS input zoom. Small individually, meaningful as a set.

## Key Deliverables

### Sub-phase 3A — Bottom Nav Sizing & Tap Targets
- Increase bottom nav height — current sizing feels cramped on mobile
- Add bottom padding below the nav (safe-area-inset-bottom) so it doesn't sit at the absolute edge of the phone screen
- Eliminate the dead zone between the nav pill group and the search icon — taps in the gap should hit the closest target, not no-op
- Verify touch target sizes meet 44pt iOS minimum

### Sub-phase 3B — Grocery Slide-to-Delete Gesture
- Current gesture drifts up as it slides left, producing a visible arc
- Cause: likely a transform animation that includes a Y-translation or a rotational component from Framer Motion
- Fix: constrain the swipe motion to the X-axis only; reset any Y-transform on drag end
- Verify swipe-to-check (the opposite direction) has the same clean behavior

### Sub-phase 3C — Recipe Filter & Scroll Persistence
- When user navigates from recipe browse → recipe detail → back, restore:
  - Applied filters (protein, category, cuisine, difficulty, time, sort, smart filter)
  - Scroll position in the recipe grid
- Implementation: encode filter state in URL search params (already partially done?), and use browser-native scroll restoration; if React Router's scroll restoration is off, opt back in for specific routes
- Alternative: use `sessionStorage` keyed by a stable ID for filter + scroll state on the recipes index

### Sub-phase 3D — Mobile Input Zoom Verification
- Global `font-size: 16px` on inputs was added in the 2026-04-13 session to fix iOS Safari auto-zoom
- User reports it's intermittent — sometimes zooms, sometimes doesn't; couldn't reliably reproduce
- Verify the fix is still applied (check `frontend/src/index.css` or wherever it was added)
- Check that it applies to the installed PWA context as well as Safari browser (iOS PWA inherits from the index styles)
- Hypothesis: certain inputs may have `font-size` overridden by Tailwind utility classes later in the cascade; audit inputs + textareas for `text-sm`/`text-xs` utilities that could shrink below 16px
- If still reproducible, add a specific PWA test case to the runbook

### Sub-phase 3E — Store Sorting Reliability
- User reports "auto store sorting doesn't seem to work for grocery list items, or maybe there's a delay"
- Hypothesis: the sort *does* work, but the pending state on add was invisible (see Phase 1 fixes). If the backend categorizes/tags the item during the create request, an optimistic add would show it uncategorized for the optimistic window, then snap to the right store after the response
- Verify after Phase 1 ships: if still reported, audit the grocery list backend to see whether categorization happens synchronously in the `create` action or via a GoodJob (delay would confirm the latter)
- If async, either make synchronous or surface "categorizing…" state in the UI

## Files to Create

- `docs/runbooks/ios-pwa-input-zoom.md` — short note if 3D turns up a reproducible case

## Files to Modify

- `frontend/src/components/layout/BottomNav.tsx` — sizing, padding, dead-zone fix (3A)
- `frontend/src/components/grocery/GroceryItemList.tsx` (or wherever swipe gesture lives) — constrain to X-axis (3B)
- `frontend/src/components/recipes/RecipeBrowser.tsx` — URL-encoded filter state, scroll restoration (3C)
- `frontend/src/hooks/useRecipeFilters.ts` (may need creating) — central hook for filter state sync with URL
- `frontend/src/index.css` or `tailwind.config.ts` — verify/reinforce `font-size: 16px` rule on inputs (3D)
- `backend/app/controllers/api/v1/grocery_items_controller.rb` + `GroceryItem` model — verify store tagging is sync (3E)

## Dependencies

**Internal:** Phase 1 — pending-state patterns used in 3E; optimistic update visuals factor into 3E's "is the delay real or illusory" question.

**External:** None.

## Implementation Notes

### Bottom Nav Sizing (3A)

Check current values:
- Height: if it's `h-14` (56px), bump to `h-16` (64px) or `h-[68px]` for more breathing room
- Bottom padding: wrap nav in `pb-[env(safe-area-inset-bottom)]` so it sits above the home indicator on iPhone
- Icons/labels: verify text + icon contrast, consider slightly larger icons (`h-6` instead of `h-5`)

Dead-zone fix approach: the nav currently has (pill group | gap | search button). Make the pill group, gap, and search button share a flex row where the gap is a flex-1 spacer that doesn't capture clicks, OR extend click targets so a tap in the gap finds the nearest button via event delegation. Simpler: wrap the entire nav in a `onPointerUp` handler that, if the target is the container (not a child button), dispatches to the nearest button based on x-position.

Or even simpler: make the gap a `<button>` that navigates to the primary tab (Recipes) — explicit default behavior rather than "find nearest."

Pick the simpler approach first; revisit if the behavior still feels off.

### Slide-to-Delete Fix (3B)

Find the Framer Motion component (likely in `GroceryItemList.tsx` or a subcomponent). Current probable shape:

```tsx
<motion.div
  drag="x"
  dragConstraints={{ left: -100, right: 0 }}
  animate={{ x: swipeX }}
  ...
>
```

The "up" drift suggests one of:
- A rotation is being applied based on drag progress (rotates the card, making it appear to lift)
- `y` transform is being added somewhere (look for `animate={{ y: ... }}` or gesture logic that modifies `y`)
- The parent flex container is causing a layout shift when the sibling shrinks during the swipe

Fix: verify `drag="x"` (not `drag` which allows both axes), explicitly set `y: 0` in animate/style, and ensure no rotational transform is applied during drag.

### Recipe Filter/Scroll Persistence (3C)

Current state (need to verify): the nav/search rework (v2) added URL param sync for the search page but may not have fully extended it to the recipes browse page. Check `RecipeBrowser.tsx` for how filters are stored.

Preferred approach:
- All filter state encoded in URL search params (`?protein=chicken&category=entree&sort=recently_cooked`)
- React Router's default scroll behavior is to jump to top on navigation; for the recipes route, use `<ScrollRestoration />` (React Router v7) or a custom scroll manager that remembers the scroll position by `location.key`
- On back-navigation, URL state restores filters; ScrollRestoration restores position

If the filter state is in `useState` only, refactor to a custom `useRecipeFilters` hook that reads/writes `URLSearchParams` via `useSearchParams`. This makes the state linkable, shareable, and back-button-friendly for free.

### Mobile Input Zoom (3D)

The existing fix should look like this in `index.css`:

```css
input, textarea, select {
  font-size: 16px;
}
```

Check for:
- Tailwind utilities like `text-sm` (14px) or `text-xs` (12px) applied to inputs — they'd override the global rule due to higher specificity or source order
- `@apply` uses on form components
- `<input>` elements inside custom components where a Tailwind text-size utility is added

Quick audit: grep for `<input` and `<textarea` in components and look for any `text-sm`/`text-xs` classes.

### Store Sorting (3E)

Check `GroceryItem#create` and related: does the controller call a categorizer synchronously, or enqueue a job?

```ruby
# Probable sync path (good)
def create
  item = @list.items.create!(name: params[:name])
  item.update!(store_section: categorize(item.name))  # or a before_save callback
  render json: item
end

# Or async path (bad for UX)
def create
  item = @list.items.create!(name: params[:name])
  CategorizeGroceryItemJob.perform_later(item.id)
  render json: item
end
```

If async, either move to sync (if fast enough) or expose "categorizing…" state in the UI so it doesn't look broken.

## Validation

- [ ] Bottom nav is visibly taller; adequate bottom padding on iPhone with home indicator
- [ ] Tapping in the gap between nav pill and search icon hits a sensible target (not no-op)
- [ ] Swiping grocery item left: smooth horizontal motion, no vertical drift or rotation
- [ ] Swiping grocery item right (if that's check-off direction): same clean behavior
- [ ] Apply filters on recipes page → tap a recipe → press back → filters and scroll position restored
- [ ] Reload the recipes page with filter params in URL → filters are applied on load
- [ ] Verified input font-size: 16px rule is still present and covers all inputs/textareas/selects in the app
- [ ] No inputs have a text-size class smaller than `text-base` (16px)
- [ ] Added/confirmed grocery items appear in the correct store section immediately (or with visible "categorizing…" state)
