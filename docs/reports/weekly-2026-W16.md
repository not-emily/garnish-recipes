# Weekly Report - Garnish - Week of 2026-04-13 (ISO Week 16)

## Week Overview
MVP finish-line week. All five remaining phases (6 through 10) shipped over a weekend sprint, a full Nav/Search UX rework landed across seven phases, and operational polish (deploy hardening, DB backup, GoodJob async mode) closed out the cycle. The critical-path MVP is complete end-to-end, and a week of real-world usage has begun surfacing the next wave of work.

## Key Accomplishments

### Phase 6: Leftovers (2026-04-11)
- LeftoverCalculator with household settings, linked leftover creation from oversized-serving recipes
- LeftoverPrompt + LeftoverEntry visuals, LeftoverTray with merging, cascade delete with confirmation dialog
- Expiry logic, settings UI for leftover defaults
- Smoke-test fixes: cross-week leftovers, tray merging, prompt UX, schedule popover, note double-submit, event notes icon, servings removal, image_url fix

### Phase 7: Grocery Lists (2026-04-11)
- Backend: GroceryGenerator, ingredient categorization, store tagging, rolling-list model with excluded_items tracking, 191 passing tests
- Frontend: GroceryListChannel real-time sync, useGroceryList hook, full UI gated on member permissions (read/contribute/full)
- Single rolling-list pattern (not per-week) with excluded_items field to support manual curation

### Phase 8: Collections & Sharing (2026-04-12)
- 8A: Collection CRUD with visibility controls, reusable `ConfirmDialog` + `DropdownMenu` components
- 8B: Add-to-collection from recipe detail page
- 8C: Cross-household sharing, recipe copy with provenance tracking, JSON single-recipe export, UX polish pass

### Phase 9: Ratings & Smart Browse (2026-04-12)
- 9A: Cooking tracking via `MealPlanEntry` `after_commit` (note: this was later identified as counting at schedule time rather than date-passed — queued for Phase 4 of the next plan)
- 9B: Per-member ratings with cached household averages, `RatingStars` component
- 9C: Smart browse sections — five carousels on recipe browse page (later replaced by filter panel in the Nav/Search rework)
- UX fixes: session bleed on logout, optimistic rating updates, mobile touch-handling for clearing stars

### Phase 10: Polish & PWA (2026-04-12)
- 10A: Lazy route loading — main bundle went 647KB → 254KB with per-page chunks
- 10B: PWA manifest, manual service worker (cache-first assets / network-first API / SPA fallback), PWA icons, install prompt hook, Settings install button
- 10C: Custom Toast component with swipe-up-to-dismiss, `ErrorBoundary`, `OfflineBanner`, page enter transitions, toast integration on key mutations
- 10D: Pull-to-refresh with arrow indicator + smooth collapse, swipe-to-check + swipe-to-delete on grocery items (X button removed), skip-to-content link, aria-label on nav

### Nav/Search UX Rework — All 7 Phases (2026-04-12 → 2026-04-13)
- Phase 1: `PageHeader` component, Settings relocated from bottom nav to user avatar
- Phase 2: Adaptive bottom nav — 3-tab pill + search icon with Framer Motion `layoutId` morph
- Phase 3: Dedicated `/search` page with URL param sync, recent searches, discovery carousels
- Phase 4: Recipe filter panel (slide-up sheet) replacing smart browse carousels — multi-select protein/category/cuisine, time ranges, smart filters, filter chips
- Phase 5: `AddToMealPlanModal` reusable component with date/slot picker and leftover integration
- Phase 6: Protein filter pills on `EntryPicker`
- Phase 7: Polish & cleanup — dead code removal, `BottomNav` fixes, `RecipeCard` / `RecipeDetail` / `Search` refinements, deploy script hardening

