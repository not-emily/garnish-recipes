import { useState, useEffect } from "react";
import { X, Trash2, Loader2 } from "lucide-react";
import type { MealPlanEntry } from "@/types/mealPlan";

interface EntryOptionsProps {
  entry: MealPlanEntry | null;
  onClose: () => void;
  onSave: (updates: {
    servings_override: number | null;
    diners_override: number | null;
    include_in_grocery: boolean;
  }) => void;
  onDelete: () => void;
  isSaving: boolean;
}

/**
 * Per-entry settings modal. Surfaced from the meatball menu on each
 * MealEntry. Recipe-backed entries expose servings/diners overrides and
 * the grocery toggle; notes only get delete (since the other fields
 * don't apply).
 */
export function EntryOptions({
  entry,
  onClose,
  onSave,
  onDelete,
  isSaving,
}: EntryOptionsProps) {
  const [servings, setServings] = useState<string>("");
  const [diners, setDiners] = useState<string>("");
  const [includeInGrocery, setIncludeInGrocery] = useState(true);

  useEffect(() => {
    if (entry) {
      setServings(entry.servings_override?.toString() ?? "");
      setDiners(entry.diners_override?.toString() ?? "");
      setIncludeInGrocery(entry.include_in_grocery);
    }
  }, [entry]);

  useEffect(() => {
    if (!entry) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entry, onClose]);

  if (!entry) return null;

  // Events and notes skip the servings / grocery fields — there's nothing
  // to override (events aren't cooked, notes have no recipe) and they
  // never contribute to the grocery list. Only Remove applies.
  const simple = !entry.grocery_relevant;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      servings_override: servings.trim() ? parseInt(servings, 10) : null,
      diners_override: diners.trim() ? parseInt(diners, 10) : null,
      include_in_grocery: includeInGrocery,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-gray-900">
              {entry.title}
            </h2>
            <p className="mt-0.5 text-xs capitalize text-gray-500">
              {entry.meal_slot} · {entry.kind.replace("_", " ")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!simple && (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-700">
                  Servings override
                </label>
                <input
                  type="number"
                  min={1}
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  placeholder={entry.recipe?.servings?.toString() ?? "—"}
                  className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-700">
                  Diners override
                </label>
                <input
                  type="number"
                  min={1}
                  value={diners}
                  onChange={(e) => setDiners(e.target.value)}
                  placeholder="default"
                  className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={includeInGrocery}
                onChange={(e) => setIncludeInGrocery(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-garnish-600 focus:ring-garnish-500"
              />
              Include in grocery list
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onDelete}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-garnish-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-garnish-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </button>
            </div>
          </form>
        )}

        {simple && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              {entry.kind === "note"
                ? "Notes don't have servings or grocery settings. You can remove this note below."
                : "Events aren't cooked and don't affect the grocery list. You can remove this event below."}
            </p>
            <button
              type="button"
              onClick={onDelete}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              Remove {entry.kind === "note" ? "note" : "event"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
