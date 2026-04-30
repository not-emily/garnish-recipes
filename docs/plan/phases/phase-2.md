# Phase 2: Recipe Model + Image Display

> **Depends on:** Phase 1 (R2 must be reachable for prod uploads)
> **Enables:** Phase 3 (upload UI), Phase 4 (URL paste, share-copy)
>
> See: [Full Plan](../plan.md)

## Goal

Add `has_one_attached :image` to the Recipe model with `thumb` + `detail` variants, surface attachment URLs in the recipe serializer with hybrid fallback to the existing `image_url` string field, and render images across all four display surfaces (closing the SharedRecipe hero gap along the way).

## Key Deliverables

- `Recipe#image` attachment with `thumb` (600×450) and `detail` (1200×900) variants
- Server-side validation: 10 MB cap, content-type check (allow only `image/*`)
- Recipe serializer outputs `image_thumb_url`, `image_detail_url` (proxy URLs), `image_url` (existing string) — frontend picks via fallback chain
- All four display surfaces render the right variant: `RecipeCard` (thumb 4:3), `RecipeCardCompact` (thumb 1:1), `RecipeDetail` (detail 16:9), **`SharedRecipe` (detail 16:9, currently no image)**
- Cache-Control headers on proxy responses: `public, max-age=31536000, immutable`
- Backend tests for variants and serializer hybrid logic

No upload UI yet — that's Phase 3. Verification in this phase happens via Rails console attaching a test image directly to a recipe.

## Files to Create / Modify

### Backend
- `backend/app/models/recipe.rb` — modify: `has_one_attached :image`, validations, variants
- `backend/app/controllers/api/v1/recipes_controller.rb` — modify: `serialize_recipe` adds two new URL fields
- `backend/app/controllers/api/v1/shared_recipes_controller.rb` — modify: `serialize_public_recipe` adds same two fields
- `backend/config/initializers/active_storage.rb` — new: set proxy URL Cache-Control header
- `backend/test/models/recipe_test.rb` — modify: tests for validation + variants
- `backend/test/controllers/api/v1/recipes_controller_test.rb` — modify: serializer URL output

### Frontend
- `frontend/src/types/recipe.ts` — modify: add `image_thumb_url?`, `image_detail_url?` (both optional, nullable)
- `frontend/src/components/recipes/RecipeCard.tsx` — modify: prefer `image_thumb_url`, fall back to `image_url`
- `frontend/src/components/recipes/RecipeCardCompact.tsx` — modify: same fallback
- `frontend/src/pages/RecipeDetail.tsx` — modify: prefer `image_detail_url`, fall back to `image_url`
- `frontend/src/pages/SharedRecipe.tsx` — modify: ADD hero (currently missing), with same fallback

## Dependencies

**Internal:** Phase 1 (R2 reachable)

**External:** none new — `image_processing` and `aws-sdk-s3` already in Gemfile.

## Implementation Notes

### 2.1 Recipe model

```ruby
# backend/app/models/recipe.rb

class Recipe < ApplicationRecord
  # ... existing code ...

  has_one_attached :source_file  # existing — for ingestion artifacts, leave alone
  has_one_attached :image do |attachable|
    attachable.variant :thumb,  resize_to_fit: [600, 450], saver: { strip: true, quality: 85 }
    attachable.variant :detail, resize_to_fit: [1200, 900], saver: { strip: true, quality: 88 }
  end

  validate :image_size_within_limit
  validate :image_content_type_allowed

  private

  def image_size_within_limit
    return unless image.attached?
    if image.byte_size > 10.megabytes
      image.purge
      errors.add(:image, "must be under 10 MB")
    end
  end

  def image_content_type_allowed
    return unless image.attached?
    unless image.content_type.in?(%w[image/jpeg image/png image/webp image/heic image/heif])
      image.purge
      errors.add(:image, "must be JPEG, PNG, WebP, or HEIC")
    end
  end
end
```

