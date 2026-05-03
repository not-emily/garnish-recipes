import { useEffect, useMemo, useRef, type ChangeEvent } from "react";
import { ImagePlus, X, Undo2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import type { ImageStaging } from "@/api/recipes";

const MAX_BYTES = 10 * 1024 * 1024;

interface Props {
  // What's currently persisted on the server (or null if none).
  committedImageUrl: string | null;
  // What's staged for the next save. Owned by the parent.
  staging: ImageStaging;
  onChange: (staging: ImageStaging) => void;
  disabled?: boolean;
}

export function RecipeImagePicker({ committedImageUrl, staging, onChange, disabled }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Create a blob URL for preview when a replace file is staged. Revoke when
  // the staged file changes or the component unmounts.
  const previewUrl = useMemo(
    () => (staging.kind === "replace" ? URL.createObjectURL(staging.file) : null),
    [staging]
  );
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const displayUrl =
    staging.kind === "replace" ? previewUrl :
    staging.kind === "remove"  ? null :
    committedImageUrl;

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast("Image must be under 10 MB", "error");
      return;
    }
    onChange({ kind: "replace", file });
  }

  function handleRemove() {
    if (staging.kind === "replace") {
      // User picked a file, then clicked X — just discard the staged file.
      // If there was no committed image to begin with, this leaves us at none.
      // If there was, revert to the committed state.
      onChange({ kind: "none" });
    } else {
      // No staged file — mark for removal on next save.
      onChange({ kind: "remove" });
    }
  }

  function handleUndo() {
    onChange({ kind: "none" });
  }

  const hasAnyImage = !!displayUrl;
  const isStaged = staging.kind !== "none";

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">Photo</label>
      <p className="mt-1 text-xs text-gray-500">JPEG, PNG, WebP, or HEIC. Up to 10 MB.</p>

      <div className="mt-2">
        {hasAnyImage ? (
          <div className="relative">
            <img
              src={displayUrl ?? undefined}
              alt="Recipe"
              className="aspect-[4/3] w-full rounded-lg object-cover"
            />
            <div className="absolute right-2 top-2 flex gap-2">
              {isStaged && (
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={disabled}
                  className="flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-700 shadow-sm backdrop-blur-sm hover:bg-white disabled:opacity-50"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Undo
                </button>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-700 shadow-sm backdrop-blur-sm hover:bg-white disabled:opacity-50"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled}
                aria-label="Remove image"
                className="rounded-full bg-white/90 p-1.5 text-gray-700 shadow-sm backdrop-blur-sm hover:bg-white disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500 transition-colors hover:border-garnish-400 hover:text-garnish-600 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-gray-300 disabled:hover:text-gray-500"
            >
              <span className="flex flex-col items-center gap-1">
                <ImagePlus className="h-8 w-8" />
                Add a photo
              </span>
            </button>
            {staging.kind === "remove" && (
              <button
                type="button"
                onClick={handleUndo}
                disabled={disabled}
                className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-700 shadow-sm backdrop-blur-sm hover:bg-white disabled:opacity-50"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Undo
              </button>
            )}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
