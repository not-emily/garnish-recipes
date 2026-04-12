# Project Progress - Garnish

## Plan Files
Roadmap: [plan.md](../docs/plan/plan.md)
Current Phase: [phase-8.md](../docs/plan/phases/phase-8.md)
Latest Weekly Report: [weekly-2026-W15.md](../docs/reports/weekly-2026-W15.md)
Latest Daily Report: [daily-2026-04-10.md](../docs/reports/daily-2026-04-10.md)

Last Updated: 2026-04-12

## Current Focus
Phase 8: Collections & Sharing — sub-phases A+B complete. Sub-phase C (cross-household sharing, recipe copy, bulk export) is next.

## Active Tasks
- [NEXT] Phase 8C: Cross-household sharing + recipe copy + bulk export
- [NEXT] Follow-up: re-trigger leftover prompt on servings_override change in EntryOptions
- [NEXT] Follow-up: imported recipe ingredient parsing (Phase 4 ingestion stores full text in name field without separating quantity/unit — breaks grocery aggregation)
- [NEXT] Phase 5C follow-up: debug mobile cross-week swipe bug (see Blockers)
- [NEXT] Follow-up: Image ingestion via vision (deferred from Phase 4)
  - ⏭ Upstream multi-modal content support to sage-rb
  - ⏭ ImageIngester for scanned cookbooks + direct image uploads
  - ⏭ Re-process action on needs_review recipes
- [NEXT] Follow-up: recipe detail source attachment download UI
- [NEXT] Follow-up: "Add to Meal Plan" shortcut from recipe detail page (date + slot picker modal)

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
- ✅ Phase 8B: Add-to-Collection from recipe detail (2026-04-12)
  - Backend: GET /recipes/:apikey/collections endpoint (returns user's collections with has_recipe flag), 2 new tests
  - Frontend: AddToCollectionModal (checklist toggle, inline new collection creation), FolderPlus button on RecipeDetail (visible to all members)
- ✅ Phase 8A: Collections CRUD + frontend (2026-04-12)
  - Backend: migration (recipe_collections + collection_recipes), RecipeCollection model, CollectionRecipe model, CollectionPolicy with visibility-aware scope, CollectionsController (CRUD), CollectionRecipesController (add/remove), routes, policy registry, 31 new tests (222 total passing)
  - Frontend: types, API client, Collections page, CollectionDetail page, CollectionCard, CollectionForm modal, AddRecipesModal, RecipePageTabs (Browse | Collections)
  - UX polish: reusable ConfirmDialog component (replaced all JS confirm() calls site-wide), flat collection grid (no section headers), bottom nav highlights Recipes for /collections paths, mobile-visible remove buttons (useMediaQuery pattern)

## Next Session
1. **Phase 8C**: Cross-household sharing, recipe copy, bulk export
2. **Add to Meal Plan shortcut** from recipe detail page
3. **Debug mobile cross-week swipe bug**
