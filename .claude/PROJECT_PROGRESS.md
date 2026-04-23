# Project Progress - Garnish

## Plan Files
Roadmap: [plan.md](../docs/plan/plan.md)
Current Phase: [phase-3.md](../docs/plan/phases/phase-3.md)
Latest Weekly Report: [weekly-2026-W16.md](../docs/reports/weekly-2026-W16.md)
Latest Daily Report: [daily-2026-04-13.md](../docs/reports/daily-2026-04-13.md)

Last Updated: 2026-04-22


## Current Focus
**Phases 1 and 2 shipped.** Frontend tolerates transient server issues (Phase 1) and backend config tuned for the MacBook server (Phase 2 — DB pool bumped from 3 → 20 to fix the most-likely outage root cause, Puma threads up to 5, /health endpoint + runbook for diagnosing the next incident). Next up: Phase 3 (UX Polish) or Phase 4 (Features) — can go in either order.

## Active Tasks
- [NEXT] Phase 3: UX Polish — nav sizing + dead-zone fix, slide-to-delete gesture, filter/scroll persistence, iOS input zoom verify, store-sort reliability
- [NEXT] Phase 4: Features — link-based recipe sharing, "my favorites"/"not rated by me" filters, cook-tracking fix + "Last made · Made N times" on recipe detail
- [NEXT] Follow-up: broader mutation-button audit — migrate meal plan, import, and collection mutations to `useOptimisticMutation` + `MutationButton` for consistent pending/error UX (not blocking; current ones are functional)
- [NEXT] Follow-up: after deploying Phase 2, run `scripts/check-health.sh` against the server to baseline pool/memory/cable counts under normal load; revisit Puma/pool sizing if the numbers suggest different constraints than expected

## Open Questions/Blockers
- **Mobile cross-week swipe**: Swiping past Sunday/Monday on mobile single-day view doesn't advance the week. Desktop week nav buttons work. → **Addressed in Phase 3**.
- **Imported recipe ingredient quality**: Phase 4 ingestion stores full text like "2 lbs beef" in the `name` field instead of structured `{ name, quantity, unit }`. Breaks grocery aggregation/dedup. → **Not in current plan's scope; tracked in backlog**.
- **Cook tracking counts at schedule time**: Phase 9A's `MealPlanEntry` `after_commit` increments `cook_count` on create rather than after the date passes. → **Addressed in Phase 4 via `TallyCooksJob`**.

## Completed This Week
- Phase 1: Connection Resilience & Honest UI (2026-04-22)
  - 1A: API client error taxonomy (`auth | client | transient | offline`) and only-401-clears-auth; `AuthContext` session restore retries on transient errors (the actual "random logout" fix — session was being cleared on any startup error); QueryClient defaults retry only transient GETs with backoff, mutations never auto-retry
  - 1B: `connectionState.ts` module using `useSyncExternalStore`; OfflineBanner expanded to trigger on sustained 5xx/timeouts, not just `navigator.onLine`; `ConnectionIndicator` pill for cable disconnect; api client + cable poll wired to report status; refresh-5xx no longer triggers false logout
  - 1C: `useOptimisticMutation` helper (optimistic update with rollback closure, error toast with Retry action, `cancelKeys` to prevent refetch races); Toast extended with optional action button; grocery mutations + rating mutation migrated; `_pending` flag on `GroceryListItem` + pending-opacity visual
  - 1D: `MutationButton` component (pending + disabled + spinner + pointer-events-none); grocery Add button migrated; success toast on add; delete/copy recipe migrated
  - 1E: Backend sort uses `NULLS LAST` + title tiebreak (fixes "recently edited shows at top" complaint); frontend sends `sort=recently_cooked` explicitly; cable handler drops malformed payloads and skips invalidate on own-echo (was double-applying with optimistic state); grocery add form stays open + clears inputs on success, Enter submits
- Phase 2: Backend Stability (2026-04-22)
  - 2A (diagnosis): Baseline captured from committed config. Found the likely root cause of intermittent outages — DB pool was tied to `RAILS_MAX_THREADS` (3 by default), but GoodJob alone uses 5 threads. Any concurrent background job would exhaust the pool and cause 5xx storms that looked like "random" unavailability.
  - 2B (tuning): Puma configured with 5 threads + `preload_app!` + worker-boot DB reconnect hook; `WEB_CONCURRENCY` env-overridable (defaults to 1 for the shared MacBook). `database.yml` decoupled from RAILS_MAX_THREADS — explicit `pool: 20` (env-overridable via `DB_POOL`) + `checkout_timeout: 10`.
  - 2C (process separation): **Skipped.** At Garnish's scale (< 10 concurrent users, 2–3 typical cable connections), async ActionCable shares Puma cheaply. Revisit only if cable subscription count grows and /health shows Puma pool capacity pinned at 0 with healthy DB.
  - 2D (health logging): `GET /api/v1/health` returns structured status — DB reachability, pool size/busy, GoodJob mode, cable connection count, Puma stats, RSS memory, commit SHA. `scripts/check-health.sh` curls it and exits non-zero on failure. Test coverage added.
  - 2E (runbook): `docs/runbooks/backend-outage.md` — symptoms users see, diagnostic commands over Tailscale, common causes with log fingerprints (pool exhaustion, GoodJob stuck, CF Tunnel drop, mac sleep, memory pressure), restart procedures.

## Backlog (Out of Current Plan)
Preserved from prior "Next Session" list; revisit after the current 4-phase plan ships:

- Recipe images (add/edit)
- Cooking mode — toggle between recipes in a meal slot while cooking
- Quick filter pills on recipe browse (outside the full filter panel)
- Fraction support for ingredient quantities (⅔, 1½, etc.)
- "What's on the menu" banner showing today's meal plan on the recipe browse page
- Visual re-theme as part of the navigation rework
- Tutorial/coachmark system for first-time users and new features
- Password strength validation
- Google OAuth sign-in option
- Settings page UI cleanup
- Instruction sections/groups on recipes (mirror ingredient_groups pattern)
- Re-trigger leftover prompt on `servings_override` change in EntryOptions
- Imported recipe ingredient parsing (structured quantity/unit/name split)
- Image ingestion via vision (needs upstream sage-rb multi-modal support)
- Recipe detail source-attachment download UI
- PDF export option for recipes/collections
- Deeper accessibility audit (contrast, focus-visible, aria-live)
- Image optimization (WebP, srcset) for user-uploaded recipe images
