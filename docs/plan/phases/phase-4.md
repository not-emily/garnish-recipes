# Phase 4: URL Paste + Share-Copy Deep-Copy

> **Depends on:** Phase 3 (`RecipeImagePicker` exists; image controller scaffolding present)
> **Enables:** —
>
> See: [Full Plan](../plan.md)

## Goal

Add a URL paste pathway alongside the file source in `RecipeImagePicker` (server fetches, validates, stores via ActiveStorage), and extend `SharedRecipesController#copy` to deep-copy the attachment so shared recipes have independent blob ownership per household.

## Key Deliverables

- `RecipeImagePicker` gains a URL tab/toggle alongside file picker
- Backend service `ImageUrlFetcher` validates + downloads pasted URL with `Down`
- `POST /api/v1/recipes/:id/image` accepts JSON body with `url` field as alternative to multipart
- Validation: same 10 MB cap, content-type allowlist, plus URL format check + redirect cap (Down handles)
- `SharedRecipesController#copy` deep-copies `image` attachment via `io: source.image.download` (independent blob bytes)
- Tests: URL fetch happy path, oversize, wrong content-type, malformed URL, redirect handling, share-copy roundtrip

## Files to Create / Modify

### Backend
- `backend/app/services/image_url_fetcher.rb` — new
- `backend/Gemfile` — modify: `+gem "down", "~> 5.4"`
- `backend/app/controllers/api/v1/recipe_images_controller.rb` — modify: branch on `params[:image]` (multipart) vs `params[:url]` (JSON)
- `backend/app/controllers/api/v1/shared_recipes_controller.rb` — modify: deep-copy attachment in `copy`
- `backend/test/services/image_url_fetcher_test.rb` — new
- `backend/test/controllers/api/v1/recipe_images_controller_test.rb` — modify: URL paste cases
- `backend/test/controllers/api/v1/shared_recipes_controller_test.rb` — modify: image roundtrip case

### Frontend
- `frontend/src/components/recipes/RecipeImagePicker.tsx` — modify: add URL tab + submit
- `frontend/src/api/recipes.ts` — modify: `uploadRecipeImageFromUrl(recipeId, url)`

## Dependencies

**Internal:** Phase 3 (component + endpoint scaffold)

**External:** `down ~> 5.4` (HTTP fetching with size limits, redirect handling, content-type sniffing)

## Implementation Notes

### 4.1 `ImageUrlFetcher` service

```ruby
# backend/app/services/image_url_fetcher.rb

class ImageUrlFetcher
  ALLOWED_CONTENT_TYPES = %w[image/jpeg image/png image/webp image/heic image/heif].freeze
  MAX_SIZE = 10.megabytes
  MAX_REDIRECTS = 5
  TIMEOUT_SECONDS = 10

  Result = Struct.new(:tempfile, :filename, :content_type, :error, keyword_init: true)

  def self.fetch(url)
    return Result.new(error: "URL is required") if url.blank?

    begin
      uri = URI.parse(url)
    rescue URI::InvalidURIError
      return Result.new(error: "Invalid URL")
    end

    return Result.new(error: "URL must be http(s)") unless %w[http https].include?(uri.scheme)

    begin
      tempfile = Down.download(
        url,
        max_size: MAX_SIZE,
        max_redirects: MAX_REDIRECTS,
        open_timeout: TIMEOUT_SECONDS,
        read_timeout: TIMEOUT_SECONDS,
      )
    rescue Down::TooLarge
      return Result.new(error: "Image must be under 10 MB")
    rescue Down::TimeoutError
      return Result.new(error: "Image source timed out")
    rescue Down::Error => e
      return Result.new(error: "Couldn't fetch image: #{e.message}")
    end

    content_type = tempfile.content_type
    unless ALLOWED_CONTENT_TYPES.include?(content_type)
      tempfile.close!
      return Result.new(error: "Image must be JPEG, PNG, WebP, or HEIC")
    end

    Result.new(
      tempfile: tempfile,
      filename: filename_from(uri, content_type),
      content_type: content_type,
    )
  end

  def self.filename_from(uri, content_type)
    base = File.basename(uri.path).presence || "image"
    ext = Mime::Type.lookup(content_type).symbol.to_s
    base.include?(".") ? base : "#{base}.#{ext}"
  end
end
```

**Deviation watch:**
- `Down` (the gem) handles redirects and content-length-based size limits cleanly. Don't roll your own with `Net::HTTP` — redirect chains, content-type sniffing, and timeout handling are all easier to get wrong than right.
- Validate the URL scheme (`http`/`https` only) before fetching. This blocks `file://`, `ftp://`, and other potential SSRF vectors.
- Currently no IP/host allowlist or block — be aware that `ImageUrlFetcher.fetch("http://169.254.169.254/...")` (AWS metadata endpoint) would technically work. At Garnish's scale and threat model this is acceptable, but if you ever expose to untrusted users, add an SSRF guard (block private IP ranges).
- `tempfile.close!` purges the temp file on rejection; the `Down` tempfile lives in `/tmp` until cleanup.

### 4.2 Extend `RecipeImagesController#create`

```ruby
def create
  recipe = Current.household.recipes.find(params[:recipe_id])
  return unless authorize!(recipe, :update?)

  if params[:image].present?
    # Multipart path (Phase 3)
    recipe.image.attach(params[:image])
  elsif params[:url].present?
    # URL path (Phase 4)
    result = ImageUrlFetcher.fetch(params[:url])
    if result.error
      return render_error("validation_failed", result.error, :unprocessable_entity)
    end
    recipe.image.attach(
      io: result.tempfile,
      filename: result.filename,
      content_type: result.content_type,
    )
  else
    return render_error("validation_failed", "image or url is required", :unprocessable_entity)
  end

  if recipe.save
    render json: { data: serialize_recipe(recipe, full: true) }
  else
    render_validation_errors(recipe)
  end
rescue ActiveRecord::RecordNotFound
  render_error("not_found", "Recipe not found", :not_found)
end
```

