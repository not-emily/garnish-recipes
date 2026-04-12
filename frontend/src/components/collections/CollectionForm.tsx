import { useState, useEffect, type FormEvent } from "react";
import { X } from "lucide-react";
import type { ApiError } from "@/types";
import type { CollectionInput } from "@/types/collection";

interface CollectionFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CollectionInput) => Promise<void>;
  initial?: { name: string; description?: string | null; visibility?: "private" | "household" };
  title: string;
}

export function CollectionForm({ open, onClose, onSubmit, initial, title }: CollectionFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [visibility, setVisibility] = useState<"private" | "household">(
    initial?.visibility ?? "private"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setDescription(initial?.description ?? "");
      setVisibility(initial?.visibility ?? "private");
      setError("");
    }
  }, [open, initial?.name, initial?.description, initial?.visibility]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await onSubmit({
        name: trimmed,
        description: description.trim() || null,
        visibility,
      });
      onClose();
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr?.error?.message || "Couldn't save collection");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
      />

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="col-name" className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="col-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weeknight Favorites"
              autoFocus
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
            />
          </div>

          <div>
            <label htmlFor="col-desc" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="col-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-gray-700">Visibility</span>
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setVisibility("private")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  visibility === "private"
                    ? "border-garnish-500 bg-garnish-50 text-garnish-700"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Private
              </button>
              <button
                type="button"
                onClick={() => setVisibility("household")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  visibility === "household"
                    ? "border-garnish-500 bg-garnish-50 text-garnish-700"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Household
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-garnish-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-garnish-700 disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
