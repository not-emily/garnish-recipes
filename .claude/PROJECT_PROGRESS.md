# Project Progress - Garnish

## Plan Files
Roadmap: [plan.md](../docs/plan/plan.md)
Current Phase: [phase-4.md](../docs/plan/phases/phase-4.md)
Latest Weekly Report: [weekly-2026-W17.md](../docs/reports/weekly-2026-W17.md)
Latest Daily Report: [daily-2026-04-29.md](../docs/reports/daily-2026-04-29.md)

Previously: [_archived/v4-fraction-support](../docs/plan/_archived/v4-fraction-support/) — Fraction support for ingredient quantities (1 phase, shipped 2026-04-29). Earlier: [v3-post-mvp-1](../docs/plan/_archived/v3-post-mvp-1/) — Stabilization, Polish & Sharing (2026-04-22 → 2026-04-24).

Last Updated: 2026-05-03


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

- [2026-05-03] Phase 2 dev verification + fixes (commit/deploy still pending)
  - Browser smoke test confirmed all 4 originally-planned surfaces: RecipeDetail hero, RecipeCard browse-page thumb, RecipeCardCompact (SmartBrowse carousels at top of /recipes), SharedRecipe public hero
  - **Variant processor switched libvips → ImageMagick (mini_magick)** in `config/initializers/active_storage.rb` — user preference; prod Mac already has `imagemagick` installed via brew. Aligns dev (Arch) and prod (macOS) on the same processor; previously plan called for libvips, but neither dev nor prod had a hard dependency on it yet
  - **Variant options flattened**: `saver: { strip: true, quality: 85 }` is vips-specific and crashed on mini_magick (`UnsupportedImageProcessingMethod: saver.`). Changed `recipe.rb:38-39` to flat `strip: true, quality: 85` which both backends accept. Variation digest changes → existing variant_records are stale but harmless; new variants regenerate lazily on first hit
  - **2 missed render surfaces** caught by `grep image_url` audit across components (the original Phase 2 plan named 4 surfaces; reality was 6):
    - `EntryPicker.tsx:324` (meal plan recipe search picker, 40×40 thumb)
    - `AddRecipesModal.tsx:102` (collection's "Add Recipes" picker, 40×40 thumb)
    - Both wired with `(image_thumb_url ?? image_url) ?? ""` fallback chain matching existing convention. `LeftoverTray.tsx` and `MealPlan.tsx` declare the type but don't render thumbs, no fix needed
  - **Backend serializer drift caught** (this was the most interesting find): collection detail page renders via `RecipeCard`, which already had the fallback chain. Yet recipes in collections still showed the C letter. Root cause: `CollectionsController#serialize_recipe_summary` was a *duplicate* of `RecipesController#serialize_recipe` and Phase 2 had only updated one. Two payload paths, same shape on the surface, drifted on the new fields
  - **Refactor: extracted `serialize_recipe` to `ApplicationController`** as single source of truth. `CollectionsController` now calls the shared method; `serialize_recipe_summary` deleted. `SharedRecipesController#serialize_public_recipe` left alone — legitimately different (anonymous public payload, no household-internal fields like `my_rating`/`share_token`)
  - **Worth remembering:** when adding fields to a payload, grep ALL controllers that emit recipe-shaped responses, not just the ones named in the plan. Same lesson on the frontend re: image_url usage. The duplication was the actual root cause of the surfaces drift
  - **Verification:** 308/308 backend tests pass with all three changes (processor swap + flattened options + extracted serializer); browser confirmed all 6 surfaces render after fixes
  - **Deviation from initial plan:** plan tech-stack table specified libvips; switched to ImageMagick globally based on user preference. Plan/runbook update bundled with deploy commit

- [2026-05-03] Phase 3 (Upload UI — file source) — dev-verified, deploy pending Phase 4
  - First pass shipped per the plan: standalone `RecipeImagesController` (`POST/DELETE /recipes/:apikey/image`), `RecipeImagePicker` component making API calls itself, immediate persist. 9 controller tests, all four manual flows working
  - **Big mid-phase pivot driven by UX feedback.** User noticed: "if I remove an image and click Back, the image is still removed." The picker's immediate-persist semantics violated the form's "everything-tentative-until-Save" model. Pulled the thread and rewrote: the image now travels in the recipes PATCH/POST as a multipart bundled payload. Atomic save, Back actually undoes, ~150 lines of standalone controller + tests deleted. Net code is smaller and the UX is consistent
  - **New shape:**
    - Backend: `RecipesController#recipe_params` permits `:image` (UploadedFile) and `:remove_image` flag. `extract_recipe_params` splits the flag off; `update` honours it after save (purge if remove_image && no replacement). `NILIFY_BLANK` constant normalises empty strings to nil for nullable fields (FormData can't represent JSON null natively). `tags: []` empty-array marker `compact_blank`'d
    - Frontend: `api/recipes.ts` introduces `ImageStaging = { kind: "none" } | { kind: "replace", file } | { kind: "remove" }`. `createRecipe`/`updateRecipe` send JSON when staging is none, FormData (with `appendNested` helper for Rails nested-params encoding) when there's an image change. Picker is fully controlled — receives `committedImageUrl` + `staging` + `onChange`, never makes API calls
    - RecipeForm holds the staging state; submit calls `onSubmit(input, imageStaging)`. RecipeNew + RecipeEdit pass through to the mutation. Picker is now usable on the new-recipe flow (no more "save first to add a photo")
  - **Cache invalidation gotcha:** initial implementation used `setQueryData(["recipe", apikey], res)` which didn't match RecipeDetail's actual key `["recipe", apikey, collectionApikey]`. Switched to `invalidateQueries({ queryKey: ["recipe", apikey] })` (partial-match) so detail page refetches on mount with fresh URLs. Also invalidates `["recipes"]`, `["smart-sections"]`, `["collections"]` when image changed
  - **Picker UI iterated based on feedback:**
    - Started with text-link "Undo" below the image — user noted it was hidden
    - Moved Undo to a third pill button alongside Replace + X (top-right cluster on image, top-right overlay on placeholder when remove-staged)
    - Simplified text from "Undo new photo (will apply on save)" to just "Undo" — the apply-on-save semantics are universal in the form, no need to repeat
  - **Polish hit during verification (separate from Phase 3 core):**
    - `RecipeCardCompact` images were stretching tall in the SmartBrowse carousels — `aspect-square` wasn't constraining height as expected. Switched to the same `paddingBottom: '100%'` + absolute-positioned IMG pattern that `RecipeCard` already uses for 4:3
    - Mobile carousel left margin: `-mx-4 px-4` breakout pattern was making cards flush to the left edge on mobile. Dropped the breakout entirely; cards now align with the title/header. Tradeoff: last card cuts off at parent's right padding instead of bleeding past — visually cleaner
    - `RecipeCard` row alignment in browse grid: cards in the same grid row weren't matching height because the inner `<motion.div>` and `<Link>` didn't have `h-full`, so they collapsed to content height inside the stretched grid cell. Added `h-full` to both. Cards in same row now match (CSS Grid default), cards in different rows can vary — natural variation per the user's preference (no forced whitespace)
  - **Backend tests:** 6 new tests for bundled image (update with image, create with image, remove_image flag, both new image + remove_image, oversize, wrong type). Net: 308 → 314 passing (deleted 9 standalone controller tests, added 6 bundled). All 314 pass
  - **Frontend:** build clean (real `tsc -b`), vitest 63/63
  - **Worth remembering:** "atomic save semantics matter for forms with embedded media" — the original design had the right shape on paper but broke the form's mental model in practice. Letting the bundled-payload version replace it produced *less* code, not more
  - **Worth remembering:** when adding a controller that needs request-context helpers like `serialize_recipe`, look for opportunities to extract to ApplicationController rather than calling `OtherController.new.send(:method, ...)` (the plan literally suggested the latter — recognised it as a smell mid-phase and went with the extraction instead)
  - Plan reference: `docs/plan/phases/phase-3.md`. The plan doc now diverges from what shipped — the standalone-endpoint structure was retired; phase-3.md describes the original approach and reads as historical guidance

- [2026-05-03] Phase 4 (URL paste + share-copy deep-copy) — dev-verified, deploy in flight
  - **`down ~> 5.4` gem added** for image URL fetching. Used over `Net::HTTP` (which we already use elsewhere for HTML fetching) because image fetching needs concerns Net::HTTP doesn't natively handle: streaming download with `max_size` cap, automatic redirect chains, content-type sniffing. Janko Marohnić's gem (also Shrine).
  - **`ImageUrlFetcher` service** at `app/services/image_url_fetcher.rb`: scheme guard (http/https only — blocks `file://` SSRF vectors), 10 MB cap, content-type allowlist, redirect cap, timeout. Returns a `Result` struct with either `tempfile/filename/content_type` or `error` (predicate-style string). 11 service tests covering happy path, oversize, timeout, wrong content-type, malformed URL, non-http scheme, generic Down::Error wrapping.
  - **Bundled into recipes_controller** rather than a separate endpoint (consistent with Phase 3's atomic-save architecture). `recipe_params` permits `:image_url_to_fetch`; `extract_recipe_params` splits it off and runs `ImageUrlFetcher.fetch` if set (and no multipart `:image` is also present — multipart wins). On success, the resulting Tempfile is wrapped in an `ActionDispatch::Http::UploadedFile` and assigned to `attrs[:image]` so it flows through the standard attach pipeline. On error, `@recipe.errors.add(:image, msg)` and render_validation_errors. 5 new controller tests.
  - **`SharedRecipesController#copy` deep-copies the source attachment**: after `copy.save`, if `source.image.attached?`, attaches a fresh blob via `io: StringIO.new(source.image.download)`. Wrapped in rescue so a flaky storage backend doesn't undo the recipe save (logs warning instead). Tested: copy survives source's purge — independent blob ownership confirmed.
  - **Frontend**: `ImageStaging` union extended with `{ kind: "replace_url", url: string }`. `buildRecipeFormData` appends `recipe[image_url_to_fetch]` for that variant. Picker grew a "Upload / From URL" toggle in the empty state — URL mode shows `<input type="url">` + Add button; staging the URL displays it as `<img src>` directly so the browser pre-validates.
  - **Worth remembering — error message duplication:** Rails' `errors.full_messages` auto-prepends the humanised attribute name. `errors.add(:image, "Image must be under 10 MB")` renders as "Image Image must be under 10 MB" (doubled). Caught when user reported "Image Couldn't fetch the image". Fix: all fetcher messages are predicate-only ("must be under 10 MB", "URL is invalid", "couldn't be loaded — check the URL and try again"). Worth noting: the model validators got it right; my fetcher initially didn't because I copy-pasted from the plan doc which used full sentences.
  - **Worth remembering — FormData null vs undefined semantics**: my initial `appendNested` treated null and undefined identically (emit empty string). This broke quick_meal recipes whose `ingredient_groups` is `undefined` for that recipe type — Rails parsed `recipe[ingredient_groups]=""` as a string, failing the model's array validation. Fixed: `undefined` → omit the key entirely (field not specified for this recipe type), `null` → emit "" (user explicitly cleared a nullable scalar; backend NILIFY_BLANK normalises). Distinction matters: undefined ≠ null in this encoding.
  - **Worth remembering — sanitising third-party error details**: `Down::Error.message` carries underlying Net::HTTP/SSL details ("Failed to open TCP connection to example.com:443 (getaddrinfo: Name or service not known)"). Surfacing those verbatim is noisy and leaks implementation. Now logged at `Rails.logger.warn` for debugging but the user sees a friendly message.
  - **Verification**: 332/332 backend (was 314, +5 controller URL tests + 11 service tests + 2 share-copy tests, minus 0 deletions). Frontend build clean, vitest 63/63. Manual flows: URL paste happy path, 404, non-image, scheme guard, share-copy roundtrip with attachment.
  - **Plan note**: Phase 4 plan was written for Phase 3's original standalone-endpoint shape. Adapted on the fly to the bundled-payload approach. The plan doc reads as historical context, not as the actual shipped architecture.

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
