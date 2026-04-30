# Phase 3: Upload UI — File Source

> **Depends on:** Phase 2 (`has_one_attached :image` defined; serializer surfaces variants)
> **Enables:** Phase 4 (URL paste reuses the same controller scaffolding)
>
> See: [Full Plan](../plan.md)

## Goal

Add a file-upload pathway for recipe images: a `RecipeImagePicker` component (file source only — URL paste comes in Phase 4) wired into `RecipeForm`, plus a backend endpoint accepting multipart uploads with the 10 MB cap and content-type validation.

## Key Deliverables

- `RecipeImagePicker` component with file picker (camera + photo library on mobile via `accept="image/*" capture="environment"`)
- Preview before submit, replace existing image, remove image
- `POST /api/v1/recipes/:id/image` (multipart) — attaches to `recipe.image`
- `DELETE /api/v1/recipes/:id/image` — purges attachment
- `RecipeForm` integration: picker is shown above other fields (mobile-first: thumb-friendly tap targets)
- `useOptimisticMutation` for the upload (consistent with grocery list / rating mutations)
- Toast feedback on success/failure
- Backend + frontend tests

## Files to Create / Modify

### Backend
- `backend/app/controllers/api/v1/recipe_images_controller.rb` — new
- `backend/config/routes.rb` — modify: `+POST/DELETE /recipes/:id/image`
- `backend/test/controllers/api/v1/recipe_images_controller_test.rb` — new

### Frontend
- `frontend/src/components/recipes/RecipeImagePicker.tsx` — new
- `frontend/src/api/recipes.ts` — modify: `+uploadRecipeImage`, `+removeRecipeImage`
- `frontend/src/components/recipes/RecipeForm.tsx` — modify: render picker, handle image state
- `frontend/src/pages/RecipeNew.tsx` and `RecipeEdit.tsx` — modify if needed: ensure `onSubmit` returns the saved recipe so the picker can subsequently attach to its ID

## Dependencies

**Internal:** Phase 2 (model attachment defined, serializer outputs URLs)

**External:** none new.

## Implementation Notes

### 3.1 Backend controller

```ruby
# backend/app/controllers/api/v1/recipe_images_controller.rb

module Api
  module V1
    class RecipeImagesController < ApplicationController
      before_action :authenticate!
      include HouseholdScoped

      # POST /api/v1/recipes/:recipe_id/image
      def create
        recipe = Current.household.recipes.find(params[:recipe_id])
        return unless authorize!(recipe, :update?)

        if params[:image].blank?
          return render_error("validation_failed", "image is required", :unprocessable_entity)
        end

        recipe.image.attach(params[:image])

        if recipe.save
          render json: { data: serialize_recipe(recipe, full: true) }, status: :ok
        else
          # Validations on the model (size/type) purge the attachment in the
          # validator and add an error. We just surface it.
          render_validation_errors(recipe)
        end
      rescue ActiveRecord::RecordNotFound
        render_error("not_found", "Recipe not found", :not_found)
      end

      # DELETE /api/v1/recipes/:recipe_id/image
      def destroy
        recipe = Current.household.recipes.find(params[:recipe_id])
        return unless authorize!(recipe, :update?)

        recipe.image.purge if recipe.image.attached?
        render json: { data: serialize_recipe(recipe, full: true) }, status: :ok
      rescue ActiveRecord::RecordNotFound
        render_error("not_found", "Recipe not found", :not_found)
      end

      private

      def serialize_recipe(recipe, full:)
        # Reuse the helper from RecipesController. Extract to a concern or
        # service if it grows; for now, include a module or duplicate sparingly.
        Api::V1::RecipesController.new.send(:serialize_recipe, recipe, full: full).tap do |h|
          # Inject host/protocol context if the helper needs it; verify with
          # tests that variant URLs come through correctly here.
        end
      end
    end
  end
end
```

**Deviation watch:**
- Calling `serialize_recipe` from one controller in another via `.send` is a smell. Prefer extracting `serialize_recipe` into `app/serializers/recipe_serializer.rb` or a `RecipeSerialization` concern shared between `RecipesController`, `SharedRecipesController`, and `RecipeImagesController`. Do this refactor in 3.1 rather than duplicating.
- `recipe.image.attach(params[:image])` — the model validators (size/type from Phase 2) run on `save`, not on attach. So the order is: attach → save → if save fails, model validators have already purged + added error. `render_validation_errors` will surface "image must be under 10 MB" etc.
- If the attachment exists already, `attach` replaces it — the previous blob gets purged automatically (ActiveStorage default for `has_one_attached`). No special handling needed for "replace existing image."

### 3.2 Routes

```ruby
# backend/config/routes.rb

namespace :api do
  namespace :v1 do
    resources :recipes do
      # ... existing nested routes ...
      resource :image, only: %i[create destroy], controller: :recipe_images
    end
  end
end
```

This produces:
- `POST   /api/v1/recipes/:recipe_id/image     → recipe_images#create`
- `DELETE /api/v1/recipes/:recipe_id/image     → recipe_images#destroy`

(`resource` singular, not `resources` — only one image per recipe.)

### 3.3 Frontend API client

