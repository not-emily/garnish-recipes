import { useMemo, useState } from "react";
import { ChevronLeft, Loader2, Utensils, X } from "lucide-react";
import type { MealSlot } from "@/types/mealPlan";
import { MEAL_SLOTS } from "@/types/mealPlan";
import type { Household } from "@/types";
import { calculateLeftovers } from "@/hooks/useLeftoverCalculation";
import { addDays, formatWeekdayLong, formatMonthDay } from "@/lib/weekUtils";

interface LeftoverPromptProps {
  // Recipe the user just picked — carries servings for the calculation.
  recipe: { id: string; title: string; servings: number | null };
  // The slot the user initially targeted. Leftovers default to dates after this.
  target: { date: string; slot: MealSlot };
  household: Household;
  // Called when user confirms. `leftovers` is the set of explicit slot
  // assignments (may be empty). `trackRemaining` tells the backend whether
  // to create tray items for anything the user didn't schedule: true when
  // the user engaged with the prompt (toggle on), false when they opted
  // out entirely (toggle off).
  onConfirm: (
    leftovers: { date: string; meal_slot: MealSlot }[],
    trackRemaining: boolean
  ) => void;
  onBack: () => void;
  isSubmitting: boolean;
}

export function LeftoverPrompt({
  recipe,
  target,
  household,
  onConfirm,
  onBack,
  isSubmitting,
}: LeftoverPromptProps) {
  const calc = useMemo(
    () =>
      calculateLeftovers({
        servings: recipe.servings,
        default_diners: household.default_diners,
      }),
    [recipe.servings, household.default_diners]
  );

  // Default toggle from household setting. "on" pre-fills on, "ask" pre-fills
  // off (opt-in per recipe), "off" shouldn't normally reach us since we'd
  // skip the prompt, but be safe and default to off if it does.
  const [enabled, setEnabled] = useState(household.leftover_suggestion === "on");

  // Default slot for each leftover row. "ask" means no default — user must
  // pick explicitly. Pre-fill sequential days after the target date.
  const defaultSlot: MealSlot | null =
    household.leftover_default_slot === "ask"
      ? null
      : household.leftover_default_slot;

  const [rows, setRows] = useState<{ date: string; meal_slot: MealSlot | null }[]>(
    () =>
      Array.from({ length: calc.suggested_leftover_count }, (_, i) => ({
        date: addDays(target.date, i + 1),
        meal_slot: defaultSlot,
      }))
  );

  function updateRow(idx: number, patch: Partial<{ date: string; meal_slot: MealSlot | null }>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  // Users can leave rows blank — anything unassigned will go to the tray
  // via track_remaining on the backend. Always submittable.
  const canSubmit = true;

  function handleSubmit() {
    if (!enabled) {
      // "Don't track" — just the original, no leftovers anywhere.
      onConfirm([], false);
      return;
    }
    const complete = rows
      .filter((r) => r.meal_slot !== null)
      .map((r) => ({ date: r.date, meal_slot: r.meal_slot as MealSlot }));
    // Track remaining: anything the user didn't explicitly slot lands in
    // the tray. Same for the partial remainder.
    onConfirm(complete, true);
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        disabled={isSubmitting}
        className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 disabled:opacity-60"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Back
      </button>

      <div className="flex items-start gap-3 rounded-lg bg-garnish-50 p-4">
        <Utensils className="mt-0.5 h-5 w-5 shrink-0 text-garnish-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900">{recipe.title}</p>
          <p className="mt-0.5 text-xs text-gray-600">
            Makes {calc.meals_count} meals for {calc.diners}{" "}
            {calc.diners === 1 ? "diner" : "diners"}
            {calc.has_partial_leftovers &&
              ` · ${calc.remaining_servings} extra serving${calc.remaining_servings === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      <label className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2.5">
        <span className="text-sm font-medium text-gray-700">Plan leftovers?</span>
        <span className="relative inline-flex h-6 w-11">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="peer sr-only"
          />
          <span className="absolute inset-0 rounded-full bg-gray-200 transition-colors peer-checked:bg-garnish-600" />
          <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
        </span>
      </label>

      {enabled && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {calc.suggested_leftover_count === 1 ? "Leftover" : "Leftovers"}
          </p>
          <p className="text-xs text-gray-500">
            Pick a slot for the ones you want scheduled now. Leave the rest blank — they'll land in the tray to decide later.
          </p>
          {rows.map((row, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                row.meal_slot
                  ? "border-gray-200 bg-white"
                  : "border-dashed border-gray-200 bg-gray-50 opacity-60"
              }`}
            >
              <div className="flex-1 text-sm text-gray-700">
                {formatWeekdayLong(row.date)}, {formatMonthDay(row.date)}
              </div>
              {row.meal_slot ? (
                <>
                  <select
                    value={row.meal_slot}
                    onChange={(e) =>
                      updateRow(idx, {
                        meal_slot: e.target.value as MealSlot,
                      })
                    }
                    className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
                  >
                    {MEAL_SLOTS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => updateRow(idx, { meal_slot: null })}
                    className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                    aria-label="Skip this leftover"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => updateRow(idx, { meal_slot: defaultSlot ?? "lunch" })}
                  className="text-xs font-medium text-garnish-600 hover:text-garnish-700"
                >
                  Schedule
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !canSubmit}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-garnish-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-garnish-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {(() => {
            if (!enabled) return "Add";
            const scheduled = rows.filter((r) => r.meal_slot !== null).length;
            if (scheduled === 0) return "Add (leftovers to tray)";
            return `Add + ${scheduled} leftover${scheduled === 1 ? "" : "s"}`;
          })()}
        </button>
      </div>
    </div>
  );
}
