import { MealEntry } from "./MealEntry";
import { useLongPress } from "@/hooks/useLongPress";
import type { MealPlanEntry } from "@/types/mealPlan";

interface MobileMealEntryProps {
  entry: MealPlanEntry;
  onOptionsClick?: (entry: MealPlanEntry) => void;
  // Fires after the user holds the entry for ~500ms. Used to enter
  // tap-to-move mode on mobile.
  onLongPress?: (entry: MealPlanEntry) => void;
  // When the entry is the active move target, render with a highlight ring.
  isMoveTarget?: boolean;
  // Tap handler — used to cancel the move when the user taps the active
  // move target. Suppresses normal navigation.
  onTap?: (entry: MealPlanEntry) => void;
}

/**
 * Mobile-only wrapper around MealEntry. Adds long-press detection for
 * tap-to-move mode and a "currently moving" highlight. The whole card
 * remains a recipe link in the normal case; long-press hijacks it.
 */
export function MobileMealEntry({
  entry,
  onOptionsClick,
  onLongPress,
  isMoveTarget,
  onTap,
}: MobileMealEntryProps) {
  const longPress = useLongPress(() => onLongPress?.(entry), { delay: 500 });

  return (
    <div
      {...longPress}
      onClickCapture={(e) => {
        // Long-press path comes first; if it fired, the click is already
        // suppressed inside useLongPress. The onTap path runs for plain
        // taps when a move is in progress and the user is cancelling by
        // tapping the active entry.
        longPress.onClickCapture(e);
        if (onTap && isMoveTarget) {
          e.preventDefault();
          e.stopPropagation();
          onTap(entry);
        }
      }}
      className={
        isMoveTarget
          ? "rounded-lg ring-2 ring-garnish-400 ring-offset-1"
          : undefined
      }
    >
      <MealEntry entry={entry} onOptionsClick={onOptionsClick} />
    </div>
  );
}
