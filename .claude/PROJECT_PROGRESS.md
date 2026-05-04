# Project Progress - Garnish

## Plan Files
Roadmap: [plan.md](../docs/plan/plan.md)
Current Phase: [phase-4.md](../docs/plan/phases/phase-4.md)
Latest Weekly Report: [weekly-2026-W18.md](../docs/reports/weekly-2026-W18.md)
Latest Daily Report: [daily-2026-04-29.md](../docs/reports/daily-2026-04-29.md)

Previously: [_archived/v4-fraction-support](../docs/plan/_archived/v4-fraction-support/) — Fraction support for ingredient quantities (1 phase, shipped 2026-04-29). Earlier: [v3-post-mvp-1](../docs/plan/_archived/v3-post-mvp-1/) — Stabilization, Polish & Sharing (2026-04-22 → 2026-04-24).

Last Updated: 2026-05-04


## Current Focus
**All four phases live in prod.** Image upload + R2 working end-to-end on the Mac: confirmed S3 Storage uploads in `launchd.stdout.log`, browser confirmed image render on detail page. Pre-warm variant job shipped so first-hit cost moves off the user's path. Today's session was 80% deploy-issue archaeology — captured all the lessons in the W19 daily entry below; deploy script now does a full master-restart via pidfile so future deploys reliably reload application.yml + initializer state. Plan archive is the last close-out task.

## Active Tasks
- [NEXT] Archive plan: `git mv docs/plan/plan.md docs/plan/phases docs/plan/_archived/v5-recipe-images-r2/`. Update PROJECT_PROGRESS Plan Files section to point at next plan or `None`
- [NEXT] Verify recent 3am crons ran successfully — `tail -20 ~/.garnish/backups/cron.log` on the Mac + `aws s3 ls s3://garnish-prod/db/ --profile r2 --endpoint-url=...` (still pending from W18)
- [NEXT] Follow-up: broader mutation-button audit — migrate meal plan, import, and collection mutations to `useOptimisticMutation` + `MutationButton` for consistent pending/error UX
- [NEXT] Follow-up: run `scripts/check-health.sh` against the server post-deploy to baseline pool/memory/cable counts; revisit Puma/pool sizing if numbers suggest different constraints than expected
- [NEXT] Follow-up: real-device verification of Phase 3D iOS input zoom fix on iPhone (Safari + PWA)
- [NEXT] Image-loader UX polish (deferred — pre-warm covers 90% of the slowness): track imgLoaded state on RecipeDetail hero, render `Loader2` while false. ~10 lines. Revisit if first-hit feels slow even with pre-warming
- [NEXT] Investigate "reconnecting" overlay frequency on production — Candidates: CF Tunnel WS idle handling, indicator threshold flashing on single missed ping, auth-token refresh interaction

## Open Questions/Blockers
- **Mobile cross-week swipe**: Swiping past Sunday/Monday on mobile single-day view doesn't advance the week. Desktop week nav buttons work. → **Addressed in Phase 3**.
- **Imported recipe ingredient quality**: Phase 4 ingestion stores full text like "2 lbs beef" in the `name` field instead of structured `{ name, quantity, unit }`. Breaks grocery aggregation/dedup. → **Not in current plan's scope; tracked in backlog**.
- **Cook tracking counts at schedule time**: Phase 9A's `MealPlanEntry` `after_commit` increments `cook_count` on create rather than after the date passes. → **Resolved in Phase 4C (2026-04-24)**. The existing trigger already had a `date <= Date.current` guard; actual gap was future-dated entries whose date passes without create/destroy firing. `TallyCooksJob` sweeps nightly and recomputes from source.
- **Store auto-assign on manual-add**: → **Resolved 2026-04-30.** Replaced the originally-planned ~5-line server-side fix with a frontend-driven approach: mapping lookup runs as the user types (plural-aware via `lookupMapping`), pre-fills both category and store dropdowns. Backend `add_item` now also calls `learn_mapping` so first-time adds train the system. Better UX (visible feedback) and connection-resilient (lookup against cached mappings, no server roundtrip).
- **iOS input zoom verification**: `font-size: 16px !important` on inputs shipped in 3D but hasn't been tested on a real iPhone (Safari + PWA). Audit of utility-class overrides came back clean. → **Test before calling Phase 3 fully closed.**

## Completed This Week

