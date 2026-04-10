import { Plus } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SortableMealEntry } from "./SortableMealEntry";
import { MobileMealEntry } from "./MobileMealEntry";
import type { MealPlanEntry, MealSlot as MealSlotType } from "@/types/mealPlan";

interface MealSlotProps {
  date: string;
  slot: MealSlotType;
  label: string;
  entries: MealPlanEntry[];
  onAddClick: (date: string, slot: MealSlotType) => void;
  onEntryOptionsClick: (entry: MealPlanEntry) => void;
  // When set, the slot shows a "move here" affordance and tapping it calls
  // onMoveHere with the active move target. Used by the mobile tap-to-move
  // flow, which is mutually exclusive with drag-and-drop.
  moveMode?: boolean;
  onMoveHere?: (date: string, slot: MealSlotType) => void;
  // When true, entries are rendered as Sortables and the slot is a
  // droppable. Off on mobile where we use tap-to-move instead.
  sortable?: boolean;
  onEntryLongPress?: (entry: MealPlanEntry) => void;
  moveTargetId?: number;
  // "date:slot" string from the parent DndContext's onDragOver, used to
  // highlight this slot when any child entry is being hovered during a drag.
  overSlotId?: string | null;
}

// Prefix used for slot droppable ids so they can be distinguished from
// entry ids (which are plain numbers) in the DnD handler.
export function slotDroppableId(date: string, slot: MealSlotType): string {
  return `slot:${date}:${slot}`;
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
  moveMode = false,
  onMoveHere,
  sortable = false,
  onEntryLongPress,
  moveTargetId,
  overSlotId,
}: MealSlotProps) {
  const droppableId = slotDroppableId(date, slot);
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { type: "slot", date, slot },
    disabled: !sortable,
  });

  // Highlight the slot when anything inside it is being dragged over —
  // either the slot itself or any entry within it.
  const isSlotActive = isOver || overSlotId === `${date}:${slot}`;

  const sortableIds = entries.map((e) => e.id);

  const body = (
    <div className="space-y-1">
      {entries.length === 0 ? (
        <button
          type="button"
          onClick={() =>
            moveMode && onMoveHere
              ? onMoveHere(date, slot)
              : onAddClick(date, slot)
          }
          className={`w-full rounded-lg border border-dashed px-2 py-3 text-[10px] transition-colors ${
            moveMode
              ? "border-garnish-400 bg-garnish-50 text-garnish-700 hover:bg-garnish-100"
              : "border-gray-200 text-gray-400 hover:border-garnish-300 hover:bg-garnish-50 hover:text-garnish-600"
          }`}
        >
          {moveMode ? "Move here" : "Add"}
        </button>
      ) : sortable ? (
        entries.map((entry) => (
          <SortableMealEntry
            key={entry.id}
            entry={entry}
            onOptionsClick={onEntryOptionsClick}
          />
        ))
      ) : (
        entries.map((entry) => (
          <MobileMealEntry
            key={entry.id}
            entry={entry}
            onOptionsClick={onEntryOptionsClick}
            onLongPress={onEntryLongPress}
            isMoveTarget={moveTargetId === entry.id}
            onTap={
              moveTargetId === entry.id ? () => onMoveHere?.(date, slot) : undefined
              // Tapping the active move target while it sits in its own
              // slot effectively cancels the move (no-op move) — handled
              // upstream by exiting move mode after the call.
            }
          />
        ))
      )}
      {moveMode && entries.length > 0 && onMoveHere && (
        <button
          type="button"
          onClick={() => onMoveHere(date, slot)}
          className="w-full rounded-lg border border-dashed border-garnish-400 bg-garnish-50 px-2 py-1.5 text-[10px] font-medium text-garnish-700 hover:bg-garnish-100"
        >
          Move here
        </button>
      )}
    </div>
  );

  return (
    <div
      ref={setNodeRef}
      className={`space-y-1.5 rounded-lg p-1 transition-colors ${
        isSlotActive ? "bg-garnish-100/60 ring-1 ring-garnish-300" : ""
      }`}
    >
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
      {sortable ? (
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {body}
        </SortableContext>
      ) : (
        body
      )}
    </div>
  );
}
