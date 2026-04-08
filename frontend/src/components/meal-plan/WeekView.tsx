import { DayColumn } from "./DayColumn";
import type { MealPlanEntry, MealSlot } from "@/types/mealPlan";
import { weekDays } from "@/lib/weekUtils";

interface WeekViewProps {
  weekStart: string;
  entries: MealPlanEntry[];
  onAddClick: (date: string, slot: MealSlot) => void;
  onEntryOptionsClick: (entry: MealPlanEntry) => void;
}

/**
 * 7-column grid view for the week. Responsive breakpoints:
 *   - lg: 7 columns (full desktop layout)
 *   - md: 4 columns (tablet — wraps to a second row)
 *   - sm: 2 columns
 *   - base: 1 column (mobile placeholder until sub-phase C ships proper
 *     single-day swipe navigation)
 */
export function WeekView({
  weekStart,
  entries,
  onAddClick,
  onEntryOptionsClick,
}: WeekViewProps) {
  const days = weekDays(weekStart);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
      {days.map((date) => (
        <DayColumn
          key={date}
          date={date}
          entries={entries}
          onAddClick={onAddClick}
          onEntryOptionsClick={onEntryOptionsClick}
        />
      ))}
    </div>
  );
}
