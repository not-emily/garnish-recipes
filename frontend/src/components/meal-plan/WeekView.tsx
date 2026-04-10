import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { DayColumn } from "./DayColumn";
import { MealEntry } from "./MealEntry";
import type { MealPlanEntry, MealSlot } from "@/types/mealPlan";
import { weekDays } from "@/lib/weekUtils";

interface WeekViewProps {
  weekStart: string;
  entries: MealPlanEntry[];
  onAddClick: (date: string, slot: MealSlot) => void;
  onEntryOptionsClick: (entry: MealPlanEntry) => void;
  onReorderSlot: (entryIds: number[]) => void;
  onMoveEntry: (entryId: number, date: string, slot: MealSlot) => void;
}

/**
 * 7-column grid view for the week, wrapped in a DndContext so entries can
 * be dragged between and within meal slots.
 *
 * Drag mechanics:
 *   - A small activation distance (5px) keeps clicks going through to the
 *     recipe detail link for entries that aren't being dragged.
 *   - Same-slot drags fire onReorderSlot with the new ordering of that
 *     slot's entry ids, handled by the reorder endpoint.
 *   - Cross-slot drags fire onMoveEntry with the target date+slot; the
 *     backend appends the entry at the end of the destination slot.
 *
 * Responsive breakpoints:
 *   - lg: 7 columns (full desktop layout)
 *   - md: 4 columns (tablet — wraps to a second row)
 *   - sm: 2 columns
 */
export function WeekView({
  weekStart,
  entries,
  onAddClick,
  onEntryOptionsClick,
  onReorderSlot,
  onMoveEntry,
}: WeekViewProps) {
  const days = weekDays(weekStart);
  const [activeEntry, setActiveEntry] = useState<MealPlanEntry | null>(null);
  // Tracks which slot the drag is currently over so the full slot area
  // highlights (not just the narrow droppable gap between entries).
  const [overSlotId, setOverSlotId] = useState<string | null>(null);

  // PointerSensor (desktop) with a small distance so clicks pass through.
  // TouchSensor with a delay to make dragging feasible on tablets without
  // hijacking taps/scrolls.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  );

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

  function handleDragEnd(event: DragEndEvent) {
    setActiveEntry(null);
    setOverSlotId(null);
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    const sourceEntry = entries.find((e) => e.id === active.id);
    if (!sourceEntry) return;

    // Determine the target slot. `over` is either an entry (number id) or
    // a slot droppable (string id "slot:date:meal_slot").
    let targetDate: string;
    let targetSlot: MealSlot;
    const overData = over.data.current as
      | { type?: string; date?: string; slot?: MealSlot }
      | undefined;
    if (overData?.type === "slot" && overData.date && overData.slot) {
      targetDate = overData.date;
      targetSlot = overData.slot;
    } else if (overData?.type === "entry" && overData.date && overData.slot) {
      targetDate = overData.date;
      targetSlot = overData.slot;
    } else {
      return;
    }

    const sameSlot =
      sourceEntry.date === targetDate && sourceEntry.meal_slot === targetSlot;

    if (sameSlot) {
      // Compute the new ordering of the slot's entries via arrayMove.
      const slotEntries = entries
        .filter((e) => e.date === targetDate && e.meal_slot === targetSlot)
        .sort((a, b) => a.position - b.position);
      const fromIdx = slotEntries.findIndex((e) => e.id === active.id);
      const toIdx = slotEntries.findIndex((e) => e.id === over.id);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
      const reordered = arrayMove(slotEntries, fromIdx, toIdx).map((e) => e.id);
      onReorderSlot(reordered);
    } else {
      onMoveEntry(sourceEntry.id, targetDate, targetSlot);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        {days.map((date) => (
          <DayColumn
            key={date}
            date={date}
            entries={entries}
            onAddClick={onAddClick}
            onEntryOptionsClick={onEntryOptionsClick}
            sortable
            overSlotId={overSlotId}
          />
        ))}
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
