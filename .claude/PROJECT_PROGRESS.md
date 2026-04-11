# Project Progress - Garnish

## Plan Files
Roadmap: [plan.md](../docs/plan/plan.md)
Current Phase: [phase-5.md](../docs/plan/phases/phase-5.md)
Latest Weekly Report: [weekly-2026-W15.md](../docs/reports/weekly-2026-W15.md)
Latest Daily Report: [daily-2026-04-10.md](../docs/reports/daily-2026-04-10.md)

Last Updated: 2026-04-10

## Current Focus
Phase 5: Meal Planning — sub-phases A+B+D shipped. Sub-phase C smoke-tested with one known bug (mobile cross-week swipe). Sub-phase D (ActionCable real-time sync) smoke-tested end-to-end 2026-04-11: all four broadcast types (create/update/destroy/reorder) propagate correctly tab-to-tab. Ready for Phase 6.

## Active Tasks
- [IN PROGRESS] Phase 5: Meal Planning
  - ✓ Sub-phase A: Core CRUD grid (desktop/tablet)
  - ✓ Sub-phase B: Entry variety + per-entry settings + UX polish
  - ⏳ Sub-phase C: Mobile experience + drag-and-drop — **smoke-tested, one known bug**
    - ✓ Desktop drag-drop: same-slot reorder + cross-slot move working
    - ✓ Snap-back animation fixed: transition:null on useSortable, dropAnimation:null on DragOverlay, synchronous optimistic updates (removed async/await from onMutate), hidden original during drag (opacity:0)
    - ✓ Slot highlight covers entire slot area during drag (onDragOver tracks overSlotId, threaded through DayColumn → MealSlot)
    - ✓ Recipe detail link works after cancelled drag (click suppression via justDraggedRef)
    - ✓ Mobile swipe direction animation fixed (Framer Motion variants with custom prop instead of inline values)
    - ✓ Replaced long-press/tap-to-move with real drag-and-drop on mobile (TouchSensor 250ms delay, same DndContext pattern as desktop)
    - ✓ Edge-scrolling during drag: hold near viewport edge to advance day (window pointermove listener, self-rescheduling timer with 600ms initial / 800ms repeat)
    - ✓ Edge-scroll stops at week boundaries during drag (entry can't cross weeks)
    - ✓ Bottom sheets (EntryPicker, EntryOptions, ImportModal) z-index bumped to z-[60] so they render above the z-50 bottom nav
    - ✓ HTML entity decoding in recipe imports (CGI.unescapeHTML in normalizer string() method — fixes &#39; etc. from JSON-LD)
    - ✓ useMealPlan: placeholderData: keepPreviousData for smooth week transitions
    - ✓ onDragCancel handler clears stuck drag state
    - ✓ Render-time week change detection (replaces useEffect to avoid StrictMode double-fire)
    - 🚫 **Known bug**: mobile cross-week swipe navigation (Sunday→Monday, Monday→Sunday) doesn't work — likely a deeper interaction between Framer Motion drag, DndContext, and React state batching across parent/child components. Within-week day navigation works fine.
    - ✓ Tiny drag flash on same-slot reorder (cosmetic, livable)
    - ✓ 130/130 backend tests pass, vite build clean
  - ✓ Sub-phase D: Real-time sync via ActionCable — **smoke-tested 2026-04-11, all four broadcast types working**
    - ✓ ActionCable enabled (require "action_cable/engine" uncommented)
    - ✓ cable.yml with async adapter (single-server, no Redis per CLAUDE.md)
    - ✓ ActionCable mounted at /cable in routes.rb
    - ✓ ApplicationCable::Connection with JWT auth via query param (reuses JwtService.decode + User.find_by_apikey)
    - ✓ MealPlanChannel — household-scoped stream_for with lazy plan creation, rejects invalid week_start / users without household
    - ✓ MealPlansController broadcasts: entry_created, entry_updated, entry_destroyed, entries_reordered
    - ✓ Broadcast payloads include actor_apikey so the originating client can filter its own echoes (already has optimistic update)
    - ✓ 9 new channel tests: subscription auth (member allowed, non-member rejected, invalid date rejected, lazy creation) + 4 broadcast payload assertions — 139/139 backend tests passing
    - ✓ Frontend: @rails/actioncable + @types/rails__actioncable installed
    - ✓ Vite WebSocket proxy (/cable with ws:true)
    - ✓ src/lib/cable.ts — singleton consumer with lazy creation, token from getAccessToken(), resetConsumer on logout
    - ✓ useMealPlan subscription merges broadcasts into TanStack Query cache via applyBroadcast helper
    - ✓ Filters own broadcasts via actor_apikey === user.id (prevents double-apply with optimistic update)
    - ✓ resetConsumer() called from AuthContext on logout and session expiration
    - ✓ TypeScript clean, vite build clean
    - ✓ Smoke-tested 2026-04-11: two tabs as different household members, all four broadcast types (entry_created, entry_updated, entry_destroyed, entries_reordered) propagate in real-time with no double-apply on the acting tab
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

## Next Session
1. **Phase 6: leftover automation** — columns and household settings already in place from Phase 5's migration; build the UI and logic.
2. **Debug mobile cross-week swipe bug** — investigate why swiping past Sunday/Monday doesn't advance the week. Check if Framer Motion's onDragEnd fires at all at week boundaries. May need to decouple Framer Motion swipe from DndContext more cleanly.