**Deviation watch:**
- `resize_to_fit` preserves aspect ratio (variant won't be exactly 600×450 — may be smaller in one dimension). That's intentional — CSS `object-cover` handles visual cropping consistently across surfaces. `resize_to_fill` would crop server-side; we don't want that.
- `strip: true` removes EXIF metadata (orientation, GPS, camera info). Privacy + smaller file size. Note: stripping EXIF can lose orientation data — image_processing's `auto_orient` is on by default, so the rotated bitmap is what gets stored. Verify on iPhone portrait shots.
- `image.purge` inside the validator deletes the failed upload immediately (don't leave orphan blobs in R2). The order matters: purge first, then add error.
- HEIC support depends on libvips compiled with HEIF support. On macOS via `brew install vips`, HEIF is included. If a HEIC upload fails with libvips error, fall back to rejecting HEIC and asking the user to convert.

### 2.2 Recipe serializer

In `RecipesController#serialize_recipe` (around line 260) and `SharedRecipesController#serialize_public_recipe` (around line 105), add the hybrid URL fields:

```ruby
def serialize_recipe(recipe, full: false)
  base = {
    # ... existing fields ...
    image_url: recipe.image_url,  # existing string field, keep
    image_thumb_url: variant_url(recipe, :thumb),
    image_detail_url: variant_url(recipe, :detail),
  }
  # ... existing full-vs-summary logic ...
end

private

def variant_url(recipe, name)
  return nil unless recipe.image.attached?
  Rails.application.routes.url_helpers.rails_storage_proxy_url(
    recipe.image.variant(name),
    host: request.host_with_port,
    protocol: request.protocol,
  )
end
```

**Deviation watch:**
- Use `rails_storage_proxy_url`, NOT `rails_storage_redirect_url` or `rails_blob_url`. The proxy variant streams bytes through Rails (cacheable by CF in front). Redirect would 302 to the R2 signed URL each time — defeats caching.
- Pass `host:` and `protocol:` explicitly. Without them, the URL helper raises `ArgumentError: Missing host` in API-only mode.
- `recipe.image.variant(:thumb)` is lazy — generates on first request, caches in `active_storage_variant_records`. The first viewer per blob waits ~500ms; subsequent viewers hit cache.

### 2.3 Cache-Control on proxy responses

```ruby
# backend/config/initializers/active_storage.rb

Rails.application.config.after_initialize do
  ActiveStorage::Blobs::ProxyController.class_eval do
    after_action :set_cache_headers, only: [:show]

    private

    def set_cache_headers
      response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    end
  end

  ActiveStorage::Representations::ProxyController.class_eval do
    after_action :set_cache_headers, only: [:show]

    private

    def set_cache_headers
      response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    end
  end
end
```

**Deviation watch:**
- ActiveStorage's default proxy response sets `Cache-Control: max-age=3600, private`. We override to `public, immutable` because blob URLs are signed — they're effectively unique-per-content. CF caches public responses; private would skip the edge.
- `immutable` tells the browser not to revalidate. Safe because the URL changes if the blob does (signed URL includes blob signed_id).
- `after_initialize` ensures the controllers are loaded before we class_eval them.

### 2.4 Frontend types + display fallback

```ts
// frontend/src/types/recipe.ts

export interface RecipeSummary {
  // ... existing ...
  image_url?: string | null;
  image_thumb_url?: string | null;
  image_detail_url?: string | null;
}
```

In each display component, replace `recipe.image_url` with the fallback chain:

```tsx
// RecipeCard.tsx — uses thumb (4:3 with object-cover crop)
const src = recipe.image_thumb_url ?? recipe.image_url ?? null;

// RecipeCardCompact.tsx — uses thumb (1:1 with object-cover crop)
const src = recipe.image_thumb_url ?? recipe.image_url ?? null;

// RecipeDetail.tsx — uses detail (16:9 with object-cover crop)
const src = recipe.image_detail_url ?? recipe.image_url ?? null;

// SharedRecipe.tsx — ADD the hero block (it's currently missing)
const src = recipe.image_detail_url ?? recipe.image_url ?? null;
```

The existing render structure stays — `<img src={src}>` with `object-cover`. Letter fallback unchanged when `src` is null.

**SharedRecipe gotcha:** the current page has no image element at all. Add it above the title block, mirroring the structure used in `RecipeDetail.tsx` (lines 349–361):

```tsx
{src && (
  <div className="aspect-[16/9] overflow-hidden rounded-xl bg-gradient-to-br from-garnish-50 to-garnish-100 mb-6">
    <img
      src={src}
      alt={recipe.title}
      className="h-full w-full object-cover"
      loading="lazy"
    />
  </div>
)}
```

If `src` is null, no hero — keep the page tighter rather than adding a gradient placeholder for shared recipes (signed-out users may not need the visual real estate).

## Validation

- [ ] Rails console attach test: `recipe.image.attach(io: File.open("test.jpg"), filename: "test.jpg", content_type: "image/jpeg")` succeeds
- [ ] `recipe.image.variant(:thumb).processed.url` returns a working URL in dev (local disk) and prod (R2)
- [ ] Validation fails with clear error when uploading > 10 MB or non-image content-type — and the partial blob is purged from storage
- [ ] Serializer returns `image_thumb_url` and `image_detail_url` populated when attached, null when not, plus `image_url` always (matches old behavior)
- [ ] Frontend display: a recipe with only `image_url` (existing data) still renders correctly (string fallback works)
- [ ] Frontend display: a recipe with attachment shows the proxy URL variant, not the string URL
- [ ] SharedRecipe hero now renders for image-bearing recipes; absent for image-less ones
- [ ] Network inspector confirms `Cache-Control: public, max-age=31536000, immutable` on proxy responses
- [ ] Backend tests pass: model validations, serializer URL output
- [ ] Frontend build clean (`npm run build`)
