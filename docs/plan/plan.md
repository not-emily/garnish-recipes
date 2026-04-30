# Recipe Images + R2 Backups: User-uploaded images and offsite DB backups via Cloudflare R2

> **Status:** Planning complete | Last updated: 2026-04-30
>
> Phase files: [phases/](phases/)

## Overview

Two related initiatives bundled under one R2 bucket. The image work adds user-uploaded recipe images via ActiveStorage, coexisting with the existing `image_url` string field used by URL ingestion (so URL-imported recipes stay hotlinked, user-uploaded images go to R2). The backup work extends the existing nightly `pg_dump` cron to push gzipped dumps to R2 as `latest.sql.gz`, giving offsite recovery in the "MacBook swept away in a flood" scenario.

R2 is the foundation — Phase 1 stands it up and ships the DB backup as immediate standalone value before any image bytes flow through it.

## Core Vision

- **Hybrid image strategy, not migration** — keep hotlinked URLs for ingestion-sourced images (legal cleanness, no third-party redistribution). Add ActiveStorage for user-explicit uploads and URL pastes. Display picks via fallback chain: attachment → url string → letter fallback.
- **Cheap durable offsite backup before features** — R2 is small, ops-y, immediately useful. Earns its keep before image work starts.
- **No DNS work** — Rails proxy URLs (`rails_storage_proxy_url`) with strong `Cache-Control` headers buy back almost all the CDN edge benefit without spending a multi-level wildcard SSL cert. Migration-safe: storage backend swap doesn't touch URLs.
- **No premature optimization** — defer content-hash dedup, direct-to-R2 upload, and image cropping until they actually matter.

## Requirements

### Must Have
- Cloudflare R2 bucket with API token wired to backend env vars (`CLOUDFLARE_R2_*` already referenced in `storage.yml`)
- DB backup script extended to push gzipped `pg_dump` to R2 as `latest.sql.gz` nightly (overwrite, no retention)
- Recipe model: `has_one_attached :image` with `thumb` (600×450) and `detail` (1200×900) variants via `image_processing`
- Recipe serializer surfaces hybrid display URLs (attachment variants OR `image_url` fallback)
- Display rendering on RecipeCard, RecipeCardCompact, RecipeDetail, **and SharedRecipe** (currently missing entirely)
- Recipe form: file upload (camera capture + photo library on mobile) for image
- Recipe form: URL paste alternative — backend fetches, validates, stores via ActiveStorage
- Server-side validation: 10 MB cap, content-type check
- `SharedRecipesController#copy` deep-copies attachment bytes to new household (independent blob ownership)
- `Cache-Control: public, max-age=31536000, immutable` on proxy responses

### Nice to Have
- Restore drill: documented and rehearsed once
- Backup health monitoring (daily check that `latest.sql.gz` LastModified is fresh)

### Out of Scope
- Image cropping UI — `resize_to_fit` + CSS `object-cover` is fine for v1
- AI-generated images
- Image search
- Recipe gallery (multiple images per recipe) — defer until requested
- User avatars — separate plan, batched with Google OAuth
- Direct-to-R2 upload (presigned URLs) — multipart through Rails works for 10 MB
- Content-hash dedup — defer until storage approaches the 10 GB free tier
- Backfilling existing recipes' `image_url` strings into attachments — they keep hotlinking, no migration needed

## Constraints

- **R2 free tier:** 10 GB storage, 1M Class A ops/mo, 10M Class B ops/mo, $0 egress. Won't hit cap at friends-and-family scale.
- **SSL:** Cloudflare Universal SSL covers single-level subdomains only. Can't do `images.garnish.1bit2bit.dev` (multi-level wildcard requires paid Advanced Cert Mgr). Solution: Rails proxy URLs only.
- **Server:** prod runs on a MacBook Pro with Postgres at `/usr/local/pgsql/`. Cron has minimal PATH; backup script must hard-code the pg_dump path.
- **Tooling:** `aws-sdk-s3 ~> 1.150` and `image_processing ~> 1.13` already in Gemfile. ActiveStorage migrations already run. `aws-cli` for backup uploads is the one net-new install on the prod Mac.

## Success Metrics

- **DB backup:** nightly `latest.sql.gz` lands in R2; `aws s3 ls` shows yesterday's date in LastModified.
- **Restore drill:** download → gunzip → `psql` cleanly produces a working DB on a scratch instance.
- **Recipe images:** full upload → display → share-copy roundtrip works end-to-end. New household sees the image; deleting from one household doesn't break the other.
- **Cache headers:** Cloudflare cache hit rate above ~85% on image proxy URLs after warm-up (visible in CF dashboard).

## Architecture Decisions

