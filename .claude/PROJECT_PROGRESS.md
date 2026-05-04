# Project Progress - Garnish

## Plan Files
Roadmap: [plan.md](../docs/plan/plan.md)
Current Phase: [phase-4.md](../docs/plan/phases/phase-4.md)
Latest Weekly Report: [weekly-2026-W18.md](../docs/reports/weekly-2026-W18.md)
Latest Daily Report: [daily-2026-04-29.md](../docs/reports/daily-2026-04-29.md)

Previously: [_archived/v4-fraction-support](../docs/plan/_archived/v4-fraction-support/) — Fraction support for ingredient quantities (1 phase, shipped 2026-04-29). Earlier: [v3-post-mvp-1](../docs/plan/_archived/v3-post-mvp-1/) — Stabilization, Polish & Sharing (2026-04-22 → 2026-04-24).

Last Updated: 2026-05-04


## Current Focus
**All four phases dev-verified. Deploying Phases 2/3/4 together (Phase 1 was already deployed standalone).** Phase 4 added URL paste via `ImageUrlFetcher` (down gem) wired into the bundled-payload recipes controller, plus share-copy attachment deep-copy in `SharedRecipesController#copy`. Verified URL paste happy path, 404, non-image, scheme guard; share-copy roundtrip with image. Caught and fixed two regressions during verification (FormData encoding sending `ingredient_groups=""` for quick_meal recipes; doubled "Image Image must be..." prefix from raw fetcher messages).

## Active Tasks
- [IN PROGRESS] Commit Phase 4 + push to origin → CI/CD deploys Phases 2/3/4 to prod Mac and frontend to CF Pages
- [NEXT] Smoke test prod after deploy: upload an image via UI, verify R2 object count grows via `aws s3 ls s3://garnish-prod/ --recursive | wc -l`. Try URL paste. Try share-copy with attachment.
- [NEXT] Archive plan: `git mv docs/plan/plan.md docs/plan/phases docs/plan/_archived/v5-recipe-images-r2/`. Update PROJECT_PROGRESS Plan Files section to point at next plan or `None`.
- [NEXT] Verify last night's 3am cron ran successfully — `tail -20 ~/.garnish/backups/cron.log` on the Mac + `aws s3 ls s3://garnish-prod/db/`
- [NEXT] Follow-up: broader mutation-button audit — migrate meal plan, import, and collection mutations to `useOptimisticMutation` + `MutationButton` for consistent pending/error UX
- [NEXT] Follow-up: run `scripts/check-health.sh` against the server post-deploy to baseline pool/memory/cable counts; revisit Puma/pool sizing if numbers suggest different constraints than expected
- [NEXT] Follow-up: real-device verification of Phase 3D iOS input zoom fix on iPhone (Safari + PWA)
- [NEXT] Investigate "reconnecting" overlay frequency on production — Candidates: CF Tunnel WS idle handling, indicator threshold flashing on single missed ping, auth-token refresh interaction

## Open Questions/Blockers
- **Mobile cross-week swipe**: Swiping past Sunday/Monday on mobile single-day view doesn't advance the week. Desktop week nav buttons work. → **Addressed in Phase 3**.
- **Imported recipe ingredient quality**: Phase 4 ingestion stores full text like "2 lbs beef" in the `name` field instead of structured `{ name, quantity, unit }`. Breaks grocery aggregation/dedup. → **Not in current plan's scope; tracked in backlog**.
- **Cook tracking counts at schedule time**: Phase 9A's `MealPlanEntry` `after_commit` increments `cook_count` on create rather than after the date passes. → **Resolved in Phase 4C (2026-04-24)**. The existing trigger already had a `date <= Date.current` guard; actual gap was future-dated entries whose date passes without create/destroy firing. `TallyCooksJob` sweeps nightly and recomputes from source.
- **Store auto-assign on manual-add**: → **Resolved 2026-04-30.** Replaced the originally-planned ~5-line server-side fix with a frontend-driven approach: mapping lookup runs as the user types (plural-aware via `lookupMapping`), pre-fills both category and store dropdowns. Backend `add_item` now also calls `learn_mapping` so first-time adds train the system. Better UX (visible feedback) and connection-resilient (lookup against cached mappings, no server roundtrip).
- **iOS input zoom verification**: `font-size: 16px !important` on inputs shipped in 3D but hasn't been tested on a real iPhone (Safari + PWA). Audit of utility-class overrides came back clean. → **Test before calling Phase 3 fully closed.**

## Completed This Week
None yet — see [previous week's report](../docs/reports/weekly-2026-W18.md) for last week.


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
