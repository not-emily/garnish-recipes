import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useMealPlan } from "@/hooks/useMealPlan";
import { WeekView } from "@/components/meal-plan/WeekView";
import { MobileDayView } from "@/components/meal-plan/MobileDayView";
import { EntryPicker } from "@/components/meal-plan/EntryPicker";
import { EntryOptions } from "@/components/meal-plan/EntryOptions";
import { LeftoverTray } from "@/components/meal-plan/LeftoverTray";
import { CascadeDeleteDialog } from "@/components/meal-plan/CascadeDeleteDialog";
import type { ApiError } from "@/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
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

  const {
    mealPlan,
    isLoading,
    isError,
    createEntry,
    updateEntry,
    deleteEntry,
    reorderEntries,
  } = useMealPlan(weekStart);

  // The slot the user is currently adding to. Null when the picker is closed.
  const [pickerTarget, setPickerTarget] = useState<{
    date: string;
    slot: MealSlot;
  } | null>(null);

  // The entry whose options modal is currently open.
  const [optionsEntry, setOptionsEntry] = useState<MealPlanEntry | null>(null);

  // Cascade delete state — set when the server returns 409 because the
  // entry the user asked to delete has linked leftovers or tray items.
  const [cascadeTarget, setCascadeTarget] = useState<{
    entry: MealPlanEntry;
    linkedLeftoverCount: number;
    trayItemCount: number;
  } | null>(null);

  const isThisWeek = useMemo(() => weekStart === weekStartOf(todayIso()), [weekStart]);

  // Below the `sm` breakpoint we render the swipeable single-day view
  // instead of the multi-column week grid. The grid's existing 1-col
  // fallback at this width was a placeholder until this view shipped.
  const isMobile = useMediaQuery("(max-width: 639px)");

  function handleAddClick(date: string, slot: MealSlot) {
    setPickerTarget({ date, slot });
  }

  function handleSubmitRecipe(
    recipeId: string,
    opts?: {
      leftovers?: { date: string; meal_slot: MealSlot }[];
      trackRemaining?: boolean;
    }
  ) {
    if (!pickerTarget) return;
    createEntry.mutate(
      {
        recipe_id: recipeId,
        date: pickerTarget.date,
        meal_slot: pickerTarget.slot,
        leftovers: opts?.leftovers,
        track_remaining: opts?.trackRemaining,
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
    const entry = optionsEntry;
    deleteEntry.mutate(
      { id: entry.id },
      {
        onSuccess: () => setOptionsEntry(null),
        onError: (err) => {
          // 409 with dependents → open the cascade dialog. Everything else
          // bubbles up as a generic mutation error (no toast yet; future
          // work).
          const apiError = err as unknown as ApiError;
          if (apiError?.error?.code === "has_dependents") {
            const details = apiError.error.details as unknown as {
              linked_leftover_count: number;
              tray_item_count: number;
            };
            setCascadeTarget({
              entry,
              linkedLeftoverCount: details.linked_leftover_count,
              trayItemCount: details.tray_item_count,
            });
            setOptionsEntry(null);
          }
        },
      }
    );
  }

  function handleCascadeConfirm() {
    if (!cascadeTarget) return;
    deleteEntry.mutate(
      { id: cascadeTarget.entry.id, cascade: true },
      { onSuccess: () => setCascadeTarget(null) }
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 pb-8">
      <PageHeader title="Meal Plan" subtitle={formatWeekRange(weekStart)}>
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
      </PageHeader>

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
        <>
        <LeftoverTray weekStart={weekStart} />
        {isMobile ? (
          <MobileDayView
            weekStart={weekStart}
            entries={mealPlan.entries}
            onAddClick={handleAddClick}
            onEntryOptionsClick={(entry) => setOptionsEntry(entry)}
            onMoveEntry={(id, date, slot) =>
              updateEntry.mutate({ id, input: { date, meal_slot: slot } })
            }
            onReorderSlot={(ids) => reorderEntries.mutate(ids)}
            onWeekChange={(delta) => setWeekStart(addWeeks(weekStart, delta))}
          />
        ) : (
          <WeekView
            weekStart={weekStart}
            entries={mealPlan.entries}
            onAddClick={handleAddClick}
            onEntryOptionsClick={(entry) => setOptionsEntry(entry)}
            onReorderSlot={(ids) => reorderEntries.mutate(ids)}
            onMoveEntry={(id, date, slot) =>
              updateEntry.mutate({ id, input: { date, meal_slot: slot } })
            }
          />
        )}
        </>
      ) : null}

      <EntryPicker
        open={pickerTarget !== null}
        target={pickerTarget}
        onClose={() => setPickerTarget(null)}
        onSubmitRecipe={handleSubmitRecipe}
        onCreateNote={handleCreateNote}
        isSubmitting={createEntry.isPending}
      />

      <EntryOptions
        entry={optionsEntry}
        onClose={() => setOptionsEntry(null)}
        onSave={handleSaveOptions}
        onDelete={handleDeleteEntry}
        isSaving={updateEntry.isPending || deleteEntry.isPending}
      />

      <CascadeDeleteDialog
        open={cascadeTarget !== null}
        entryTitle={cascadeTarget?.entry.title ?? ""}
        linkedLeftoverCount={cascadeTarget?.linkedLeftoverCount ?? 0}
        trayItemCount={cascadeTarget?.trayItemCount ?? 0}
        onCancel={() => setCascadeTarget(null)}
        onDeleteAll={handleCascadeConfirm}
        isSubmitting={deleteEntry.isPending}
      />
    </div>
  );
}

export default MealPlan;