### 1. Hybrid `image_url` (string) + `image` (attachment)
**Choice:** Keep `image_url` string field for URL-ingestion-captured images. Add `has_one_attached :image` for user-explicit uploads and URL pastes.
**Rationale:** Sidesteps third-party redistribution concerns (we hotlink og:image instead of mirroring it). Avoids backfill migration on existing recipes. User can override with their own upload anytime — attachment takes precedence.
**Trade-offs:** Two paths in display logic (fallback chain). Slightly more bookkeeping in serializer. Some hotlinks will rot when source sites die — accept that and let users re-upload.

### 2. Rails proxy URLs over custom subdomain
**Choice:** Use `rails_storage_proxy_url` with `Cache-Control: public, max-age=31536000, immutable`. CF caches at the edge after first hit.
**Rationale:** SSL constraint rules out clean multi-level subdomains. Proxy route is migration-safe (URLs decouple from storage backend). Zero DNS work.
**Trade-offs:** First hit per blob goes through Rails (slight latency vs direct R2). Negligible at this scale; CF handles repeats.

### 3. Multipart upload over direct-to-R2
**Choice:** Browser → Rails → R2 via standard ActiveStorage multipart submission.
**Rationale:** Simpler. 10 MB caps make multipart fine. Defer presigned URL flow until uploads feel slow on cellular.
**Trade-offs:** Rails uses bandwidth on the upload path. Acceptable at this scale.

### 4. Two variants only: thumb + detail
**Choice:** Generate `thumb` (600×450 4:3) and `detail` (1200×900 4:3) via `resize_to_fit`. Originals stored too. Variants generated lazily on first request.
**Rationale:** RecipeCard/Compact use thumb (with CSS `object-cover` at 1:1, 4:3). RecipeDetail/SharedRecipe hero use detail at 16:9. Two variants cover all surfaces. `resize_to_fit` preserves aspect ratio (CSS handles cropping for visual consistency).
**Trade-offs:** Detail variant at 1200×900 won't fill 16:9 perfectly without slight zoom. Acceptable; alternative is per-surface variants which doubles storage ops.

### 5. Latest-only DB backup with overwrite
**Choice:** `latest.sql.gz` on R2, overwritten each night. Local 14-day rolling stays as primary recovery layer.
**Rationale:** R2 backup is for catastrophic loss only (laptop physically gone). User explicitly OK with limited offsite snapshot depth. Simpler script, ~zero R2 ops cost.
**Trade-offs:** A corrupted dump could overwrite a known-good one. Local 14-day rolling is the safety net.

### 6. Deep-copy on share/import (no blob sharing)
**Choice:** `SharedRecipesController#copy` does `copy.image.attach(io: source.image.download, filename: ..., content_type: ...)` to create independent blob bytes per household.
**Rationale:** ActiveStorage's purge cascade deletes the blob when an attachment is destroyed. Sharing a blob across households would break on first purge. Deep-copy = independent ownership.
**Trade-offs:** Storage doubles per share. At scale (low-thousands of recipes), well under free tier.

## Project Structure

Net-new files (within the existing Garnish monorepo):

```
garnish/
├── backend/
│   ├── app/
│   │   ├── controllers/api/v1/
│   │   │   └── recipe_images_controller.rb     # New: file upload + URL paste endpoint
│   │   └── services/
│   │       └── image_url_fetcher.rb            # New: validates + downloads pasted URL
│   └── test/
│       ├── controllers/api/v1/
│       │   └── recipe_images_controller_test.rb
│       └── services/
│           └── image_url_fetcher_test.rb
├── frontend/
│   └── src/
│       └── components/recipes/
│           └── RecipeImagePicker.tsx           # New: file + url tabs, preview, remove
├── scripts/
│   └── backup-db.sh                            # Modified: gzip + aws s3 cp
└── docs/
    └── runbooks/
        └── backup-restore.md                   # New: runbook for backup + R2 restore
```

### Modified files (existing)

- `backend/app/models/recipe.rb` — `has_one_attached :image`, variants, validations
- `backend/app/controllers/api/v1/recipes_controller.rb` — serializer hybrid URL output
- `backend/app/controllers/api/v1/shared_recipes_controller.rb` — deep-copy attachment, public serializer
- `backend/config/routes.rb` — `+POST /recipes/:id/image`, `+DELETE /recipes/:id/image`
- `backend/Gemfile` — `+gem "down", "~> 5.4"` (URL fetching)
- `frontend/src/components/recipes/RecipeCard.tsx` — prefer attachment thumb URL
- `frontend/src/components/recipes/RecipeCardCompact.tsx` — prefer attachment thumb URL
- `frontend/src/pages/RecipeDetail.tsx` — prefer attachment detail URL
- `frontend/src/pages/SharedRecipe.tsx` — add hero (was missing) + prefer attachment
- `frontend/src/components/recipes/RecipeForm.tsx` — wire `RecipeImagePicker`
- `frontend/src/types/recipe.ts` — `+image_thumb_url`, `+image_detail_url` optional fields
- `frontend/src/api/recipes.ts` — `+uploadRecipeImage`, `+removeRecipeImage`

