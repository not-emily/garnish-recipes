# Project Progress - Garnish

## Plan Files
Roadmap: [plan.md](../docs/plan/plan.md)
Current Phase: [phase-2.md](../docs/plan/phases/phase-2.md)
Latest Weekly Report: [weekly-2026-W17.md](../docs/reports/weekly-2026-W17.md)
Latest Daily Report: [daily-2026-04-29.md](../docs/reports/daily-2026-04-29.md)

Previously: [_archived/v4-fraction-support](../docs/plan/_archived/v4-fraction-support/) — Fraction support for ingredient quantities (1 phase, shipped 2026-04-29). Earlier: [v3-post-mvp-1](../docs/plan/_archived/v3-post-mvp-1/) — Stabilization, Polish & Sharing (2026-04-22 → 2026-04-24).

Last Updated: 2026-04-30


## Current Focus
**Phase 2 substantively done in dev — manual smoke test pending tomorrow before deploy.** Recipe model has `has_one_attached :image` with thumb + detail variants, serializers output hybrid URLs (attachment > image_url string > null), all four display surfaces wired (incl. filling the SharedRecipe hero gap). Backend tests + frontend build clean. Local end-to-end pipeline confirmed via `bin/rails runner` smoke. Not yet pushed/deployed — testing in dev first.

Phase 3 (upload UI — file source) starts after tomorrow's verification.

## Active Tasks
- [IN PROGRESS] Phase 2: Recipe model + image display
  - ✓ Model: `has_one_attached :image` + `thumb` (600x450) + `detail` (1200x900) variants + 10MB cap + content-type allowlist (jpeg/png/webp/heic) + purge-on-reject validators
  - ✓ Serializers (recipes + shared_recipes) emit `image_thumb_url` + `image_detail_url` via shared `attachment_variant_url` helper in ApplicationController
  - ✓ ActiveStorage proxy controllers patched with `Cache-Control: public, max-age=31536000, immutable` so CF caches at edge
  - ✓ Frontend types + 4 display surfaces with attachment-first fallback chain (RecipeCard, RecipeCardCompact, RecipeDetail, SharedRecipe — last one was missing a hero entirely; now added)
  - ✓ Backend tests: 5 model + 2 serializer cases. 308/308 backend tests pass overall
  - ✓ Frontend build clean (real `tsc -b`); vitest 63/63
  - ✓ Local smoke test via `bin/rails runner`: attach succeeds, variant URL signed correctly through proxy route
  - ⏭ **Tomorrow morning manual test in dev:** start Rails locally → attach an image to a recipe via console → visit /recipes/:id in browser → confirm RecipeDetail hero renders. Repeat for shared link + browse cards. Then push + deploy
- [NEXT] Tomorrow morning: verify last night's 3am cron ran successfully — `tail -20 ~/.garnish/backups/cron.log` on the Mac, plus `aws s3 ls s3://garnish-prod/db/` should show LastModified > 03:00 today
- [NEXT] Phase 3: Upload UI — file source (RecipeImagePicker component + multipart endpoint, plan: `docs/plan/phases/phase-3.md`). Starts after Phase 2 verification.
- [NEXT] Follow-up: broader mutation-button audit — migrate meal plan, import, and collection mutations to `useOptimisticMutation` + `MutationButton` for consistent pending/error UX (not blocking; current ones are functional)
- [NEXT] Follow-up: after deploying Phase 2, run `scripts/check-health.sh` against the server to baseline pool/memory/cable counts under normal load; revisit Puma/pool sizing if the numbers suggest different constraints than expected
- [NEXT] Follow-up: real-device verification of Phase 3D iOS input zoom fix on iPhone (Safari + PWA)
- [NEXT] Investigate "reconnecting" overlay frequency on production — surfaced during today's work; turned out to be unrelated to the auto-store bug, but worth its own look. Candidates: CF Tunnel WS idle handling, indicator threshold flashing on single missed ping, auth-token refresh interaction

