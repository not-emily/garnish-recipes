# Project Progress - Garnish

## Plan Files
Roadmap: None
Current Phase: None
Latest Weekly Report: [weekly-2026-W16.md](../docs/reports/weekly-2026-W16.md)
Latest Daily Report: [daily-2026-04-13.md](../docs/reports/daily-2026-04-13.md)

Previously: [_archived/v3-post-mvp-1](../docs/plan/_archived/v3-post-mvp-1/) — Stabilization, Polish & Sharing (4 phases, shipped 2026-04-22 → 2026-04-24)

Last Updated: 2026-04-24


## Current Focus
**Plan complete — all four phases shipped (1, 2, 3, 4A, 4B, 4C).** Stabilization, polish, sharing, and cook-tracking all landed across 2026-04-22 through 2026-04-24. No active phase. Next session should pick from the backlog or address the open follow-ups below.

## Active Tasks
- [NEXT] Follow-up: broader mutation-button audit — migrate meal plan, import, and collection mutations to `useOptimisticMutation` + `MutationButton` for consistent pending/error UX (not blocking; current ones are functional)
- [NEXT] Follow-up: after deploying Phase 2, run `scripts/check-health.sh` against the server to baseline pool/memory/cable counts under normal load; revisit Puma/pool sizing if the numbers suggest different constraints than expected
- [NEXT] Follow-up: store auto-assign on manual-add — `GroceryListsController#add_item` doesn't consult `IngredientCategoryMapping`. ~5-line fix to lookup the mapping before save
- [NEXT] Follow-up: real-device verification of Phase 3D iOS input zoom fix on iPhone (Safari + PWA)

## Open Questions/Blockers
- **Mobile cross-week swipe**: Swiping past Sunday/Monday on mobile single-day view doesn't advance the week. Desktop week nav buttons work. → **Addressed in Phase 3**.
- **Imported recipe ingredient quality**: Phase 4 ingestion stores full text like "2 lbs beef" in the `name` field instead of structured `{ name, quantity, unit }`. Breaks grocery aggregation/dedup. → **Not in current plan's scope; tracked in backlog**.
- **Cook tracking counts at schedule time**: Phase 9A's `MealPlanEntry` `after_commit` increments `cook_count` on create rather than after the date passes. → **Resolved in Phase 4C (2026-04-24)**. The existing trigger already had a `date <= Date.current` guard; actual gap was future-dated entries whose date passes without create/destroy firing. `TallyCooksJob` sweeps nightly and recomputes from source.
- **Store auto-assign on manual-add**: `GroceryListsController#add_item` doesn't consult `IngredientCategoryMapping`, so re-adding an item manually (e.g., "eggs") doesn't pick up the previously-assigned store. Generation path does the lookup; manual path doesn't. → **~5-line fix; fold into Phase 4 or open as standalone**.
- **iOS input zoom verification**: `font-size: 16px !important` on inputs shipped in 3D but hasn't been tested on a real iPhone (Safari + PWA). Audit of utility-class overrides came back clean. → **Test before calling Phase 3 fully closed.**

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
- Phase 3: UX Polish (2026-04-22)
  - 3A (nav): BottomNav height up from h-10 → h-11 touch targets; py-3 + extra bottom padding (`safe-area-inset + 0.5rem`); `pointer-events-none` on nav container + `pointer-events-auto` on interactive elements so clicks in the gap pass through to content instead of dead-zoning. Main content bottom padding bumped from pb-16 → pb-20 for the larger nav.
  - 3B (grocery gesture): SwipeableGroceryItem uses Framer Motion with `drag="x"`, `dragElastic={0.15}`, and `AnimatePresence mode="popLayout"` on the list so removed items slide off while siblings glide into the gap. `onDragEnd` always `animate(x, 0)` for snap-back regardless of threshold; threshold gate only decides whether to fire the check/remove callback. **Vertical-drift fix (2026-04-24):** despite `drag="x"`, something in the drag pipeline was writing a y value proportional to the x delta (Y displacement persisted after X snap-back). Literal `y: 0` in style didn't pin it — had to make `y` a real `useMotionValue(0)` and reset it every tick in `onDrag`. Documented in the component header so it doesn't get "cleaned up" later.
  - 3C (filter + scroll persistence): `useRecipeFilters` stores state in localStorage under `garnish:recipeFilters:v1` with runtime sanitization; sticky until manual "Clear all" (no time-based expiry, no URL sync). Initial URL-param approach (2026-04-22) was reverted on 2026-04-24 — in a PWA, back-nav is in-app React Router and frequently uses hard-coded `Link to="/recipes"` instead of `navigate(-1)`, so URL-backed state was being dropped on back-nav. localStorage also survives tab close, matching the mental model of "filters are a setting, not a query." `useScrollRestoration` unchanged: saves scroll position on unmount, restores on POP with multi-attempt timing.
  - 3D (iOS zoom): `font-size: 16px !important` on inputs/textareas/selects — many inputs carry Tailwind's `text-sm` (14px) which was winning on class-vs-element specificity. `!important` is justified because sub-16px inputs cause mandatory iOS zoom, which is a platform constraint, not a style choice. **Real-device verification still pending.**
  - 3E (store/category categorization): Root cause was plural mismatch in client-side `categorizeIngredient` — keyword "paper towel" didn't match "paper towels" due to word-boundary regex. Regex now accepts optional `s|es` suffix. **Note:** this fix is for the keyword-based category inference system (Produce/Dairy/etc). The *separate* learned-mapping system (`IngredientCategoryMapping`, which remembers per-household "eggs → Sam's Club") is not applied in the manual-add path (`GroceryListsController#add_item`) — only during meal-plan-to-grocery generation. That's why store auto-assignment works sometimes (generated items) and not others (manually added items). Documented as an Open Question for Phase 4 or backlog.