## Core Interfaces

### Recipe serializer JSON output (added fields)

```jsonc
{
  "id": 42,
  "title": "Carnitas",
  "image_url": "https://example.com/og-image.jpg",     // existing string, may be null
  "image_thumb_url": "https://garnish.../proxy/...",   // new, null if no attachment
  "image_detail_url": "https://garnish.../proxy/...",  // new, null if no attachment
  // ... rest unchanged
}
```

Frontend display fallback (all surfaces):

```tsx
const src = recipe.image_thumb_url ?? recipe.image_url ?? null;
// or image_detail_url for hero surfaces
```

### Image upload endpoints

```
POST   /api/v1/recipes/:id/image
  Body: multipart/form-data with "image" file
   OR:  application/json with { "url": "https://..." }
  Response: 200 { data: { ...recipe with new image_thumb_url/image_detail_url } }
  Errors:  413 (too large), 415 (wrong content-type), 422 (validation), 401, 403, 404

DELETE /api/v1/recipes/:id/image
  Response: 200 { data: { ...recipe with cleared image_thumb_url/image_detail_url } }
```

## Implementation Phases

| Phase | Name | Scope | Depends On | Key Outputs |
|-------|------|-------|------------|-------------|
| 1 | R2 Setup + DB Backup Offsite | R2 bucket, env vars, aws-cli, extended backup script, restore drill, runbook | — | R2 reachable; nightly `latest.sql.gz`; `docs/runbooks/backup-restore.md` |
| 2 | Recipe Model + Image Display | `has_one_attached :image`, variants, serializer hybrid, all 4 display surfaces (incl. SharedRecipe hero gap) | Phase 1 | Image-bearing recipe via console renders correctly across UI |
| 3 | Upload UI — File Source | `RecipeImagePicker` component, file picker (camera + library), preview, multipart endpoint | Phase 2 | User uploads file → renders on card + detail |
| 4 | URL Paste + Share-Copy Deep-Copy | URL paste tab, server fetcher (validates + stores), deep-copy in `SharedRecipesController#copy` | Phase 3 | URL-pasted images store to R2; shared recipes copy attachment cleanly |

### Critical Path

1 → 2 → 3 → 4 (strictly sequential). Phase 1 must complete and verify before Phase 2 (R2 must be reachable for prod uploads). Phase 3 requires Phase 2's attachment binding + serializer. Phase 4 reuses Phase 3's controller scaffolding.

### Phase Details

- [Phase 1: R2 Setup + DB Backup Offsite](phases/phase-1.md)
- [Phase 2: Recipe Model + Image Display](phases/phase-2.md)
- [Phase 3: Upload UI — File Source](phases/phase-3.md)
- [Phase 4: URL Paste + Share-Copy Deep-Copy](phases/phase-4.md)

## Tech Stack Additions

| Category | Choice | Notes |
|----------|--------|-------|
| Object storage | Cloudflare R2 | Free tier: 10 GB, $0 egress. S3-compatible. |
| Image processing | `image_processing ~> 1.13` | Already in Gemfile. Uses libvips (already on Mac via Postgres.app or brew). |
| AWS SDK | `aws-sdk-s3 ~> 1.150` | Already in Gemfile. Used by ActiveStorage S3 adapter. |
| HTTP fetching | `down ~> 5.4` | New: robust URL fetching with redirect handling, content-type sniffing, max-size enforcement. |
| CLI for backups | `aws-cli` | New: `brew install awscli` on prod Mac. |

## Future Considerations

- **Direct-to-R2 upload** — switch to ActiveStorage `direct_upload` if 10 MB multipart feels slow on cellular. Adds CORS + presigned URL roundtrip.
- **Recipe gallery** — `has_many_attached :images`. Wait for an actual user request.
- **Image cropping** — server- or client-side. Current pipeline produces fine results.
- **Content-hash dedup** — store SHA-256 of original blob, skip duplicates. Defer until storage approaches free-tier ceiling.
- **User avatars** — fold into Google OAuth plan.
- **Restore automation** — `scripts/restore-db-from-r2.sh`. Until first real recovery, runbook is enough.
- **Backup health monitor** — daily script asserting `latest.sql.gz` LastModified is < 26 h. Add when paranoid.
