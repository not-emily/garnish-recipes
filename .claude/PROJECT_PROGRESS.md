# Project Progress - Garnish

## Plan Files
Roadmap: [plan.md](../docs/plan/plan.md)
Current Phase: [phase-7.md](../docs/plan/phases/phase-7.md)
Latest Weekly Report: [weekly-2026-W15.md](../docs/reports/weekly-2026-W15.md)
Latest Daily Report: [daily-2026-04-10.md](../docs/reports/daily-2026-04-10.md)

Last Updated: 2026-04-11

## Current Focus
Phase 6: Leftovers — **complete and smoke-tested**. Both sub-phases A and B shipped and verified. Ready for Phase 7 (grocery lists).

## Active Tasks
- [NEXT] Phase 7: Grocery Lists
- [NEXT] Phase 5C follow-up: debug mobile cross-week swipe bug (see Blockers)
- [NEXT] Follow-up: Image ingestion via vision (deferred from Phase 4)
  - ⏭ Upstream multi-modal content support to sage-rb (Option C from the sub-phase B decision)
  - ⏭ ImageIngester that renders PDF pages → images for scanned cookbooks, and handles direct image uploads
  - ⏭ Re-process action on needs_review recipes so image PDFs uploaded today auto-process when vision lands
- [NEXT] Follow-up: recipe detail source attachment download UI
  - ⏭ Show attached source PDF on detail page with download link
  - ⏭ Signed URL via ActiveStorage routes

## Open Questions/Blockers
- **Mobile cross-week swipe**: Swiping past Sunday/Monday on mobile single-day view doesn't advance the week. Desktop week nav buttons work. Root cause suspected to be Framer Motion drag + DndContext interaction preventing the swipe gesture from completing at week boundaries. Needs investigation in a future session.

## Completed This Week
- ✅ Phase 5 sub-phase D smoke test passed (2026-04-11): ActionCable real-time meal plan sync verified end-to-end
- ✅ Phase 6: Leftovers — complete (2026-04-11)
  - Sub-phase A: LeftoverCalculator service, MealPlansController linked leftover creation, LeftoverPrompt with toggle + slot pickers, LeftoverEntry visual variant, useLeftoverCalculation hook
  - Sub-phase B: LeftoverTrayItem model + migration, LeftoversController (index/destroy/schedule), leftover_expiry_days setting, cascade delete with 409 confirmation, LeftoverTray component with schedule popover, CascadeDeleteDialog, HouseholdSettings expiry days UI, track_remaining signal
  - Smoke test fixes: cross-week leftover creation (entries go to correct MealPlan per date), tray items merged into one per source entry, leftover row X button + dynamic button count, schedule popover shows current+next week filtering past days, note double-submit prevention, event notes StickyNote icon, removed servings from entry cards, recipe edit no longer clobbers image_url
  - 163/163 backend tests, TypeScript + vite build clean

## Next Session
1. **Phase 7: Grocery Lists** — read phase-7.md and plan sub-phases
2. **Debug mobile cross-week swipe bug** — investigate Framer Motion drag + DndContext interaction at week boundaries
