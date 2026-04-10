import { MealSlot } from "./MealSlot";
import type { MealPlanEntry, MealSlot as MealSlotType } from "@/types/mealPlan";
import { MEAL_SLOTS } from "@/types/mealPlan";
import {
  formatMonthDay,
  formatWeekdayShort,
  todayIso,
} from "@/lib/weekUtils";

interface DayColumnProps {
  date: string;
  entries: MealPlanEntry[];
  onAddClick: (date: string, slot: MealSlotType) => void;
  onEntryOptionsClick: (entry: MealPlanEntry) => void;
  sortable?: boolean;
  moveMode?: boolean;
  onMoveHere?: (date: string, slot: MealSlotType) => void;
  onEntryLongPress?: (entry: MealPlanEntry) => void;
  moveTargetId?: number;
  // "date:slot" string identifying the slot currently being dragged over,
  // used to highlight the full slot area during cross-slot drags.
  overSlotId?: string | null;
}

/**
 * A single day's column within the weekly grid. Shows a header with the
 * weekday + date and three stacked meal slots. Today's column gets a
 * subtle accent so it's easy to find at a glance.
 */
export function DayColumn({
  date,
  entries,
  onAddClick,
  onEntryOptionsClick,
  sortable = false,
  moveMode = false,
  onMoveHere,
  onEntryLongPress,
  moveTargetId,
  overSlotId,
}: DayColumnProps) {
  const isToday = date === todayIso();

  const entriesBySlot: Record<MealSlotType, MealPlanEntry[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
  };
  entries.forEach((e) => {
    if (e.date === date) {
      entriesBySlot[e.meal_slot].push(e);
    }
  });

  return (
    <div
      className={`flex flex-col rounded-xl border p-3 ${
        isToday
          ? "border-garnish-300 bg-garnish-50/40 shadow-sm"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="mb-3 text-center">
        <p
          className={`text-[10px] font-semibold uppercase tracking-wider ${
            isToday ? "text-garnish-600" : "text-gray-400"
          }`}
        >
          {formatWeekdayShort(date)}
        </p>
        <p
          className={`mt-0.5 text-sm font-semibold ${
            isToday ? "text-garnish-900" : "text-gray-900"
          }`}
        >
          {formatMonthDay(date)}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        {MEAL_SLOTS.map((slot) => (
          <MealSlot
            key={slot.value}
            date={date}
            slot={slot.value}
            label={slot.label}
            entries={entriesBySlot[slot.value]}
            onAddClick={onAddClick}
            onEntryOptionsClick={onEntryOptionsClick}
            sortable={sortable}
            moveMode={moveMode}
            onMoveHere={onMoveHere}
            onEntryLongPress={onEntryLongPress}
            moveTargetId={moveTargetId}
            overSlotId={overSlotId}
          />
        ))}
      </div>
    </div>
  );
}
