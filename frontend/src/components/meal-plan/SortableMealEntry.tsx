import { useEffect, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MealEntry } from "./MealEntry";
import type { MealPlanEntry } from "@/types/mealPlan";

interface SortableMealEntryProps {
  entry: MealPlanEntry;
  onOptionsClick?: (entry: MealPlanEntry) => void;
  disabled?: boolean;
}

/**
 * Sortable/draggable wrapper around MealEntry. The whole card is the drag
 * handle, with activation gated on a small pointer distance so ordinary
 * clicks still reach the inner <Link> to the recipe detail page.
 *
 * Click suppression: after a drag finishes, the browser still synthesises
 * a click on pointer-up. We capture it and preventDefault + stopPropagation
 * so the entry's <Link> doesn't navigate away. Detection uses an
 * `isDragging` latch that stays true briefly after drop.
 */
export function SortableMealEntry({
  entry,
  onOptionsClick,
  disabled,
}: SortableMealEntryProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: entry.id,
    disabled,
    data: { type: "entry", date: entry.date, slot: entry.meal_slot },
  });

  // Latch: true while dragging and for one tick after drop, so the
  // click synthesised on pointer-up gets swallowed before navigation.
  const justDraggedRef = useRef(false);
  useEffect(() => {
    if (isDragging) {
      justDraggedRef.current = true;
    } else if (justDraggedRef.current) {
      // Clear on the next macrotask, after the click event has fired.
      const t = setTimeout(() => {
        justDraggedRef.current = false;
      }, 0);
      return () => clearTimeout(t);
    }
  }, [isDragging]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClickCapture={(e) => {
        if (justDraggedRef.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      {...attributes}
      {...listeners}
    >
      <MealEntry entry={entry} onOptionsClick={onOptionsClick} />
    </div>
  );
}