- Phase 4B: Personal-rating sort (2026-04-24)
  - Backend: `sort=my_rating` case in `RecipesController#sort_scope` — LEFT JOIN restricted to current user's `recipe_ratings` (user_id parameter-bound via `connection.quote()`), ordered `score DESC NULLS LAST, recipes.title ASC`. Two tests cover ordering correctness and per-user isolation (one user's ratings don't leak into another's view).
  - Frontend: "My Rating" added to the sort dropdown in `RecipeFilterPanel`. Active sort chip ("Sort: My Rating") rendered in `RecipeBrowser` when applied. Persisted via `useRecipeFilters` like the other sorts.
  - **Deviation from phase-4.md plan:** plan called for both filter chips ("My Favorites" / "Not Rated by Me") AND a "My Rating" sort. After implementing both, scrapped the chip group during review — the sort already surfaces favorites at the top and unrated at the bottom (NULLS LAST), which covers the workflows for a personal-scale recipe library. Removed `MyRatingFilter` type, `MY_RATING_FILTERS` const, "My Ratings" filter section, `myRating` from `RecipeFilterState`, the `myRating` chip rendering in `RecipeBrowser`, the `?my_rating=favorites|unrated` query param, the `Recipe.my_rating_favorites` / `my_rating_unrated` scopes, and the two filter tests. The "Highly Rated" smart filter (household average) covers the household-shared favorites case; sort-by-my-rating covers the personal case. Net: less surface, same workflows.
