# Weekly Report - Garnish - Week of 2026-04-20 (ISO Week 17)

## Week Overview
A four-phase post-MVP plan ("Stabilization, Polish & Sharing") landed end-to-end inside three working days. Phases 1 and 2 (frontend resilience, backend stability) shipped on 2026-04-22; Phase 3 (UX polish) shipped the same day with a follow-up swipe fix on 2026-04-24; Phases 4A/4B/4C (sharing, my-rating sort, cook-tracking) all shipped together on 2026-04-24. The plan was archived to `_archived/v3-post-mvp-1/` and the working tree returned to "no active phase" by week's end.

## Key Accomplishments

### Connection Resilience & Honest UI (Phase 1, 2026-04-22)
- API client error taxonomy (`auth | client | transient | offline`); only 401 clears auth — fixed the "random logout" bug that was actually transient 5xx storms being handled by the auth-clear path
- `connectionState.ts` module via `useSyncExternalStore`; OfflineBanner expanded to cover sustained 5xx/timeouts, not just `navigator.onLine`; new `ConnectionIndicator` pill for cable disconnect
- `useOptimisticMutation` helper standardizes the pending-update + rollback + retry-toast pattern; grocery + rating mutations migrated; `_pending` flag visible on `GroceryListItem`
- `MutationButton` component for consistent pending/disabled/spinner state on mutation triggers; grocery Add, recipe delete/copy migrated
- Sort fixes: backend `NULLS LAST` + title tiebreak (eliminates "recently edited shows at top" surprise); frontend sends `sort=recently_cooked` explicitly; cable handler drops malformed payloads + skips own-echo invalidate

### Backend Stability (Phase 2, 2026-04-22)
- Diagnosed root cause of intermittent unavailability: DB pool tied to `RAILS_MAX_THREADS=3`, but GoodJob alone uses 5 threads → background work was exhausting the pool and causing 5xx storms
- Puma: 5 threads, `preload_app!`, worker-boot DB reconnect hook, `WEB_CONCURRENCY` env-overridable (default 1 for the shared MacBook)
- `database.yml` decoupled from `RAILS_MAX_THREADS` — explicit `pool: 20` (env-overridable via `DB_POOL`), `checkout_timeout: 10`
- Cable process separation **skipped** (correctly) at current scale; revisit only if /health shows Puma pool pinned at 0
- `GET /api/v1/health` returns structured status (DB pool, GoodJob mode, cable count, Puma stats, RSS, commit SHA); `scripts/check-health.sh` for shell use
- `docs/runbooks/backend-outage.md` — symptom → diagnostic → fix flow, including log fingerprints for pool exhaustion, GoodJob stuck, CF Tunnel drop, mac sleep, memory pressure

### UX Polish (Phase 3, 2026-04-22 + 04-24 follow-ups)
- **Bottom nav:** larger touch targets (`h-10 → h-11`), safe-area bottom padding, `pointer-events-none/auto` to eliminate the dead-zone between nav pill and search icon
- **Grocery swipe gesture:** Framer Motion `drag="x"` was *still* writing a y delta proportional to x — fixed by making `y` a real `useMotionValue(0)` and pinning it via per-tick `onDrag` reset. Documented in component header; load-bearing
- **Filter + scroll persistence:** initial URL-param approach reverted on 2026-04-24 in favor of `localStorage` ("Option B") — in a PWA, back-nav frequently uses hard-coded `Link` rather than `navigate(-1)`, so URL state was being dropped. `localStorage` keyed `garnish:recipeFilters:v1` survives any nav pattern + tab close
- **iOS input zoom:** `font-size: 16px !important` on inputs/textareas/selects (sub-16px triggers mandatory iOS zoom); real-device verification still pending
- **Store/category categorization:** plural-mismatch fix in `categorizeIngredient` (regex now accepts optional `s|es` suffix). Surfaced an open follow-up: the *separate* learned-mapping system (`IngredientCategoryMapping`) isn't applied in manual-add — only during meal-plan-to-grocery generation