- [2026-05-04] Phases 2/3/4 deployed to prod — image upload + R2 working end-to-end. Day was a long sequence of deploy-time gotchas, each unblocking the next:
  - **FormData nested-array regression** caught on prod first-shot: my Phase 3 dev tests only PATCHed `title + image`, never exercising the bundled-multipart path with actual `ingredient_groups`. Rack's `parse_nested_query` parses `recipe[ingredient_groups][0][bar]=baz` as a HASH with key "0", not an array element. Fix: frontend `appendNested` JSON-encodes arrays-of-objects as a single string field (`recipe[ingredient_groups]={"...JSON..."}`); backend `decode_json_array_fields` parses the JSON before strong params. Primitive arrays (`tags`) keep `[]` notation since Rack handles those correctly. Regression test added that PATCHes title + image + multi-ingredient groups + multi-step instructions
  - **`mini_magick.cli_path=` removed in 5.x** — first attempt at the path fix raised `NoMethodError: undefined method 'cli_path=' for module MiniMagick` on prod boot. mini_magick 5.x dropped the setter; modern API relies entirely on PATH lookup. Fix: prepend `/usr/local/bin` (or `/opt/homebrew/bin`) to `ENV["PATH"]` directly in the initializer
  - **R2 env vars not loading into running Puma** — application.yml had the keys, `bundle exec rails runner` confirmed they were readable, but live PATCHes still showed `Disk Storage` in the log. Root cause: `bin/rails restart` is a *phased* restart that reloads workers but keeps the master process alive, and the master loaded ENV once at boot before the keys were added. Workers inherit master's ENV. Fix: kill the master, let launchd respawn with current env. Then puma.rb update to always write a pidfile so the deploy script can target the master cleanly. Then deploy-backend.sh updated to use the pidfile-based kill instead of `bin/rails restart`
  - **aws-sdk-s3 ≥1.180 sends multiple checksum headers per request** ("flexible checksums" — Content-MD5 + CRC32 + ...). Real AWS S3 accepts the lot; Cloudflare R2 rejects with `InvalidRequest (You can only specify one non-default checksum at a time.)`. Visible symptom: PUT 500s with `S3 Storage Uploaded` log line printing first (the gem logs before parsing the response), then `Aws::S3::Errors::InvalidRequest`, then a follow-up GET shows `ActiveStorage::FileNotFoundError` because the blob was never persisted. Fix: `request_checksum_calculation: when_required` + `response_checksum_validation: when_required` in storage.yml's cloudflare_r2 block
  - **Dual env files** — `~/.garnish/.env` (sourced by the backup cron script) was where Phase 1 put R2 creds. Puma reads its env from Figaro (`config/application.yml`), separate file. Had to duplicate the 4 R2 keys into application.yml. Long-term cleanup possible (consolidate to one source of truth) but acceptable as-is
  - **Two Pumas on the box** — turned out to be Garnish (`/Users/emily/.garnish/backend`) AND a different project (`/Users/emily/.trak/backend`). Both happened to use the puma cwd-tag `[backend]` since both are Rails monorepos with that subdirectory name. Disambiguated via `lsof -p <pid> | grep cwd`. Worth remembering: `[backend]` puma tag is ambiguous on this Mac, never use it as the only identifier
  - **Pre-warm variant job (`WarmRecipeImageVariantsJob`)** — enqueued by recipes_controller after a successful save with attached image; calls `.processed` on thumb + detail server-side so the first-hit cost (R2 download → ImageMagick → stream) is paid in the background. By the time the user (or anyone) hits the variant URL, the proxy serves cached bytes in <50ms and CF caches edge-side after first edge hit. Idempotent — `.processed` is a no-op if the variant_record exists. Per-variant rescue
  - **Verification on prod**: log shows `S3 Storage (701.7ms) Uploaded file to key: n655nypiwgom254e1ixpshmhczbr`; image renders on the detail page after a brief pre-warm window
  - **Worth remembering — phased vs full restart**: any change to application.yml, ENV, or initializer-level state requires a FULL master restart, not `bin/rails restart`. Deploy script now handles this via `kill $(cat tmp/pids/server.pid)` + launchd respawn. Pidfile is written by puma.rb only when `pidfile` is explicitly set in the config; the previous `pidfile ENV["PIDFILE"] if ENV["PIDFILE"]` made it conditional on an env var that prod didn't set
  - **Worth remembering — log layout on prod Mac**: stdout/stderr go to `~/.garnish/log/launchd.{stdout,stderr}.log`, NOT `backend/log/production.log`. The launchd plist's `StandardOutPath`/`StandardErrorPath` route them there
  - **Worth remembering — debugging ENV issues**: `bundle exec rails runner 'puts ENV["KEY"]&.length'` in a fresh shell loads application.yml independently of Puma's running process. Useful for "is the value in the file" vs "is it in the running process env" — different failure modes


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
