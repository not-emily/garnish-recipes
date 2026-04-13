# Project Progress - Garnish

## Plan Files
Roadmap: None
Current Phase: None
Latest Weekly Report: [weekly-2026-W15.md](../docs/reports/weekly-2026-W15.md)
Latest Daily Report: [daily-2026-04-10.md](../docs/reports/daily-2026-04-10.md)

Last Updated: 2026-04-13


## Current Focus
**Nav/Search UX Rework complete!** Plan finished — all 7 phases shipped. Moving on to follow-up items and next initiatives.

## Active Tasks
- [NEXT] Follow-up: re-trigger leftover prompt on servings_override change in EntryOptions
- [NEXT] Follow-up: imported recipe ingredient parsing (Phase 4 ingestion stores full text in name field without separating quantity/unit — breaks grocery aggregation)
- [NEXT] Phase 5C follow-up: debug mobile cross-week swipe bug (see Blockers)
- [NEXT] Follow-up: Image ingestion via vision (deferred from Phase 4)
  - ⏭ Upstream multi-modal content support to sage-rb
  - ⏭ ImageIngester for scanned cookbooks + direct image uploads
  - ⏭ Re-process action on needs_review recipes
- [NEXT] Follow-up: recipe detail source attachment download UI
- [NEXT] Follow-up: PDF export option for recipes/collections (alternative to JSON export)
- [NEXT] Follow-up: visual re-theme as part of the navigation rework
- [NEXT] Follow-up: tutorial/coachmark system for new features and first-time users (spotlight tooltips, tracked per-user, re-triggerable on new feature launches)
- [NEXT] Follow-up: deeper accessibility audit (color contrast gray-400 → gray-500, focus-visible on all buttons, aria-live for real-time updates)
- [NEXT] Follow-up: image optimization (WebP, srcset) when user-uploaded recipe images are in use

## Open Questions/Blockers
- **Mobile cross-week swipe**: Swiping past Sunday/Monday on mobile single-day view doesn't advance the week. Desktop week nav buttons work.
- **Imported recipe ingredient quality**: Phase 4 ingestion stores full ingredient text in the `name` field (e.g. "2 lbs beef") instead of structured `{ name: "beef", quantity: 2, unit: "lbs" }`. This breaks grocery aggregation/dedup. Needs ingestion pipeline fix.

## Completed This Week
- ✅ Phase 5 sub-phase D smoke test passed (2026-04-11): ActionCable real-time meal plan sync verified end-to-end
- ✅ Phase 6: Leftovers — complete (2026-04-11)
  - Sub-phase A: LeftoverCalculator, linked leftover creation, LeftoverPrompt, LeftoverEntry visual
  - Sub-phase B: LeftoverTrayItem, LeftoversController, expiry, cascade delete, LeftoverTray, CascadeDeleteDialog, settings UI
  - Smoke test fixes: cross-week leftovers, tray merging, prompt UX, schedule popover, note double-submit, event notes icon, servings removal, image_url fix
- ✅ Phase 7: Grocery Lists — complete (2026-04-11)
  - Sub-phase A: GroceryGenerator, categorization, store tagging, 191/191 backend tests
  - Sub-phase B: GroceryListChannel, useGroceryList hook, full UI with real-time sync, permission-gated
  - Refactored to single rolling list, excluded_items tracking, smoke test fixes
- ✅ Phase 8: Collections & Sharing — complete (2026-04-12)
  - 8A-C: Collection CRUD, visibility, add-to-collection from recipe detail, cross-household sharing, recipe copy with provenance, JSON export, reusable ConfirmDialog + DropdownMenu components
- ✅ Phase 9: Ratings & Smart Browse — complete (2026-04-12)
  - 9A: Cooking tracking (MealPlanEntry after_commit), 9B: Per-member ratings with cached averages + RatingStars component, 9C: Smart browse sections (5 carousels on recipe browse page)
  - UX fixes: session bleed on logout, optimistic rating updates, mobile touch fix for star clearing
- ✅ Phase 10: Polish & PWA — complete (2026-04-12)
  - 10A: Lazy route loading (main bundle 647KB → 254KB, per-page chunks)
  - 10B: PWA manifest, manual service worker (cache-first assets, network-first API, SPA fallback), PWA icons, meta tags, install prompt hook + Settings button
  - 10C: Custom Toast component (swipe-up-to-dismiss), ErrorBoundary, OfflineBanner, page enter transitions, toast integration on key mutations
  - 10D: Pull-to-refresh (arrow indicator + smooth collapse), swipe-to-check + swipe-to-delete on grocery items (removed X button), skip-to-content link, aria-label on nav

- ✅ Nav/Search UX Rework — all 7 phases complete (2026-04-13)
  - Phase 1: Header & Settings Relocation
  - Phase 2: Adaptive Bottom Nav (pill + layoutId morph)
  - Phase 3: Search Page (/search, URL param sync, discovery carousels)
  - Phase 4: Recipe Filter Panel (slide-up sheet, smart filters, filter chips)
  - Phase 5: Add to Meal Plan Modal (date+slot picker, leftover integration)
  - Phase 6: EntryPicker Enhancement (protein filter pills)
  - Phase 7: Polish & Cleanup (dead code, BottomNav fixes, RecipeCard/RecipeDetail/Search refinements, deploy script hardening)

## Next Session
1. **Visual re-theme** as part of nav rework
2. **Tutorial/coachmark system** for first-time users and new features
3. **Debug mobile cross-week swipe bug**
4. **Fix imported recipe ingredient parsing** (Phase 4 ingestion quality)
5. **Re-trigger leftover prompt** on servings_override change