```ts
// frontend/src/api/recipes.ts

export function uploadRecipeImage(recipeId: number, file: File) {
  const formData = new FormData();
  formData.append("image", file);
  return api<{ data: RecipeFull }>(`/recipes/${recipeId}/image`, {
    method: "POST",
    body: formData,
    // IMPORTANT: do NOT set Content-Type header. Browser sets multipart boundary.
  });
}

export function removeRecipeImage(recipeId: number) {
  return api<{ data: RecipeFull }>(`/recipes/${recipeId}/image`, {
    method: "DELETE",
  });
}
```

**Deviation watch:**
- Don't set `Content-Type: multipart/form-data` manually — the browser must set it including the random boundary string. The existing `api()` client likely sets `Content-Type: application/json` by default; verify it skips that when `body instanceof FormData`. If it doesn't, add a check.
- The 10 MB cap should also be checked client-side before upload (better UX than waiting for the server to reject):

```ts
if (file.size > 10 * 1024 * 1024) {
  toast.error("Image must be under 10 MB");
  return;
}
```

### 3.4 RecipeImagePicker component

```tsx
// frontend/src/components/recipes/RecipeImagePicker.tsx

interface Props {
  recipeId: number | null;  // null when creating; picker disabled until recipe exists
  currentImageUrl: string | null;  // image_thumb_url ?? image_url ?? null
  onImageChange: (recipe: RecipeFull) => void;  // upstream updates form state
}

export function RecipeImagePicker({ recipeId, currentImageUrl, onImageChange }: Props) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !recipeId) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10 MB");
      return;
    }
    setIsUploading(true);
    try {
      const res = await uploadRecipeImage(recipeId, file);
      onImageChange(res.data);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error("Couldn't upload image");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemove() {
    if (!recipeId) return;
    setIsUploading(true);
    try {
      const res = await removeRecipeImage(recipeId);
      onImageChange(res.data);
    } catch {
      toast.error("Couldn't remove image");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-gray-600">Image</label>
      {currentImageUrl ? (
        <div className="relative">
          <img
            src={currentImageUrl}
            alt="Recipe"
            className="aspect-[4/3] w-full rounded-lg object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            disabled={isUploading}
            className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white"
            aria-label="Remove image"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!recipeId || isUploading}
          className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-500"
        >
          {isUploading ? "Uploading..." : "+ Add image"}
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
```

**Deviation watch:**
- `capture="environment"` on mobile triggers the back camera. To allow either camera or photo library selection, leave `capture` off — iOS shows the native picker with both options. Test on real devices: on iOS, `capture="environment"` may force camera-only without library. If you want both, drop `capture`.
- The picker is **disabled when `recipeId` is null** (i.e., during recipe creation, before the recipe exists). The flow is: user fills in title/etc. → clicks Save → recipe is created → form re-renders with `recipeId` set → picker is now active. Document this in the form: "Save the recipe first to add an image" or auto-save on blur to enable the picker. (For simplicity v1: just disable + tooltip.)
- File input ref clears its value after upload so the same file can be selected again (browsers cache file input value; reselecting the same file is a no-op without this).

### 3.5 RecipeForm integration

In `frontend/src/components/recipes/RecipeForm.tsx`, render the picker just below the title field:

```tsx
<div className="mb-4">
  <RecipeImagePicker
    recipeId={existingRecipe?.id ?? null}
    currentImageUrl={imageUrl}
    onImageChange={(updated) => {
      setImageUrl(updated.image_thumb_url ?? updated.image_url ?? null);
      onRecipeUpdate?.(updated);
    }}
  />
</div>
```

State: add an `imageUrl` state initialized from `existingRecipe?.image_thumb_url ?? existingRecipe?.image_url`. The picker's `onImageChange` updates it after upload/remove.

`onRecipeUpdate?.(updated)` is a new optional prop to bubble the freshly-server-returned recipe to the parent (e.g., `RecipeEdit`) so the cache stays in sync.

### 3.6 Tests

**Backend** (`recipe_images_controller_test.rb`):
- `POST` with valid image attaches and returns 200 + serialized recipe with `image_thumb_url` populated
- `POST` with > 10 MB returns 422 with "image must be under 10 MB"
- `POST` with `text/plain` content returns 422 with "image must be JPEG, PNG, WebP, or HEIC"
- `POST` replaces existing image (the old blob is purged)
- `DELETE` clears the attachment; serializer returns null variants
- Permissions: read-only member gets 403; owner/admin/contribute gets 200

**Frontend:** primarily smoke testing — no Vitest cases for this UI (unless we want to add React Testing Library for the picker). Manual test on iOS + Android to verify camera capture works.

## Validation

- [ ] Backend tests pass (5–7 cases for `recipe_images_controller_test.rb`)
- [ ] Manual: upload a JPEG via desktop file picker → renders on RecipeCard + RecipeDetail
- [ ] Manual: upload via iPhone camera → succeeds; image displayed correctly oriented (auto-orient working)
- [ ] Manual: upload an oversize file → toast says "must be under 10 MB"; no orphan blob in R2
- [ ] Manual: upload non-image (`.txt`) → toast says "must be JPEG, PNG, WebP, or HEIC"
- [ ] Manual: replace an existing image → old image gone (verify in R2 dashboard or `Rails.logger`)
- [ ] Manual: remove image → picker shows the "+ Add image" placeholder again
- [ ] Manual: try uploading on a brand-new (unsaved) recipe → picker is disabled with helpful copy
- [ ] Frontend build clean
