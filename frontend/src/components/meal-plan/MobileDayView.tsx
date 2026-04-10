import { useState, useEffect, useRef, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { MealEntry } from "./MealEntry";
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
  onReorderSlot: (entryIds: number[]) => void;
  onWeekChange: (delta: number) => void;
}

// Framer Motion variants as functions of `direction` so AnimatePresence
// passes the LATEST direction to the exiting component (fixes the
// wrong-direction exit when alternating swipe directions).
const dayVariants = {
  enter: (dir: number) => ({ x: dir * 60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: -dir * 60, opacity: 0 }),
};

const EDGE_ZONE = 40; // px from viewport edge to trigger day change
const EDGE_DELAY_INITIAL = 600; // ms for first edge-scroll
const EDGE_DELAY_REPEAT = 800; // ms for subsequent edge-scrolls

/**
 * Single-day mobile view with horizontal swipe to navigate between days
 * and drag-and-drop for reordering / cross-slot moves within a day.
 *
 * Edge-scrolling: during an active drag, holding the entry near the left
 * or right viewport edge for EDGE_DELAY ms automatically advances the
 * day, enabling cross-day moves without dropping and re-dragging.
 */
export function MobileDayView({
  weekStart,
  entries,
  onAddClick,
  onEntryOptionsClick,
  onMoveEntry,
  onReorderSlot,
  onWeekChange,
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

  // --- Drag-and-drop state ---
  const [activeEntry, setActiveEntry] = useState<MealPlanEntry | null>(null);
  const [overSlotId, setOverSlotId] = useState<string | null>(null);

  // Edge-scroll timer: while dragging near the viewport edge, fire a day
  // change after EDGE_DELAY ms. Cleared when the pointer leaves the zone
  // or the drag ends.
  const edgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeIdxRef = useRef(activeIdx);
  activeIdxRef.current = activeIdx;
  const activeEntryRef = useRef(activeEntry);
  activeEntryRef.current = activeEntry;
  // Stable ref to onWeekChange so callbacks don't go stale.
  const onWeekChangeRef = useRef(onWeekChange);
  onWeekChangeRef.current = onWeekChange;
  // When go() triggers a cross-week navigation, it stores the target day
  // index here. The render-time detection below reads and clears it.
  const pendingIdxRef = useRef<number | null>(null);
  const prevWeekStartRef = useRef(weekStart);

  const clearEdgeTimer = useCallback(() => {
    if (edgeTimerRef.current) {
      clearTimeout(edgeTimerRef.current);
      edgeTimerRef.current = null;
    }
  }, []);

  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  );

  // Detect weekStart change DURING RENDER (not in an effect). This avoids
  // the StrictMode double-fire bug that corrupted the crossWeekNavRef flag.
  // React allows setState during render as long as it's conditional and
  // doesn't loop (the "adjust state from props" pattern).
  if (prevWeekStartRef.current !== weekStart) {
    prevWeekStartRef.current = weekStart;
    // Clear any stuck drag state — the dragged entry doesn't exist in
    // the new week's data, so continuing the drag would break.
    if (activeEntry) {
      setActiveEntry(null);
      setOverSlotId(null);
    }
    if (pendingIdxRef.current !== null) {
      // Cross-week navigation from go() — show the target day
      setActiveIdx(pendingIdxRef.current);
      pendingIdxRef.current = null;
    } else {
      // Button navigation (prev/next/today) — reset to today
      setActiveIdx(initialIdx);
    }
  }

  // All navigation goes through this ref-based function so that timers
  // and callbacks always read the latest state via refs (no stale closures).
  const go = useCallback((delta: number) => {
    const next = activeIdxRef.current + delta;
    if (next < 0) {
      // Can't cross weeks during a drag — the entry doesn't exist in
      // the other week's data, so the drag would break.
      if (activeEntryRef.current) return;
      pendingIdxRef.current = 6;
      onWeekChangeRef.current(-1);
      setDirection(-1);
      setActiveIdx(6);
      return;
    }
    if (next > 6) {
      if (activeEntryRef.current) return;
      pendingIdxRef.current = 0;
      onWeekChangeRef.current(1);
      setDirection(1);
      setActiveIdx(0);
      return;
    }
    setDirection(delta);
    setActiveIdx(next);
  }, []);

  function handleSwipeEnd(_e: unknown, info: PanInfo) {
    // Only navigate via swipe when NOT in a dnd-kit drag.
    if (activeEntry) return;
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

  // --- dnd-kit handlers ---

  function handleDragStart(event: DragStartEvent) {
    const entry = entries.find((e) => e.id === event.active.id);
    setActiveEntry(entry ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event;
    if (!over) {
      setOverSlotId(null);
      return;
    }
    const overData = over.data.current as
      | { type?: string; date?: string; slot?: string }
      | undefined;
    if (overData?.date && overData?.slot) {
      setOverSlotId(`${overData.date}:${overData.slot}`);
    } else {
      setOverSlotId(null);
    }
  }

  // Edge-scrolling: while a drag is active, track the pointer via a
  // window listener and start a self-rescheduling timer when the pointer
  // enters the left/right edge zone. During drag, stops at week boundaries
  // (Mon/Sun) since the entry can't cross weeks.
  const lastPointerXRef = useRef(0);
  const edgeScrollCountRef = useRef(0);

  const scheduleEdgeScroll = useCallback(() => {
    if (edgeTimerRef.current) return; // already scheduled

    const x = lastPointerXRef.current;
    const vw = window.innerWidth;
    const idx = activeIdxRef.current;
    const atLeftEdge = x < EDGE_ZONE && idx > 0;
    const atRightEdge = x > vw - EDGE_ZONE && idx < 6;

    if (atLeftEdge || atRightEdge) {
      const dir = atLeftEdge ? -1 : 1;
      const delay =
        edgeScrollCountRef.current === 0
          ? EDGE_DELAY_INITIAL
          : EDGE_DELAY_REPEAT;
      edgeTimerRef.current = setTimeout(() => {
        edgeTimerRef.current = null;
        edgeScrollCountRef.current += 1;
        go(dir);
        // Re-check: if still at the edge after advancing, schedule again
        scheduleEdgeScroll();
      }, delay);
    }
  }, [go, clearEdgeTimer]);

  useEffect(() => {
    if (!activeEntry) return;

    function onPointerMove(e: PointerEvent) {
      lastPointerXRef.current = e.clientX;

      const x = e.clientX;
      const vw = window.innerWidth;
      const idx = activeIdxRef.current;
      const inEdgeZone =
        (x < EDGE_ZONE && idx > 0) ||
        (x > vw - EDGE_ZONE && idx < 6);

      if (inEdgeZone) {
        scheduleEdgeScroll();
      } else {
        clearEdgeTimer();
        edgeScrollCountRef.current = 0;
      }
    }

    window.addEventListener("pointermove", onPointerMove);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      clearEdgeTimer();
    };
  }, [activeEntry, clearEdgeTimer, scheduleEdgeScroll]);

  function handleDragEnd(event: DragEndEvent) {
    clearEdgeTimer();
    edgeScrollCountRef.current = 0;
    const draggedEntry = activeEntry;
    setActiveEntry(null);
    setOverSlotId(null);

    const { active, over } = event;
    if (!over || !draggedEntry) return;
    if (active.id === over.id) return;

    const overData = over.data.current as
      | { type?: string; date?: string; slot?: MealSlot }
      | undefined;
    if (!overData?.date || !overData?.slot) return;

    const targetDate = overData.date;
    const targetSlot = overData.slot;
    const sameSlot =
      draggedEntry.date === targetDate && draggedEntry.meal_slot === targetSlot;

    if (sameSlot) {
      const slotEntries = entries
        .filter((e) => e.date === targetDate && e.meal_slot === targetSlot)
        .sort((a, b) => a.position - b.position);
      const fromIdx = slotEntries.findIndex((e) => e.id === active.id);
      const toIdx = slotEntries.findIndex((e) => e.id === over.id);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
      const reordered = arrayMove(slotEntries, fromIdx, toIdx).map((e) => e.id);
      onReorderSlot(reordered);
    } else {
      onMoveEntry(draggedEntry.id, targetDate, targetSlot);
    }
  }

  const activeDate = days[activeIdx];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        clearEdgeTimer();
        edgeScrollCountRef.current = 0;
        setActiveEntry(null);
        setOverSlotId(null);
      }}
    >
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
                  if (activeEntry) return; // Don't navigate during drag
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

        {/* Animated single-day pane with horizontal swipe */}
        <div className="relative overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={activeDate}
              custom={direction}
              variants={dayVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.18, ease: "easeOut" }}
              drag={activeEntry ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={handleSwipeEnd}
            >
              <DayColumn
                date={activeDate}
                entries={entries}
                onAddClick={onAddClick}
                onEntryOptionsClick={onEntryOptionsClick}
                sortable
                overSlotId={overSlotId}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeEntry ? (
          <div className="opacity-90">
            <MealEntry entry={activeEntry} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