## Open Questions/Blockers
- **Mobile cross-week swipe**: Swiping past Sunday/Monday on mobile single-day view doesn't advance the week. Desktop week nav buttons work. → **Addressed in Phase 3**.
- **Imported recipe ingredient quality**: Phase 4 ingestion stores full text like "2 lbs beef" in the `name` field instead of structured `{ name, quantity, unit }`. Breaks grocery aggregation/dedup. → **Not in current plan's scope; tracked in backlog**.
- **Cook tracking counts at schedule time**: Phase 9A's `MealPlanEntry` `after_commit` increments `cook_count` on create rather than after the date passes. → **Resolved in Phase 4C (2026-04-24)**. The existing trigger already had a `date <= Date.current` guard; actual gap was future-dated entries whose date passes without create/destroy firing. `TallyCooksJob` sweeps nightly and recomputes from source.
- **Store auto-assign on manual-add**: → **Resolved 2026-04-30.** Replaced the originally-planned ~5-line server-side fix with a frontend-driven approach: mapping lookup runs as the user types (plural-aware via `lookupMapping`), pre-fills both category and store dropdowns. Backend `add_item` now also calls `learn_mapping` so first-time adds train the system. Better UX (visible feedback) and connection-resilient (lookup against cached mappings, no server roundtrip).
- **iOS input zoom verification**: `font-size: 16px !important` on inputs shipped in 3D but hasn't been tested on a real iPhone (Safari + PWA). Audit of utility-class overrides came back clean. → **Test before calling Phase 3 fully closed.**