The same endpoint accepts both paths — frontend chooses based on user's input.

### 4.3 `SharedRecipesController#copy` deep-copy

In `copy` (around line 38–76), add the attachment clone after `copy.save!`:

```ruby
def copy
  # ... existing code ...

  copy = Current.household.recipes.build(
    # ... existing attribute list including image_url: source.image_url ...
  )

  if copy.save
    # Deep-copy the ActiveStorage attachment if present.
    # Use io: rather than .attach(source.image.blob) — sharing a Blob across
    # attachments breaks on purge cascade (deleting one nukes the bytes for both).
    if source.image.attached?
      copy.image.attach(
        io: StringIO.new(source.image.download),
        filename: source.image.filename.to_s,
        content_type: source.image.content_type,
      )
    end

    render json: { data: serialize_recipe(copy, full: true) }, status: :created
  else
    render_validation_errors(copy)
  end
end
```

**Deviation watch:**
- `source.image.download` returns raw bytes. Wrap in `StringIO` so `.attach(io:)` accepts it. Alternative: stream via `source.image.open` (block-based, doesn't load all bytes into memory). For 10 MB-ish files, `download` is simple and fine.
- If the source has only `image_url` (string, no attachment), nothing to clone — the string field is already copied as part of `recipes.build`. ✓
- The clone should NOT be inside a transaction with the recipe save — if attachment fails, the recipe still exists (user can retry by editing). Putting it inside a transaction means a failed download undoes the recipe creation, which is worse UX.

### 4.4 Frontend — URL tab

In `RecipeImagePicker`, add a tab/toggle between "Upload" and "URL":

```tsx
const [mode, setMode] = useState<"file" | "url">("file");
const [urlInput, setUrlInput] = useState("");

async function handleUrlSubmit() {
  if (!recipeId || !urlInput.trim()) return;
  setIsUploading(true);
  try {
    const res = await uploadRecipeImageFromUrl(recipeId, urlInput.trim());
    onImageChange(res.data);
    setUrlInput("");
    toast.success("Image added");
  } catch (err) {
    toast.error(extractErrorMessage(err) ?? "Couldn't fetch image");
  } finally {
    setIsUploading(false);
  }
}
```

UI:

```tsx
{!currentImageUrl && (
  <>
    <div className="flex gap-2 text-xs">
      <button onClick={() => setMode("file")} className={mode === "file" ? "..." : "..."}>
        Upload
      </button>
      <button onClick={() => setMode("url")} className={mode === "url" ? "..." : "..."}>
        From URL
      </button>
    </div>
    {mode === "file" ? <FileUploadButton /> : (
      <div className="flex gap-2">
        <input
          type="url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="https://..."
          className="flex-1 ..."
        />
        <MutationButton pending={isUploading} onClick={handleUrlSubmit}>Add</MutationButton>
      </div>
    )}
  </>
)}
```

```ts
// frontend/src/api/recipes.ts

export function uploadRecipeImageFromUrl(recipeId: number, url: string) {
  return api<{ data: RecipeFull }>(`/recipes/${recipeId}/image`, {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}
```

### 4.5 Tests

**Service** (`image_url_fetcher_test.rb`):
- Happy path: stub `Down.download` to return a tempfile with `image/jpeg` content_type → returns Result with no error
- Oversize: stub `Down.download` to raise `Down::TooLarge` → returns "Image must be under 10 MB"
- Timeout: raises `Down::TimeoutError` → returns "Image source timed out"
- Wrong content type: stub returns `text/html` → returns "Image must be JPEG, ..."
- Malformed URL: pass `"not a url"` → returns "Invalid URL"
- Non-http scheme: pass `"file:///etc/passwd"` → returns "URL must be http(s)"

**Controller** (modify `recipe_images_controller_test.rb`):
- POST with `url:` → attaches image, returns 200 with `image_thumb_url` populated
- POST with neither `image` nor `url` → 422 "image or url is required"
- POST with both `image` and `url` → multipart wins (per branch order)

**Sharing** (modify `shared_recipes_controller_test.rb`):
- Source recipe has attached image → POST `/copy` → new recipe in destination household has its own attached image (different blob ID, same bytes)
- Source recipe has only `image_url` string → copy preserves string, no attachment
- Source recipe has both → copy preserves string AND deep-copies attachment

## Validation

- [ ] `image_url_fetcher_test.rb`: 6 cases passing
- [ ] `recipe_images_controller_test.rb`: URL cases added, all passing
- [ ] `shared_recipes_controller_test.rb`: image roundtrip case passing
- [ ] Manual: paste a public image URL (e.g., a Wikipedia commons JPEG) → fetched, attached, displayed
- [ ] Manual: paste a 404 URL → clear error toast, no orphan blob
- [ ] Manual: paste a non-image URL (e.g., a recipe webpage) → "Image must be JPEG..." error
- [ ] Manual: paste `file:///etc/passwd` → "URL must be http(s)" error (security smoke)
- [ ] Manual: share a recipe with an attached image to a second household → recipient's recipe shows the same image, and deleting the original doesn't break the copy
- [ ] Backend tests pass overall
- [ ] Frontend build clean

---

## Phase 4 Closes the Plan

Once Phase 4 ships, archive per the project's pattern: `git mv docs/plan/plan.md docs/plan/phases docs/plan/_archived/v5-recipe-images-r2/`. Update `.claude/PROJECT_PROGRESS.md` Plan Files section to `None` and capture deviations in the daily/weekly report.
