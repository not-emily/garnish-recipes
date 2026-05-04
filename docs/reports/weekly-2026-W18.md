# Weekly Report - Garnish - Week of 2026-04-27 (ISO Week 18)

## Week Overview
A small fraction-support plan landed at the start of the week (2026-04-29), then a four-phase image-upload + R2 plan ran across the rest of the week — Phase 1 (R2 + offsite DB backup) and Phase 2 (recipe model + display) on 2026-04-30, Phases 3 (file upload UI) and 4 (URL paste + share-copy deep-copy) on 2026-05-03. Phase 3 went through a substantial mid-phase rewrite from a standalone-endpoint design to a bundled-multipart-payload approach when UX testing revealed the original design violated the form's "tentative-until-Save" mental model. All four phases verified in dev by week's end; deploy in flight.

## Key Accomplishments

### Fraction Support (2026-04-29 — own mini-plan, archived)
- `frontend/src/lib/quantity.ts`: parseQuantity / formatQuantity / unitClass / replaceFractionalPart — accepts integers, decimals, ascii fractions (`3/4`, `1 3/4`, `1-3/4`), unicode glyphs (`¾`, `1¾`); unit-class-driven display (cup/tsp/tbsp → fraction with halves/thirds/quarters/eighths snap; g/kg/oz/lb/ml/l → decimal)
- 50-test Vitest suite covering parser, formatter, unit classifier, chip-helper, plus round-trip — also serves as the canonical spec for the future Ruby port (imported-recipe-parsing backlog)
- `FractionChipRow` component: focus-triggered, deterministic 4+4 wrap layout, `onMouseDown preventDefault` survives the input-blur race; visibility tied to `focused && unitClass(unit) === "fractional"` (refined from focus-only — chips don't appear when unit is `g`/`lb`)
- IngredientEditor rewritten — quantity input switched from `<input type="number">` to text with parser-driven blur. Auto-revert on truly unparseable input (~5 lines vs ~30 of validity-bubbling cross-component plumbing)
- GroceryList AddItemForm + EditItemModal got the same treatment; chip row spans full modal width
- Plan archived to `_archived/v4-fraction-support/`

### Brand Identity (2026-04-29)
- `scripts/generate-icons.sh` — Twemoji v14.0.2 pinned, parameterized by codepoint and bg color, writes favicon.svg + apple-touch-icon-180.png + icon-192.png + icon-512.png + icon-maskable-512.png
- 🌿 (parsley sprig) replaces purple Vite-default favicon. Literal name match (a "garnish" IS the herb sprig) and color alignment with `garnish-green`

### Grocery Manual-Add UX (2026-04-30 — long-standing follow-up resolved)
- `frontend/src/lib/ingredientMapping.ts`: `lookupMapping` is plural-aware (tries exact → strip `s`/`es` → add `s`/`es` — mirrors `categorize.ts`), `upsertMapping` returns a new array. 13 Vitest cases
- Cache freshness fix in `useGroceryList.ts`: addItem/updateItem `onSuccess` now patches `data.mappings` via `upsertMapping` (alongside the existing `data.items` patch). Before: cache stayed stale until 15s refetch / focus event / page refresh — symptom was "update yogurt's store, immediately type 'yogurt' again, no auto-fill until refresh"
- Backend `GroceryListsController#add_item` calls `learn_mapping` after save (symmetric with `update_item`) so first-time adds train the system
- **Deviation:** original direction was a ~5-line server-side fix to consult `IngredientCategoryMapping` invisibly. Switched to frontend-driven lookup as user types — visible feedback, override-friendly, connection-resilient

### Image Upload + R2 Plan — Phase 1: R2 Setup + DB Backup Offsite (2026-04-30)
- Cloudflare R2 bucket `garnish-prod` created with scoped Object Read/Write API token; account-id + creds wired into `~/.garnish/.env` on prod Mac (chmod 600)
- aws-cli v2 installed via official .pkg installer; `r2` profile configured against R2 endpoint
- `scripts/backup-db.sh` extended: sources `~/.garnish/.env`, gzips pg_dump output, conditionally `aws s3 cp` to `s3://garnish-prod/db/latest.sql.gz` (overwrites nightly, no retention by design — local 14-day rolling stays as primary recovery layer)
- Restore drill on scratch DB: `aws s3 cp` → `gunzip` → `psql` → row counts matched prod → cleanup. Full recovery hierarchy verified
- `docs/runbooks/backup-restore.md` (107 lines): backup paths, recovery hierarchy, manual-run, local restore, R2 restore, common-failures table (8 modes), drill triggers
- **Surfaced during planning:** existing 3am cron had been silently failing for 17 days — missing `~/.garnish/backups` directory blocked the redirect-to-cron.log, AND `pg_dump` not in cron's minimal PATH. Both fixed inline

### Image Upload + R2 Plan — Phase 2: Recipe Model + Display (2026-04-30 dev work, 2026-05-03 verification)
- `Recipe#image` ActiveStorage attachment with `thumb` (600×450 4:3) and `detail` (1200×900 4:3) variants. Hybrid design: `image_url` STRING field stays for URL-ingestion captures (og:image, JSON-LD); attachment is for explicit user uploads. Display fallback: attachment → url string → letter
- 10 MB cap, content-type allowlist (jpeg/png/webp/heic/heif). Validators call `image.purge` before adding error so we don't leave orphan blobs
- `attachment_variant_url` helper added to `ApplicationController`; emits `image_thumb_url` / `image_detail_url` consistently across recipe + shared_recipe serializers
- Cache-Control patches on ProxyController (`public, max-age=31536000, immutable`) — blob URLs are signed-token-stable, safe to mark immutable; CF caches at edge after first hit
- Frontend display fallback chain wired across RecipeCard, RecipeCardCompact, RecipeDetail, and SharedRecipe (last one was missing a hero entirely; now added)
- **Verification day (2026-05-03) caught two regressions:**
  - Variant processor switched libvips → ImageMagick (mini_magick) for dev/prod parity. Required flattening variant options: `saver: { strip:, quality: }` is vips-specific and crashed mini_magick
  - Two missed render surfaces (`EntryPicker` meal-plan picker, `AddRecipesModal` collection picker) — plan named 4 surfaces, reality was 6
  - Backend serializer drift (most interesting find): collection page rendered via `RecipeCard` which had the fallback chain, yet still showed C letters. Root cause: `CollectionsController#serialize_recipe_summary` was a duplicate of `RecipesController#serialize_recipe` and Phase 2 had only updated one. Refactored: `serialize_recipe` extracted to `ApplicationController` as single source of truth

### Image Upload + R2 Plan — Phase 3: File Upload UI (2026-05-03)
- **Mid-phase rewrite from UX feedback.** Initial implementation matched the plan: standalone `RecipeImagesController` + endpoint + `RecipeImagePicker` making API calls itself + immediate persist. 9 tests, all 4 manual flows working. User testing surfaced: "if I remove an image and click Back, the image is still removed." Picker's immediate-persist semantics violated the form's "everything-tentative-until-Save" model
- Pulled the thread and rewrote: image now travels in the recipes PATCH/POST as a multipart bundled payload. Atomic save, Back actually undoes, ~150 lines of standalone controller + tests deleted. Net code is smaller and the UX is consistent
- New shape:
  - Backend: `recipe_params` permits `:image` (UploadedFile) and `:remove_image` flag. `extract_recipe_params` splits the flag off; `update` honours it after save (purge if remove_image && no replacement). `NILIFY_BLANK` constant normalises empty strings to nil for nullable fields. `tags: []` empty-array marker compact_blank'd
  - Frontend: `ImageStaging = { kind: "none" } | { kind: "replace", file } | { kind: "remove" }`. createRecipe/updateRecipe send JSON when staging is none, FormData (with `appendNested` Rails-nested-params encoder) when there's an image change. Picker is fully controlled — receives `committedImageUrl` + `staging` + `onChange`, no internal API calls
  - RecipeForm holds the staging state; submit calls `onSubmit(input, imageStaging)`. Picker now usable in new-recipe flow (no more "save first to add a photo")
- **Cache invalidation gotcha:** initial implementation used `setQueryData(["recipe", apikey], res)` which didn't match RecipeDetail's actual key `["recipe", apikey, collectionApikey]`. Switched to `invalidateQueries({ queryKey: ["recipe", apikey] })` partial-match
- **Picker UI iterated based on feedback:** Started with text-link Undo (hidden), moved to a third pill button alongside Replace + X. Simplified text from "Undo new photo (will apply on save)" to just "Undo" — apply-on-save semantics are universal in the form
- **UI polish surfaced during verification:** RecipeCardCompact aspect-square wasn't constraining height in carousels (switched to padding-bottom + absolute IMG); mobile carousel `-mx-4 px-4` breakout pushed cards flush to left edge (dropped breakout); RecipeCard grid row alignment broken because inner `motion.div` + `Link` lacked `h-full`

### Image Upload + R2 Plan — Phase 4: URL Paste + Share-Copy Deep-Copy (2026-05-03)
- New `down ~> 5.4` gem (Janko Marohnić, also Shrine) for image URL fetching — chose over the existing Net::HTTP HTML fetcher because image fetching needs streaming download with `max_size` cap (rejects >10 MB before fully downloading), automatic redirect chains, content-type sniffing
- `ImageUrlFetcher` service: scheme guard (http/https only — blocks `file://` SSRF vectors), 10 MB cap, content-type allowlist, redirect cap, timeout. Returns Result struct with `tempfile/filename/content_type` or predicate-style `error`. 11 service tests
- Bundled into recipes_controller (consistent with Phase 3's atomic-save architecture, not a separate endpoint). `recipe_params` permits `:image_url_to_fetch`; on success, the resulting Tempfile is wrapped in an `ActionDispatch::Http::UploadedFile` and assigned to `attrs[:image]` so it flows through the standard attach pipeline
- `SharedRecipesController#copy` deep-copies the source attachment via `io: StringIO.new(source.image.download)`. Independent blob ownership per household — purging source doesn't break the copy. Tested
- Frontend: `ImageStaging` extended with `{ kind: "replace_url", url }`. Picker grew Upload/From-URL toggle in empty state; URL mode shows `<input type="url">` + Add button; staging displays the URL as `<img src>` directly so the browser pre-validates
- **Plan note:** Phase 4 plan was written for Phase 3's original standalone-endpoint shape. Adapted on the fly to bundled-payload approach

### Other (2026-04-29)
- Frontend lockfile fix for Cloudflare Pages — first Phase 1 deploy failed with `npm ci`: "Missing: @emnapi/core@1.10.0". Fixed by `rm -rf node_modules package-lock.json && npm install` from clean. Second instance of deploy-environment-divergence (first was TS project-references in post-mvp-1)

## Decisions This Week

No new entries appended to `DECISIONS.md` — decisions were captured in commit messages and PROJECT_PROGRESS. Notable ones:

1. **Hybrid `image_url` (string) + `image` (attachment)** — keeps hotlinked URL-ingestion captures untouched (legal cleanness, no third-party redistribution), avoids backfill migration. User-explicit uploads use ActiveStorage. Display picks via fallback chain.
2. **Rails proxy URLs over custom subdomain** — Cloudflare Universal SSL doesn't cover multi-level wildcards (`images.garnish.1bit2bit.dev`); proxy URLs with strong `Cache-Control: immutable` buy back almost all the CDN edge benefit without a paid Advanced Cert Mgr. Bonus: migration-safe (URLs decouple from storage backend).
3. **Multipart upload over direct-to-R2** — at 10 MB caps, multipart through Rails is fine; defer presigned-URL flow until uploads feel slow on cellular.
4. **Two variants only: thumb + detail** — RecipeCard/Compact use thumb (CSS `object-cover`), RecipeDetail/SharedRecipe use detail. Two variants cover all surfaces; per-surface variants would double storage ops for marginal benefit.
5. **Variant processor: ImageMagick (mini_magick), not libvips** — user preference; prod Mac already had imagemagick installed via brew. Aligns dev (Arch) and prod (macOS) on the same processor. Plan tech-stack table updated.
6. **Bundled multipart payload (Phase 3 pivot)** — image travels in the recipes PATCH/POST, not a separate endpoint. Atomic save, Back undoes everything, ~150 lines of standalone controller + tests deleted. Smaller code AND better UX.
7. **`undefined` ≠ `null` in FormData encoding** — `undefined` means "field not specified" (omit key entirely); `null` means "user cleared a nullable scalar" (emit `""`, backend NILIFY_BLANK normalises). Distinction matters: emitting `recipe[ingredient_groups]=""` for undefined breaks Rails' array-shape validation for quick_meal recipes
8. **`serialize_recipe` extracted to ApplicationController** — eliminated the duplicate in CollectionsController that was the actual root cause of "recipes in collections still show C letter" drift after Phase 2

## Challenges Encountered

- **vips → mini_magick option flattening** — `saver: { strip:, quality: }` is vips-specific and crashes mini_magick with `UnsupportedImageProcessingMethod`. Caught immediately on first browser test; flat `strip: true, quality: 85` works for both backends. Variation digest changed → existing variant_records were stale but harmless
- **Detail page cache key mismatch** — `setQueryData(["recipe", apikey], res)` didn't match RecipeDetail's `["recipe", apikey, collectionApikey]`; user saw stale data on the detail page after edit-save until refresh. Switched to partial-match invalidate
- **Two missed render surfaces** — plan named 4 (RecipeCard, RecipeCardCompact, RecipeDetail, SharedRecipe), reality was 6 (also EntryPicker, AddRecipesModal). Lesson: when adding a payload field, grep ALL components that read the type, not just the ones the plan names
- **Backend serializer drift** — three controllers had three serializers (RecipesController, CollectionsController, SharedRecipesController). Phase 2 updated only the first. Collection page rendered via shared `RecipeCard` so the *component* fallback chain was right, but the *data* was missing the new fields. Refactor to ApplicationController eliminated the drift class
- **FormData empty-array shape** — `recipe[ingredient_groups]=""` (sent for undefined ingredient_groups in quick_meal recipes) was parsed by Rails as a string, breaking the `is_a?(Array)` validation. Fix: distinguish `undefined` (omit key) from `null` (emit empty string for backend NILIFY_BLANK)
- **Rails error message double-prefix** — `errors.add(:image, "Image must be under 10 MB")` renders as "Image Image must be under 10 MB" via full_messages. Caught when user reported "Image Couldn't fetch the image". Predicate-only messages everywhere now ("must be under 10 MB", "URL is invalid", etc.)
- **Bin/cli paths in 5.x mini_magick** — Plan suggested `MiniMagick.cli_path = "/usr/local/bin"`, but mini_magick 5.x dropped the setter. Need to prepend ENV[PATH] directly in the initializer instead. Discovered during prod deploy

## Metrics

- **Commits:** 17 total in W18 (from `0698917` "Phase 1: fraction support" through `45cd4e3` "Phase 4: image URL paste + share-copy attachment deep-copy")
- **Plans completed in dev:** 2 (fraction support archived; image-upload + R2 plan all 4 phases dev-verified)
- **Backend tests:** 270 → 332 passing (+62 net across the week, including +50 quantity tests, +5 model image tests, +6 controller image tests, +5 URL fetch tests, +11 service tests, +2 share-copy tests)
- **Frontend vitest:** 50 → 63 passing (+13 ingredientMapping tests)
- **New gems:** `down ~> 5.4` (image URL fetching), Vitest as dev dep
- **New scripts:** `scripts/generate-icons.sh` (Twemoji icon pipeline)
- **New runbooks:** `docs/runbooks/backup-restore.md`
- **Days from plan-start to dev-complete (image-upload plan):** 4 (2026-04-30 → 2026-05-03)

## Next Week Priorities

1. **Finish prod deploy of Phases 2/3/4** — push + deploy to the Mac, verify R2 actually receives uploads (`aws s3 ls` count grows), test URL paste + share-copy on prod
2. **Archive the v5-recipe-images-r2 plan** — `git mv docs/plan/plan.md docs/plan/phases docs/plan/_archived/v5-recipe-images-r2/`. Update PROJECT_PROGRESS Plan Files section
3. **Cron verification** — confirm last week's 3am backup cron has been running successfully (`tail ~/.garnish/backups/cron.log` + `aws s3 ls s3://garnish-prod/db/`)
4. **Pre-warm variant generation** — background job that calls `.processed` on thumb + detail after upload so the first user to hit the variant URL doesn't pay the (R2 download → ImageMagick → stream) cost
5. **Loose ends from prior weeks** — real-device iOS verification, mutation-button audit (meal-plan/import/collection), `/health` baseline run after deploy
6. **Investigate "reconnecting" overlay frequency on production** — surfaced multiple times during W17/W18 work; not blocking but worth its own look. Candidates: CF Tunnel WS idle, indicator threshold flashing on single missed ping, auth-token refresh interaction