## Completed This Week
- [2026-04-29] Phase 1 (Fraction Support) — parser/formatter utility, editor input UX, display rendering
  - `frontend/src/lib/quantity.ts`: `parseQuantity`, `formatQuantity`, `unitClass`, `replaceFractionalPart` — accepts integers, decimals, ascii fractions (`3/4`, `1 3/4`, `1-3/4`), unicode glyphs (`¾`, `1¾`); unit-class-driven display (cup/tsp/tbsp → fraction with halves/thirds/quarters/eighths snap; g/kg/oz/lb/ml/l → decimal)
  - `frontend/src/lib/quantity.test.ts`: 50-test Vitest suite covering parser, formatter, unit classifier, chip-helper, plus round-trip — serves as the canonical spec for the future Ruby port (imported-recipe-parsing backlog)
  - Vitest added as dev dep; `npm test` and `npm test:watch` scripts
  - `FractionChipRow` component: focus-triggered, `grid grid-cols-4 gap-1.5` layout (deterministic 4+4 wrap), `bg-white` pills with stronger border (was bleeding into prep field's `bg-gray-50`); `onMouseDown preventDefault` survives the input-blur race; visibility tied to `focused && unitClass(unit) === "fractional"`
  - `IngredientEditor` rewritten — extracted `IngredientRow` subcomponent; quantity input switched from `<input type="number">` to text with parser-driven blur. Auto-revert on truly unparseable input (data and UI always in sync; no validity-bubbling plumbing required)
  - `GroceryList`: `EditItemModal` and `AddItemForm` quantity inputs got the same treatment (text + chip row + parse-on-save). Chip row lifted out of the narrow grid columns to span full modal/form width. `formatItemLabel` routes through `formatQuantity` so aggregated quantities display correctly
  - `RecipeDetail` and `SharedRecipe` ingredient quantities route through `formatQuantity`
  - **Deviation from initial plan:** plan said chip row visibility was tied just to focus; refined to `focused && unitClass(unit) === "fractional"` so chips don't appear (and tempt) when unit is `g`/`lb`/etc. Cleaner UI signal.
  - **Deviation from initial plan:** invalid-qty UX in `IngredientEditor` shipped as auto-revert rather than validity-bubbling to `RecipeForm` — ~5 lines vs ~30 of cross-component plumbing, and avoids the index-key reorder bug. Bounce-back is the feedback.
  - **Verification:** build clean (`npm run build`), 50/50 tests passing, ESLint clean on all touched files. Browser smoke check + iPhone tap behavior pending the user.
  - Plan archived to `docs/plan/_archived/v4-fraction-support/`
- [2026-04-29] Brand icons — replaced purple Vite-default favicon with 🌿 (parsley sprig) Twemoji
  - `scripts/generate-icons.sh` (adapted from trak's version) — Twemoji v14.0.2 pinned, parameterized by codepoint and bg color, writes `favicon.svg` + `apple-touch-icon-180.png` + `icon-192.png` + `icon-512.png` + `icon-maskable-512.png` (same composite as 512 since 700/1024 ≈ 68% sits inside the 80% maskable safe zone). White background to match `manifest.background_color`
  - 🌿 chosen for literal name match (a "garnish" IS the herb sprig), color alignment with `garnish-green`, distinctive shape at 16×16 favicon scale
- [2026-04-29] Frontend lockfile fix for Cloudflare Pages
  - First Phase 1 deploy failed with `npm ci`: "Missing: @emnapi/core@1.10.0 / @emnapi/runtime@1.10.0" — transitive optional native-module deps that local `npm install` on Arch didn't capture into the lockfile
  - Fixed by `rm -rf node_modules package-lock.json && npm install` from clean. Fresh resolve also bumped patch/minor versions across the tree (Tailwind RC family, framer-motion patch, etc.)
  - Side effect: framer-motion's proxy module no longer splits into its own chunk — gets inlined into main `index.js`. ~408 KB single chunk vs 259 KB + 121 KB across two chunks before. Total payload roughly equivalent
  - **Recurring deploy-environment-divergence theme:** second instance (first was TS project-references in Phase 1 of post-mvp-1). Possible follow-up: `scripts/check-deploy.sh` running `npm run build && npm ci --dry-run` to catch both classes pre-push; user declined for now
- [2026-04-30] Grocery manual-add: store auto-fill + cache freshness + UX polish (resolves a long-standing follow-up)
  - Backend `GroceryListsController#add_item` now calls `learn_mapping(item, nil, nil)` after save so first-time adds with a manually-picked store create the household mapping. Symmetric with `update_item`. +1 controller test
  - New `frontend/src/lib/ingredientMapping.ts` with `lookupMapping(name, mappings)` (plural-aware: tries exact, then strips `s`/`es`, then adds `s`/`es` — mirrors the `(?:es|s)?` tolerance in `categorize.ts`) and `upsertMapping(mappings, mapping)` (returns new array, replaces by normalized name). 13 Vitest cases cover normalize, plural variants both directions, miss paths, and immutability
  - `AddItemForm` swapped its inline exact-string match for `lookupMapping` so "orange" ↔ "oranges" map to the same household entry
  - **Cache freshness fix** in `useGroceryList.ts`: `addItem.onSuccess` and `updateItem.onSuccess` now also patch `data.mappings` via `upsertMapping` (alongside the existing `data.items` patch via `patchList`). Before: cache mappings stayed stale after add/update until 15s `refetchInterval`, focus event, page refresh, or non-self broadcast. Symptom: update yogurt's store, immediately type "yogurt" again — no auto-fill until refresh
  - **UX polish:** hard-reset both category and store dropdowns on successful submit (was: "Category and store persist" comment, but mappings now cover that case better than dropdown stickiness). Reset `storeManual` flag alongside `categoryManual` so subsequent adds aren't blocked. Fixed `mapping.store === null` leak — now `setStore(mapping.store ?? "")` always runs when a mapping is found, instead of gating on truthiness (would have left previous typed name's store sticky during mid-entry edits)
  - **Deviation from initial plan:** original direction was a ~5-line server-side fix in `add_item` to consult `IngredientCategoryMapping` invisibly. Switched to frontend-driven lookup as user types — visible feedback, override-friendly, connection-resilient (works during "reconnecting" states). Server-side `add_item.learn_mapping` still added for the symmetry, but isn't doing the heavy lifting on the user-facing path
  - **Verification:** backend 18/18 tests pass (was 17), frontend 63/63 vitest pass (was 50; +13 new), real `tsc -b` build clean
  - Side note: user reported "reconnecting" overlay seems too frequent on production. Investigated as a possible cause of the original auto-store bug; ruled out (controller path issue, not cable). Logged as standalone follow-up
- [2026-04-30] Phase 1 (R2 setup + DB backup offsite) — substantively complete; first phase of the new image-upload + R2 plan
  - Cloudflare R2 bucket `garnish-prod` created with scoped Object Read/Write API token; account-id + creds wired into `~/.garnish/.env` on prod Mac (chmod 600)
  - `aws-cli` v2 installed via official .pkg installer; `r2` profile configured against R2 endpoint; smoke test (`aws s3 ls`) clean
  - `scripts/backup-db.sh` extended: now sources `~/.garnish/.env`, gzips `pg_dump` output to `garnish_YYYYMMDD.sql.gz` locally, conditionally `aws s3 cp` to `s3://garnish-prod/db/latest.sql.gz` (overwrites nightly, no retention by design — local 14-day rolling stays as primary recovery layer)
  - Manual run on Mac confirmed end-to-end: local dump produced, R2 upload succeeded, `latest.sql.gz` visible via `aws s3 ls`
  - Restore drill on scratch DB: `aws s3 cp` → `gunzip` → `psql garnish_restore_test < ...` → row counts matched prod → cleanup. Full recovery hierarchy verified
  - `docs/runbooks/backup-restore.md` runbook (107 lines): backup paths, recovery hierarchy, manual-run, local restore, R2 restore, common-failures table (8 modes), drill triggers
  - **Surfaced during planning:** existing 3am cron had been silently failing for 17 days — missing `~/.garnish/backups` directory blocked the redirect-to-cron.log, AND `pg_dump` not in cron's minimal PATH (`/usr/local/pgsql/bin` missing). Both fixed: `mkdir -p ~/.garnish/backups` once, plus `export PATH="/usr/local/pgsql/bin:$PATH"` at top of script
  - **Deviation from initial plan:** plan originally said `docs/ops/backup-restore.md`; existing project convention is `docs/runbooks/` (alongside `backend-outage.md`). Updated all references
  - **Deviation:** env file naming was `~/.garnish/env`; renamed to `~/.garnish/.env` to pick up the existing root-level `.env` gitignore rule. One less risk of accidental commit
  - First unattended cron run: tonight at 03:00. Verify tomorrow morning via `tail -20 ~/.garnish/backups/cron.log` and `aws s3 ls s3://garnish-prod/db/` (LastModified should be after 03:00)

- [2026-04-30] Phase 2 (Recipe model + image display) — substantively done in dev (push + deploy pending tomorrow's manual test)
  - `Recipe#image` ActiveStorage attachment with `thumb` (600×450 4:3) and `detail` (1200×900 4:3) variants via `image_processing` (`resize_to_fit` preserves aspect; CSS `object-cover` handles cropping consistently across surfaces). Originals stored too. Variants generated lazily on first request, cached in `active_storage_variant_records`
  - Validations: `IMAGE_MAX_SIZE = 10.megabytes` cap, `IMAGE_ALLOWED_TYPES` allowlist (image/jpeg, image/png, image/webp, image/heic, image/heif). Both validators call `image.purge` before adding the error so we don't leave orphan blobs in storage
  - `image_url` STRING field is untouched — keeps hotlinking URL-ingestion captures (og:image, JSON-LD via `RecipeIngestion::OpenGraphExtractor` + `Normalizer.extract_image`). Existing recipes render unchanged. Hybrid is the design call: side-steps third-party redistribution concerns and avoids backfill migration
  - `attachment_variant_url(attachment, variant_name)` helper added to `ApplicationController` so both `RecipesController#serialize_recipe` and `SharedRecipesController#serialize_public_recipe` produce `image_thumb_url` / `image_detail_url` consistently. Returns nil when not attached
  - `config/initializers/active_storage.rb` patches `ActiveStorage::Blobs::ProxyController` and `Representations::ProxyController` to set `Cache-Control: public, max-age=31536000, immutable`. Blob URLs are signed-token-stable, safe to mark immutable. CF caches the proxied bytes after first hit
  - Frontend display fallback chain (`image_*_url ?? image_url ?? null`) wired across `RecipeCard` (4:3 thumb), `RecipeCardCompact` (1:1 thumb), `RecipeDetail` (16:9 detail hero), and `SharedRecipe` (16:9 detail hero — was previously omitted entirely; now rendered conditionally when `src` is present, no gradient placeholder for signed-out viewers). Types updated in `RecipeSummary` + `SharedRecipeView`
  - **Discovery during testing (worth remembering):** ActiveStorage's `attach(io:)` silently fails on `StringIO` objects in our config — needs a real file-like (`Tempfile`, `File`). Documented in `recipe_image_test.rb` header. Lost ~30min before tracing it
  - **Discovery during testing (more interesting):** `attach()` on a persisted record triggers an internal save that fires the model's validators. When a validator rejects, `attach()` returns `nil`, the attachment is purged in the validator, and nothing persists. Tests assert this observable behavior (`assert_nil result`, `assert_not attached?`) rather than fighting it via `record.save` afterwards
  - **Verification:** 308/308 backend tests (was 303; +5 model + 2 serializer), real `tsc -b` build clean, vitest 63/63, end-to-end smoke via `bin/rails runner` — variant URL signed and routes through proxy correctly
  - Plan reference: `docs/plan/phases/phase-2.md`

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