- Phase 4A: Link-based recipe sharing (2026-04-24)
  - Backend: `share_token` column on recipes (partial unique index where not null); `Recipe#generate_share_token!` (collision-avoiding loop) and `#revoke_share_token!`. `RecipePolicy#share?` / `#revoke_share?` mirror update/destroy authority — admin+ only.
  - `RecipesController#share` and `#unshare` (POST/DELETE `/api/v1/recipes/:apikey/share`) — share is idempotent (existing token returned unchanged); revoke nulls and the next share generates a fresh token so old URLs 404.
  - New `SharedRecipesController` deliberately does NOT include `HouseholdScoped` at class level — its public `show` would 401 anonymous viewers. Instead splits into `require_household` (for `copy`) and `set_optional_household` (for `show`) so the same controller serves both audiences. Public `show` returns a serializer that omits `share_token` (already in URL), includes `shared_by_household` for attribution and `can_copy: bool`. Authenticated `copy` clones the recipe into the current user's active household with provenance ("Shared from {Source Household Name}\n\n{original notes}").
  - `serialize_recipe(full: true)` extended to include `share_token` and `share_url` (FRONTEND_URL-prefixed) for household members.
  - 17 new tests: 8 in `recipes_controller_test.rb` (idempotency, member-cannot-share forbidden, outsider gets 428 no_household, revoke-then-share gets new token, show response includes/omits the share fields), 9 in `shared_recipes_controller_test.rb` (anonymous show with can_copy=false, authenticated-with-household show with can_copy=true, authenticated-no-household with can_copy=false, unknown/revoked tokens 404, copy creates in correct household with provenance, unauthenticated copy 401, no-household copy 428).
  - Frontend: `shareRecipe` / `revokeShare` / `fetchSharedRecipe` / `copySharedRecipe` in `api/recipes.ts`. `Recipe` type extended with `share_token` and `share_url`. `ShareRecipeDialog` component (sheet modal) with two states — "Generate share link" before, "Copy link" / "Stop sharing" after — using `navigator.clipboard.writeText` with toast fallback for insecure-context failures. Recipe detail menu gains a Share2 icon (turns garnish-green when sharing is active) for admin+.
  - New public `SharedRecipe` page at `/r/shared/:token`, mounted outside `ProtectedRoute` so anonymous users can view. Three CTA branches based on `can_copy`/`isAuthenticated`: "Add to my recipes" (logged in with household), "Complete setup" (logged in without household), "Sign up to save" (anonymous). The copy mutation redirects to the new local recipe on success.
  - **Subtle bug found in user testing:** the share page fetched before AuthContext had restored the access token from the refresh cookie, so authenticated users saw "Complete setup" (since `current_user` was nil server-side). Fixed by gating the query on `useSessionLoading()` and including `isAuthenticated` in the query key so the cache invalidates if auth state flips.
- Phase 4C: Cook-tracking correctness + stats surface (2026-04-24)
  - Existing `MealPlanEntry#update_recipe_cooking_stats` after_commit trigger was correct-but-incomplete: it guards `date <= Date.current` so future-dated creates no-op correctly, and recomputes on destroy — but nothing fires when a future-dated entry's date later passes (the "plan Monday, eat Thursday, entry not deleted" case). Phase 4C keeps the trigger (immediate feedback on retroactive log + destroy) and adds a nightly recompute-from-truth job to close the gap.
  - `TallyCooksJob`: single idempotent SQL `UPDATE recipes FROM (SELECT … FROM recipes LEFT JOIN meal_plan_entries …)` that re-derives `times_cooked` and `last_cooked_at` from current entries. Only touches rows whose computed values actually changed (via `IS DISTINCT FROM`). Safe to run multiple times / skip days / run after downtime — self-heals because it recomputes rather than increments. Scheduled via GoodJob cron at `0 2 * * *`, disabled in test env.
  - Backfill migration `20260424100000_backfill_cook_stats.rb` runs the same SQL once on deploy so Day 1 stats are correct without waiting for first 2am run. Idempotent; safe re-run.
  - 6 new tests (`test/jobs/tally_cooks_job_test.rb`) covering: future-becomes-past (the motivating case), idempotency, leftover exclusion, future-date exclusion, drift correction, reset-to-zero. Kept alongside existing 8 `CookingStatsTest` model tests.
  - Frontend: `formatRelativeDate` in `lib/weekUtils.ts` (today / yesterday / N days ago / last week / N weeks ago / last month / N months ago / last year / N years ago; future falls through to short absolute). `CookStats` component on RecipeDetail renders subtly in `text-xs text-gray-400` below the title. Hides when never cooked (not "Never made" text — no line at all). Singular/plural aware. Recipe card face unchanged.
  - Side effect: resolves the Phase 3 "default sort looks alphabetical" observation. Backend default sort was `last_cooked_at DESC NULLS LAST, title ASC`; most recipes had NULL last_cooked_at so they all fell through to title tiebreak. Backfill populates real values; sort now orders by actual cook history.
  - **Deviation from phase-4.md checklist:** plan said "remove the incorrect trigger." The trigger wasn't incorrect after re-reading the current code — plan was written under an outdated assumption. Kept it for low-latency retroactive-log + immediate-destroy feedback; nightly job covers only the time-passing gap. Documented in the job's header comment.

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