### Quick Wins Batch (2026-04-13)
- Default recipe list sort changed from "Last Updated" to "Recently Cooked" (quiet default with no filter pill)
- "Recently Cooked" moved to the top of the Sort By options
- Backend "rating" sort support added (was silently falling through to updated_at)
- Mobile iOS auto-zoom fix: global `font-size: 16px` on inputs/textareas/selects
- Recipe card aspect ratio fix on production Chromium: switched from `aspect-ratio: 4/3` to the `padding-bottom: 75%` trick (Chromium was ignoring `aspect-ratio` and sizing to the image's intrinsic dimensions only in the production build)

### Operational & Housekeeping (2026-04-13)
- Nav/Search UX plan archived to `docs/plan/_archived/v2-nav-search-ux/`
- CF Pages deploy fix (TS build exclusion for client-side-only sort values)
- Deploy script hardened to initialize rbenv over SSH properly
- DB backup script added (`scripts/backup-db.sh`) + top-level `log/` gitignored
- TypeScript strict-mode errors resolved for Node 22 builds
- GoodJob switched to async mode for all non-test environments (previously was inline or unconfigured)
- Delete button added to failed-import view in recipe ingestion UI

## Decisions This Week
No new architectural decisions recorded in DECISIONS.md this week — all five entries remain from the 2026-04-06 launch week. Implementation-level calls this week:

1. **Single rolling grocery list, not per-week** — `excluded_items` field tracks manual removals → simpler UX, matches how people actually shop (carry-over items persist).
2. **Recipe copy on cross-household share, not reference** — Provenance metadata on the copy → receiving household owns its copy; original household isn't obligated to keep the recipe alive.
3. **Filter panel replaces smart browse carousels** — Active filtering over passive scrolling → users find recipes faster with multi-select filters; smart filters preserved inside the panel.
4. **Nav state derived from route, not local state** — `/search` is a real URL → browser back works naturally, deep-linkable, PWA-friendly.
5. **Lazy route loading** — Main bundle dropped 60% (647KB → 254KB) → faster first paint on mobile PWAs, especially important on cold install.

## Challenges Encountered

- **Production Chromium aspect-ratio bug** — `aspect-ratio: 4/3` on a flex-column child rendered at the image's intrinsic ratio instead of 4:3. Reproducible only in the production build, not local dev. Resolved with the `padding-bottom: 75%` trick + absolutely-positioned image.
- **iOS Safari input auto-zoom** — Fixed globally via `font-size: 16px` on form elements, but a week of real usage shows it's still intermittent (couldn't reliably reproduce). Queued for Phase 3 of the next plan.
- **TypeScript strict-mode drift under Node 22** — CF Pages build broke on strict typing around the client-side "rating" sort that isn't a valid backend `RecipeFilters.sort` value. Fixed by excluding the client-side value from API params.
- **Cook-tracking semantics incorrect** — Phase 9A's `MealPlanEntry` `after_commit` trigger counts meals at schedule time, not after the date passes. Surfaces as over-counted `cook_count` for any recipe scheduled but not yet cooked (or later deleted). Queued for Phase 4 of the next plan.
- **Mobile cross-week swipe (still unresolved)** — Deferred again; will investigate as part of Phase 3 UX polish.
- **Imported recipe ingredient parsing (still unresolved)** — Phase 4 ingestion stores full text like "2 lbs beef" in the `name` field rather than splitting into structured `{ name, quantity, unit }`. Breaks grocery aggregation. Queued.

## Metrics
- **Commits:** 22 (Apr 11–13 heavy concentration)
- **Files touched:** approximately 219 files across the week
- **Biggest single commit:** Phase 7 grocery lists (2,771 insertions, 26 files)
- **Nav/Search rework total:** 2,630 insertions across 38 files over 7 commits
- **Main JS bundle:** 647KB → 254KB after lazy routing
- **Backend tests:** 191 passing after Phase 7
- **Phases shipped:** 5 (Phases 6, 7, 8, 9, 10) + the entire 7-phase Nav/Search UX rework + quick wins

## Next Week Priorities

The MVP is complete. A week of real usage has surfaced a new multi-phase initiative, documented in `docs/plan/plan.md`:

1. **Phase 1 — Connection Resilience & Honest UI** (next up): API client error taxonomy, only-401-clears-auth, expanded `OfflineBanner`, shared optimistic-mutation helper, pending/error states on every mutation button, grocery ghost bug fix, recently-cooked sort fix
2. **Phase 2 — Backend Stability**: Puma tuning, DB pool sizing, GoodJob audit, structured health logging, outage runbook
3. **Phase 3 — UX Polish**: Nav sizing + dead-zone fix, slide-to-delete gesture, filter/scroll persistence, iOS input zoom verification, store-sort reliability
4. **Phase 4 — Features**: Link-based recipe sharing, "my favorites" + "not rated by me" filters, cook-tracking correctness + "Last made · Made N times" stats line
