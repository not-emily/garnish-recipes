import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { Link2, X, Loader2 } from "lucide-react";
import { createUrlImport } from "@/api/imports";
import type { ApiError } from "@/types";

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
}

export function ImportModal({ open, onClose }: ImportModalProps) {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the URL field when the modal opens, and reset state when it closes.
  useEffect(() => {
    if (open) {
      setUrl("");
      // Defer focus until after the modal renders
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const mutation = useMutation({
    mutationFn: (u: string) => createUrlImport(u),
    onSuccess: (res) => {
      onClose();
      // Navigate to the draft recipe — RecipeDetail will detect the
      // importing state and render the polling progress UI.
      navigate(`/recipes/${res.data.id}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    mutation.mutate(trimmed);
  }

  if (!open) return null;

  const errorMessage = mutation.error
    ? (mutation.error as ApiError).error?.message ?? "Couldn't start the import"
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-black/40 transition-opacity"
      />

      {/* Sheet/dialog */}
      <div className="relative w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Import a recipe</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="import-url"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Recipe URL
            </label>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                id="import-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/recipes/..."
                disabled={mutation.isPending}
                className="block w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500 disabled:opacity-60"
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              We'll fetch the page and pull out the recipe automatically. Most
              recipe blogs use structured data that we can parse without AI.
            </p>
          </div>

          {errorMessage && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {errorMessage}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !url.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-garnish-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-garnish-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Import
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
