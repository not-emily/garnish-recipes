# Project Progress - Garnish

## Plan Files
Roadmap: [plan.md](../docs/plan/plan.md)
Current Phase: [phase-8.md](../docs/plan/phases/phase-8.md)
Latest Weekly Report: [weekly-2026-W15.md](../docs/reports/weekly-2026-W15.md)
Latest Daily Report: [daily-2026-04-10.md](../docs/reports/daily-2026-04-10.md)

Last Updated: 2026-04-12

## Current Focus
Phase 8: Collections & Sharing — **complete** (all sub-phases A, B, C shipped and smoke-tested).

## Active Tasks
- [NEXT] Follow-up: re-trigger leftover prompt on servings_override change in EntryOptions
- [NEXT] Follow-up: imported recipe ingredient parsing (Phase 4 ingestion stores full text in name field without separating quantity/unit — breaks grocery aggregation)
- [NEXT] Phase 5C follow-up: debug mobile cross-week swipe bug (see Blockers)
- [NEXT] Follow-up: Image ingestion via vision (deferred from Phase 4)
  - ⏭ Upstream multi-modal content support to sage-rb
  - ⏭ ImageIngester for scanned cookbooks + direct image uploads
  - ⏭ Re-process action on needs_review recipes
- [NEXT] Follow-up: recipe detail source attachment download UI
- [NEXT] Follow-up: "Add to Meal Plan" shortcut from recipe detail page (date + slot picker modal)
- [NEXT] Follow-up: PDF export option for recipes/collections (alternative to JSON export)

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
  - 8A: Backend (migration, models, policy, controllers, 31 tests), Frontend (Collections page, CollectionDetail, CollectionCard, CollectionForm, AddRecipesModal, RecipePageTabs). UX: reusable ConfirmDialog (replaced all JS confirm() site-wide), flat grid, bottom nav fix, mobile remove buttons
  - 8B: GET /recipes/:apikey/collections endpoint, AddToCollectionModal (checklist + inline create), FolderPlus on RecipeDetail for all members
  - 8C: CollectionShare model + migration, share by email, list/revoke shares, leave collection, recipe copy with provenance note, JSON export, reusable DropdownMenu component. Cross-household recipe viewing via ?collection= param. Shared recipe detail shows "Copy to My Recipes" instead of edit/delete. 19 new sharing/copy/export tests (245 total)

## Next Session
1. **Phase 9** or next priority from the plan
2. **Add to Meal Plan shortcut** from recipe detail page
3. **Debug mobile cross-week swipe bug**
