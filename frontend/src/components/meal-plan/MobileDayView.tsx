import { useState, useEffect } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { X } from "lucide-react";
import { DayColumn } from "./DayColumn";
import type { MealPlanEntry, MealSlot } from "@/types/mealPlan";
import {
  formatWeekdayLong,
  formatMonthDay,
  todayIso,
  weekDays,
} from "@/lib/weekUtils";

interface MobileDayViewProps {
  weekStart: string;
  entries: MealPlanEntry[];
  onAddClick: (date: string, slot: MealSlot) => void;
  onEntryOptionsClick: (entry: MealPlanEntry) => void;
  onMoveEntry: (entryId: number, date: string, slot: MealSlot) => void;
}

/**
 * Single-day mobile view with horizontal swipe to navigate between days.
 * Contains the tap-to-move flow:
 *
 *   1. Long-press an entry → enters move mode (entry highlighted, banner)
 *   2. User swipes/taps to navigate to a target day if needed
 *   3. Tap any slot's "Move here" affordance → entry moves to that slot
 *   4. Tap the active entry again, or the banner's X, to cancel
 *
 * Move mode persists across day swipes so users can move across days
 * without losing the active selection.
 */
export function MobileDayView({
  weekStart,
  entries,
  onAddClick,
  onEntryOptionsClick,
  onMoveEntry,
}: MobileDayViewProps) {
  const days = weekDays(weekStart);

  // Default to today if it's in the visible week, otherwise day 0 (Mon).
  const initialIdx = (() => {
    const t = todayIso();
    const idx = days.indexOf(t);
    return idx === -1 ? 0 : idx;
  })();

  const [activeIdx, setActiveIdx] = useState(initialIdx);
  const [direction, setDirection] = useState(0);
  const [moveTarget, setMoveTarget] = useState<MealPlanEntry | null>(null);

  // Reset to today's column whenever the week changes (user clicked
  // prev/next/today in the page header).
  useEffect(() => {
    setActiveIdx(initialIdx);
    setMoveTarget(null);
    // initialIdx depends on weekStart via days; recompute on weekStart only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  function go(delta: number) {
    const next = activeIdx + delta;
    if (next < 0 || next > 6) return;
    setDirection(delta);
    setActiveIdx(next);
  }

  function handleDragEnd(_e: unknown, info: PanInfo) {
    const SWIPE_THRESHOLD = 50;
    const VELOCITY_THRESHOLD = 300;
    if (info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -VELOCITY_THRESHOLD) {
      go(1);
    } else if (
      info.offset.x > SWIPE_THRESHOLD ||
      info.velocity.x > VELOCITY_THRESHOLD
    ) {
      go(-1);
    }
  }

  function handleMoveHere(date: string, slot: MealSlot) {
    if (!moveTarget) return;
    // Tapping the same slot the entry already lives in cancels the move.
    if (moveTarget.date === date && moveTarget.meal_slot === slot) {
      setMoveTarget(null);
      return;
    }
    onMoveEntry(moveTarget.id, date, slot);
    setMoveTarget(null);
  }

  const activeDate = days[activeIdx];

  return (
    <div className="flex flex-col">
      {/* Day strip — tap to jump, current day highlighted */}
      <div className="mb-3 flex items-stretch justify-between gap-1">
        {days.map((d, i) => {
          const isActive = i === activeIdx;
          const isToday = d === todayIso();
          return (
            <button
              key={d}
              type="button"
              onClick={() => {
                setDirection(i > activeIdx ? 1 : -1);
                setActiveIdx(i);
              }}
              className={`flex flex-1 flex-col items-center rounded-lg py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                isActive
                  ? "bg-garnish-600 text-white"
                  : isToday
                    ? "bg-garnish-50 text-garnish-700"
                    : "text-gray-500 hover:bg-gray-50"
              }`}
              aria-label={`Show ${formatWeekdayLong(d)}`}
              aria-current={isActive ? "date" : undefined}
            >
              <span>{formatWeekdayLong(d).slice(0, 1)}</span>
              <span className="mt-0.5 text-xs font-bold">
                {formatMonthDay(d).split(" ")[1]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Move-mode banner */}
      <AnimatePresence>
        {moveTarget && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-garnish-200 bg-garnish-50 px-3 py-2 text-xs text-garnish-800"
          >
            <span className="truncate">
              Moving <span className="font-semibold">{moveTarget.title}</span> — tap a slot
            </span>
            <button
              type="button"
              onClick={() => setMoveTarget(null)}
              className="shrink-0 rounded p-1 text-garnish-700 hover:bg-garnish-100"
              aria-label="Cancel move"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Animated single-day pane with horizontal swipe */}
      <div className="relative overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={activeDate}
            custom={direction}
            initial={{ x: direction * 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -direction * 60, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
          >
            <DayColumn
              date={activeDate}
              entries={entries}
              onAddClick={onAddClick}
              onEntryOptionsClick={onEntryOptionsClick}
              moveMode={!!moveTarget}
              onMoveHere={handleMoveHere}
              onEntryLongPress={(entry) => setMoveTarget(entry)}
              moveTargetId={moveTarget?.id}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