### Link-Based Recipe Sharing (Phase 4A, 2026-04-24)
- `share_token` column with partial unique index where not null; `Recipe#generate_share_token!` (collision-avoiding) and `#revoke_share_token!`
- `RecipesController#share` / `#unshare` — admin+ only; share is idempotent (existing token returned), revoke nulls (next share generates fresh)
- New `SharedRecipesController` deliberately split: `require_household` for `copy`, `set_optional_household` for public `show`, instead of `HouseholdScoped` at class level (would have 401'd anonymous viewers)
- Public `/r/shared/:token` page mounted outside `ProtectedRoute`; three CTA branches based on `can_copy`/`isAuthenticated` ("Add to my recipes" / "Complete setup" / "Sign up to save")
- `ShareRecipeDialog` sheet modal with `navigator.clipboard.writeText` + toast fallback for insecure contexts
- 17 new tests across `recipes_controller_test.rb` and `shared_recipes_controller_test.rb`
- **User-testing bug fixed mid-day:** the share page fetched before `AuthContext` had restored the access token from the refresh cookie, so authenticated users saw "Complete setup." Fixed by gating the query on `useSessionLoading()` and including `isAuthenticated` in the query key

### My-Rating Sort (Phase 4B, 2026-04-24)
- Backend `sort=my_rating` case in `RecipesController#sort_scope` — LEFT JOIN restricted to current user's `recipe_ratings` (user_id parameter-bound via `connection.quote`); ordered `score DESC NULLS LAST, recipes.title ASC`
- Frontend "My Rating" added to sort dropdown + active-sort chip
- **Simplification:** plan called for both filter chips (My Favorites / Not Rated by Me) AND a sort. After implementing both, scrapped the chips — sort already surfaces favorites at top and unrated at bottom (NULLS LAST), which covers the personal-library workflows. Removed `MyRatingFilter` type, scopes, query param, filter section, and two tests. Net: less surface, same workflows

### Cook-Tracking Correctness + Stats Surface (Phase 4C, 2026-04-24)
- Existing `MealPlanEntry#update_recipe_cooking_stats` after_commit trigger was correct-but-incomplete: guards `date <= Date.current` correctly on create + recomputes on destroy, but nothing fires when a future-dated entry's date *passes*
- `TallyCooksJob`: idempotent SQL `UPDATE recipes FROM (SELECT … FROM recipes LEFT JOIN meal_plan_entries …)` re-derives `times_cooked` and `last_cooked_at` from current entries. Only touches rows where computed values actually changed (via `IS DISTINCT FROM`). Self-heals across downtime; safe to skip days. GoodJob cron `0 2 * * *`, disabled in test
- Backfill migration runs the same SQL on deploy for Day-1 correctness
- 6 new job tests + 8 existing model tests
- `formatRelativeDate` helper in `weekUtils.ts` (today / yesterday / N days ago / etc.) + subtle `CookStats` line on `RecipeDetail`, hides when never cooked
- **Side effect:** resolved the long-standing "default sort looks alphabetical" observation — backend default sort is `last_cooked_at DESC NULLS LAST, title ASC`; pre-backfill, most recipes had NULL last_cooked_at and fell through to title

### Operational Close-Out (2026-04-24)
- Plan archived: `docs/plan/plan.md` + `docs/plan/phases/` → `_archived/v3-post-mvp-1/` via `git mv` (preserves history)
- `PROJECT_PROGRESS.md` Plan Files section pointed to `None`
- Production build fix (`48182ff`) — type-system errors latent since Phase 1 had been masked by the project-references stub; surfaced and fixed when Cloudflare Pages ran the real `tsc -b`

## Decisions This Week

No new entries appended to `DECISIONS.md` — implementation-level calls were captured in commit messages and `PROJECT_PROGRESS.md`. The notable ones:

1. **Only 401 clears auth** — every other status (transient 5xx, timeout, network) keeps the session alive. Eliminated the "random logout" symptom-class outright.
2. **Mutations never auto-retry; only GETs do** — auto-retried mutations risk double-writes (the rapid-tap grocery add bug, only worse). Manual retry preserves user intent.
3. **`localStorage` for filter persistence (not URL params)** — PWA back-nav frequently uses hard-coded `Link`, dropping URL params. Trades shareable URLs (not a real use case here) for sticky filters that survive any nav pattern.
4. **Kept the `MealPlanEntry` after_commit cook-stats trigger** despite phase-4.md saying "remove" — it was correct-but-incomplete, not wrong. Nightly job fills the time-passing gap; trigger keeps retroactive-log + immediate-destroy feedback latency-free.
5. **Opt-in share tokens, not always-on** — explicit "Share" action generates a nullable token; revoke nulls; next share generates fresh. Matches Notion/Google Docs mental model; no "secretly public" anxiety.
6. **Scrapped the my-rating filter chips after implementing them** — the sort surfaces favorites + unrated correctly via NULLS LAST. Less surface, same workflows. Discipline of "remove what isn't pulling weight."

## Challenges Encountered

- **Grocery swipe vertical drift** — despite `drag="x"`, Framer Motion's drag pipeline was writing a y value proportional to x delta. Literal `y: 0` in style is a static initial value, not a binding. Fix: real `useMotionValue(0)` for y, pinned via `onDrag` per-tick reset. Documented in component header so it doesn't get "cleaned up" later.
- **URL filter persistence broke PWA back-nav** — many "back to recipes" paths use `Link to="/recipes"` instead of `navigate(-1)`, so URL params were getting dropped on every back-nav. Reverted to `localStorage`. Lesson: in a PWA, treat filters as a setting, not a query.
- **Production build had latent type errors** — Phase 1 introduced TS issues that local `tsc --noEmit` didn't catch (project-references stub) but Cloudflare Pages' `tsc -b` did. Cost a deploy cycle. Memory note added: always use `npm run build` for typecheck verification, not `tsc --noEmit`.
- **Share page CTAs flashed wrong state** — fetched before `AuthContext` had restored access token, so authenticated users briefly saw "Complete setup." Fixed by gating on `useSessionLoading()` and adding `isAuthenticated` to the query key.
- **Cook-tracking trigger was correctly identified as incomplete only after re-reading** — phase-4.md was written under an outdated assumption that the trigger was wrong. Pause-and-verify saved a regression.

## Metrics

- **Commits:** 9 on the post-mvp-1 plan (5e7ac21 through f644b2e), spanning planning, all four phases, the production build fix, and the daily report
- **Phases shipped:** 4 (Phases 1, 2, 3, plus 4A/4B/4C as a unified Phase 4)
- **Backend tests:** +21 (302 passing total at week's end)
- **Migrations deployed:** 2 (`backfill_cook_stats`, `share_token` + partial unique index)
- **New cron:** 1 (`TallyCooksJob` at 2am daily)
- **Days from plan-start to plan-archive:** 3 (2026-04-22 → 2026-04-24)

## Next Week Priorities

The plan is closed; next-session work picks from open follow-ups and the backlog:

1. **Real-device iOS verification** — the 16px input-zoom fix and grocery swipe gesture both shipped without iPhone confirmation. Worth a phone smoke pass before declaring Phase 3 fully done.
2. **`/health` baseline run** — execute `scripts/check-health.sh` against production after a normal-load period, capture pool/memory/cable counts to validate the Phase 2 sizing assumptions.
3. **Manual-add store auto-assign** — ~5-line fix to consult `IngredientCategoryMapping` in `GroceryListsController#add_item`. Tracked as an Open Question; standalone PR.
4. **Mutation-button audit** — migrate meal-plan/import/collection mutations to `useOptimisticMutation` + `MutationButton` for consistent pending/error UX. Not urgent; current ones are functional but inconsistent.
5. **Pick from backlog** — recipe images, cooking mode, fraction support, "what's on the menu" banner, instruction sections, etc. The next planned initiative starts here.
