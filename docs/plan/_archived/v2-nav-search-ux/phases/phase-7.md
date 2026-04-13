# Phase 7: Polish & Cleanup

> **Depends on:** Phases 1-6 (all features must be in place)
> **Enables:** None (this is the final phase)
>
> See: [Full Plan](../plan.md)

## Goal

Remove dead code, integrate remaining cross-cutting features, test all navigation flows end-to-end, and fix edge cases discovered during implementation.

## Key Deliverables

- Delete `SmartBrowse.tsx` and `RecipeCarousel.tsx` (no longer used)
- Remove any unused imports, dead CSS, or orphaned components
- "Add to Meal Plan" action on search result cards (if not done in Phase 5)
- Filter panel accessible from search page (shared component from Phase 4)
- End-to-end testing of all navigation flows
- Fix any animation glitches, z-index issues, or accessibility gaps

## Files to Delete

- `frontend/src/components/recipes/SmartBrowse.tsx` — replaced by filter panel
- `frontend/src/components/recipes/RecipeCarousel.tsx` — no longer used (verify no other consumers first)

## Files to Modify

- Various — based on issues discovered during testing

## Dependencies

**Internal:** All previous phases complete.

**External:** None.

## Implementation Notes

### Cross-Feature Integration

1. **Search + Filter Panel**: The search page should have access to the filter panel from Phase 4. Either render RecipeFilterPanel on the search page too, or make the filter button available in the collapsed nav bar. Decision during implementation based on what feels right.

2. **Search + Add to Meal Plan**: Recipe cards on the search results page should have an "Add to Meal Plan" quick action. Options:
   - Add a small `CalendarPlus` icon button to `RecipeCard` (visible on hover/always)
   - Long-press / context menu on mobile
   - Add an overflow menu (three dots) on each card with "Add to Meal Plan" and "Add to Collection" options

3. **Collections tab**: The `RecipePageTabs` currently toggles between "Browse" and "Collections" on the Recipes page. Verify this still works correctly with the new filter panel and that collections route matching is correct with the new nav.

### Navigation Flow Testing

Test these complete flows:

1. **Recipes → Search → back**: Tap search, type query, tap back icon → returns to Recipes
2. **Meal Plan → Search → back**: Same but from Meal Plan tab
3. **Grocery → Search → back**: Same but from Grocery tab
4. **Search → Recipe Detail → back**: Tap a search result, view recipe, tap back → returns to search with query preserved
5. **Recipe Detail → Add to Meal Plan → Meal Plan**: Add recipe to plan, then navigate to meal plan → entry is there
6. **Deep link to /search?q=chicken**: Direct URL access works, shows results, collapsed nav
7. **Browser back/forward**: Full history navigation works correctly
8. **Settings → back**: Avatar → Settings → back → returns to previous tab

### Animation Polish

- Verify morph animation timing feels right (not too fast, not too slow — aim for 300-400ms)
- Check that `layoutId` transitions don't cause content below the nav to jump
- Verify AnimatePresence exit animations don't leave ghost elements
- Test on slow devices / throttled CPU to ensure no jank

### Accessibility Audit

- All interactive elements have visible focus indicators
- Search input has proper `aria-label` and `role="search"` wrapper
- Filter panel is accessible via keyboard (tab through pills, enter to toggle)
- Screen reader announces filter changes
- Back button in collapsed nav has descriptive `aria-label`

### RecipeCardCompact Check

Verify `RecipeCardCompact.tsx` is still used somewhere (it was used by carousels). If nothing references it after carousel deletion, delete it too.

## Validation

- [ ] `SmartBrowse.tsx` and `RecipeCarousel.tsx` are deleted, no import errors
- [ ] No unused imports or dead code from the old nav/browse system
- [ ] All 8 navigation flows listed above work correctly
- [ ] Morph animation is smooth on mobile Safari, Chrome, and desktop
- [ ] Filter panel works from both the recipe browse page and optionally the search page
- [ ] "Add to Meal Plan" works from recipe detail and search results
- [ ] Collections tab still works correctly on the Recipes page
- [ ] No z-index conflicts between bottom nav, filter panel, modals
- [ ] Keyboard navigation works through all new UI elements
- [ ] No console errors or React warnings in any flow
- [ ] PWA still works correctly (service worker, offline banner, install prompt)
