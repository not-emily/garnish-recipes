import { Plus } from "lucide-react";
import { MealEntry } from "./MealEntry";
import type { MealPlanEntry, MealSlot as MealSlotType } from "@/types/mealPlan";

interface MealSlotProps {
  date: string;
  slot: MealSlotType;
  label: string;
  entries: MealPlanEntry[];
  onAddClick: (date: string, slot: MealSlotType) => void;
  onEntryOptionsClick: (entry: MealPlanEntry) => void;
}

/**
 * A single meal slot (breakfast/lunch/dinner) for one day. Stacks its
 * entries vertically and exposes an add button. Visually minimal so the
 * week view stays scannable at a glance.
 */
export function MealSlot({
  date,
  slot,
  label,
  entries,
  onAddClick,
  onEntryOptionsClick,
}: MealSlotProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          {label}
        </span>
        <button
          type="button"
          onClick={() => onAddClick(date, slot)}
          className="rounded p-0.5 text-gray-300 transition-colors hover:bg-garnish-50 hover:text-garnish-600"
          aria-label={`Add to ${label.toLowerCase()}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-1">
        {entries.length === 0 ? (
          <button
            type="button"
            onClick={() => onAddClick(date, slot)}
            className="w-full rounded-lg border border-dashed border-gray-200 px-2 py-3 text-[10px] text-gray-400 transition-colors hover:border-garnish-300 hover:bg-garnish-50 hover:text-garnish-600"
          >
            Add
          </button>
        ) : (
          entries.map((entry) => (
            <MealEntry
              key={entry.id}
              entry={entry}
              onOptionsClick={onEntryOptionsClick}
            />
          ))
        )}
      </div>
    </div>
  );
}
