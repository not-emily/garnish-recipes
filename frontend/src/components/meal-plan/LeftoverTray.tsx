import { useState } from "react";
import { ChevronDown, ChevronUp, Utensils, X, Loader2 } from "lucide-react";
import { useLeftoverTray } from "@/hooks/useLeftoverTray";
import type { LeftoverTrayItem } from "@/api/leftoverTray";
import type { MealSlot } from "@/types/mealPlan";
import { MEAL_SLOTS } from "@/types/mealPlan";
import { weekDays, addWeeks, todayIso, formatWeekdayShort, formatMonthDay } from "@/lib/weekUtils";

interface LeftoverTrayProps {
  // The week currently being viewed — used as the default target range
  // when the user opens the schedule popover.
  weekStart: string;
}

export function LeftoverTray({ weekStart }: LeftoverTrayProps) {
  const { items, removeItem, scheduleItem } = useLeftoverTray();
  const [open, setOpen] = useState(true);
  const [scheduling, setScheduling] = useState<LeftoverTrayItem | null>(null);

  if (items.length === 0) return null;

  return (
    <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Utensils className="h-4 w-4 shrink-0 text-gray-500" />
          <span className="text-sm font-medium text-gray-800">
            Leftovers ready to use
          </span>
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
            {items.length}
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
        )}
      </button>

      {open && (
        <ul className="flex flex-wrap gap-2 px-4 pb-3">
          {items.map((item) => (
            <li key={item.id}>
              <div className="group flex items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-3 pr-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setScheduling(item)}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-garnish-700"
                >
                  <span className="max-w-[8rem] truncate">{item.source.title}</span>
                  <span className="rounded-full bg-garnish-50 px-1.5 py-0.5 text-[10px] text-garnish-700">
                    {item.servings}
                    {item.servings === 1 ? " serving" : " servings"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => removeItem.mutate(item.id)}
                  disabled={removeItem.isPending}
                  className="ml-0.5 rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
                  aria-label={`Remove ${item.source.title} from tray`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {scheduling && (
        <SchedulePopover
          item={scheduling}
          weekStart={weekStart}
          onCancel={() => setScheduling(null)}
          onConfirm={(date, meal_slot) => {
            scheduleItem.mutate(
              { id: scheduling.id, date, meal_slot },
              { onSuccess: () => setScheduling(null) }
            );
          }}
          isSubmitting={scheduleItem.isPending}
        />
      )}
    </div>
  );
}

function SchedulePopover({
  item,
  weekStart,
  onCancel,
  onConfirm,
  isSubmitting,
}: {
  item: LeftoverTrayItem;
  weekStart: string;
  onCancel: () => void;
  onConfirm: (date: string, meal_slot: MealSlot) => void;
  isSubmitting: boolean;
}) {
  const today = todayIso();
  const thisWeekDays = weekDays(weekStart);
  const nextWeekDays = weekDays(addWeeks(weekStart, 1));
  const allDays = [...thisWeekDays, ...nextWeekDays].filter((d) => d >= today);
  const [date, setDate] = useState<string>(allDays[0] ?? thisWeekDays[0]);
  const [slot, setSlot] = useState<MealSlot>("lunch");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        onClick={onCancel}
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">
          Schedule {item.source.title}
        </h3>
        <p className="mt-0.5 text-xs text-gray-500">
          {item.servings} {item.servings === 1 ? "serving" : "servings"} from the tray
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Day
            </label>
            <select
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
            >
              {allDays.map((d) => (
                <option key={d} value={d}>
                  {formatWeekdayShort(d)}, {formatMonthDay(d)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Slot
            </label>
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value as MealSlot)}
              className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-garnish-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-garnish-500"
            >
              {MEAL_SLOTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(date, slot)}
            disabled={isSubmitting}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-garnish-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-garnish-700 disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
