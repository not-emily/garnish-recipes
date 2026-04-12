# Project Progress - Garnish

## Plan Files
Roadmap: [plan.md](../docs/plan/plan.md)
Current Phase: [phase-7.md](../docs/plan/phases/phase-7.md)
Latest Weekly Report: [weekly-2026-W15.md](../docs/reports/weekly-2026-W15.md)
Latest Daily Report: [daily-2026-04-10.md](../docs/reports/daily-2026-04-10.md)

Last Updated: 2026-04-11

## Current Focus
Phase 7: Grocery Lists — **complete and smoke-tested**. Single rolling list per household with date-range generation, ingredient categorization with household mapping overrides, store tagging with auto-learn, permission-gated UI, real-time sync.

## Active Tasks
- [NEXT] Follow-up: re-trigger leftover prompt on servings_override change in EntryOptions
- [NEXT] Follow-up: imported recipe ingredient parsing (Phase 4 ingestion stores full text in name field without separating quantity/unit — breaks grocery aggregation)
- [NEXT] Phase 5C follow-up: debug mobile cross-week swipe bug (see Blockers)
- [NEXT] Follow-up: Image ingestion via vision (deferred from Phase 4)
  - ⏭ Upstream multi-modal content support to sage-rb
  - ⏭ ImageIngester for scanned cookbooks + direct image uploads
  - ⏭ Re-process action on needs_review recipes
- [NEXT] Follow-up: recipe detail source attachment download UI

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
  - Sub-phase A: GroceryList/GroceryListItem/IngredientCategoryMapping models, GroceryGenerator service (scaling, categorization with word-boundary + compound keywords, household mapping override, store auto-tagging, aggregation/dedup), GroceryListsController (CRUD + generate + permissions), GroceryListPolicy, 191/191 backend tests
  - Sub-phase B: GroceryListChannel, useGroceryList hook with ActionCable + 15s poll fallback, GroceryList page (category-grouped sections with emoji headers, check-off with optimistic updates, add item form with auto-categorize + auto-store from mappings, edit modal via row tap, X to remove, store pill filter with counts + disabled empty pills, inline store add, manage stores modal with rename/delete, clear checked, date-range generate modal), permission-gated UI (generate/add/check/edit/remove hidden per role)
  - Refactored to single rolling list per household (removed week isolation, date-range generation with from/to picker, generated_from/generated_to tracking)
  - Smoke test fixes: mobile button visibility, real-time sync (invalidate-on-broadcast, removed echo filter for idempotent ops), category heuristic (word boundaries, compound keywords, removed "chop" from meat), stale item removal on regeneration, excluded_items tracking (deleted items don't return on regenerate), full-access members can generate, store add endpoint with grocery permissions, auto-store from mappings in add form

## Next Session
1. **Phase 8** or next priority from the plan
2. **Debug mobile cross-week swipe bug**
3. **Fix imported recipe ingredient parsing** (Phase 4 ingestion quality)
