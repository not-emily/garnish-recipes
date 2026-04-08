import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useMealPlan } from "@/hooks/useMealPlan";
import { WeekView } from "@/components/meal-plan/WeekView";
import { EntryPicker } from "@/components/meal-plan/EntryPicker";
import { EntryOptions } from "@/components/meal-plan/EntryOptions";
import type { MealPlanEntry, MealSlot } from "@/types/mealPlan";
import {
  addWeeks,
  formatWeekRange,
  todayIso,
  weekStartOf,
} from "@/lib/weekUtils";

export function MealPlan() {
  // Week is a piece of local state — the URL doesn't reflect it for now.
  // We could promote it to a search param later for deep-linking; not
  // worth the indirection yet.
  const [weekStart, setWeekStart] = useState(() => weekStartOf(todayIso()));

  const { mealPlan, isLoading, isError, createEntry, updateEntry, deleteEntry } =
    useMealPlan(weekStart);

  // The slot the user is currently adding to. Null when the picker is closed.
  const [pickerTarget, setPickerTarget] = useState<{
    date: string;
    slot: MealSlot;
  } | null>(null);

  // The entry whose options modal is currently open.
  const [optionsEntry, setOptionsEntry] = useState<MealPlanEntry | null>(null);

  const isThisWeek = useMemo(() => weekStart === weekStartOf(todayIso()), [weekStart]);

  function handleAddClick(date: string, slot: MealSlot) {
    setPickerTarget({ date, slot });
  }

  function handleSelectRecipe(recipeId: string) {
    if (!pickerTarget) return;
    createEntry.mutate(
      {
        recipe_id: recipeId,
        date: pickerTarget.date,
        meal_slot: pickerTarget.slot,
      },
      { onSuccess: () => setPickerTarget(null) }
    );
  }

  function handleCreateNote(title: string) {
    if (!pickerTarget) return;
    createEntry.mutate(
      {
        date: pickerTarget.date,
        meal_slot: pickerTarget.slot,
        title,
      },
      { onSuccess: () => setPickerTarget(null) }
    );
  }

  function handleSaveOptions(updates: {
    servings_override: number | null;
    diners_override: number | null;
    include_in_grocery: boolean;
  }) {
    if (!optionsEntry) return;
    updateEntry.mutate(
      { id: optionsEntry.id, input: updates },
      { onSuccess: () => setOptionsEntry(null) }
    );
  }

  function handleDeleteEntry() {
    if (!optionsEntry) return;
    deleteEntry.mutate(optionsEntry.id, {
      onSuccess: () => setOptionsEntry(null),
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 pb-8">
      {/* Header row — title + week nav */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meal Plan</h1>
          <p className="mt-0.5 text-sm text-gray-500">{formatWeekRange(weekStart)}</p>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setWeekStart(addWeeks(weekStart, -1))}
            className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(weekStartOf(todayIso()))}
            disabled={isThisWeek}
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Today
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(addWeeks(weekStart, 1))}
            className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-60 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          Couldn't load the meal plan. Try again.
        </div>
      ) : mealPlan ? (
        <WeekView
          weekStart={weekStart}
          entries={mealPlan.entries}
          onAddClick={handleAddClick}
          onEntryOptionsClick={(entry) => setOptionsEntry(entry)}
        />
      ) : null}

      <EntryPicker
        open={pickerTarget !== null}
        target={pickerTarget}
        onClose={() => setPickerTarget(null)}
        onSelectRecipe={handleSelectRecipe}
        onCreateNote={handleCreateNote}
      />

      <EntryOptions
        entry={optionsEntry}
        onClose={() => setOptionsEntry(null)}
        onSave={handleSaveOptions}
        onDelete={handleDeleteEntry}
        isSaving={updateEntry.isPending || deleteEntry.isPending}
      />
    </div>
  );
}
