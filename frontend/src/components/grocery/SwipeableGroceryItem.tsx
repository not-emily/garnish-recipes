import { type ReactNode } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Check, Trash2 } from "lucide-react";

interface SwipeableGroceryItemProps {
  children: ReactNode;
  onSwipeCheck: () => void;
  onSwipeRemove: () => void;
  enabled: boolean;
}

const SWIPE_THRESHOLD = 120;

/**
 * Horizontal-swipe affordance for a grocery item. Right = check, left = delete.
 *
 * Two details that look optional but aren't:
 *   - The outer wrapper has `layout` so that when an item is removed or
 *     re-categorized (checked → moves to Checked section), neighbouring
 *     items glide into the gap via popLayout rather than snapping.
 *   - The inner draggable pins `y` to 0 via a MotionValue on every drag
 *     tick. Without this, the swipe drifts vertically proportional to
 *     the horizontal distance (see onDrag comment below).
 */
export function SwipeableGroceryItem({
  children,
  onSwipeCheck,
  onSwipeRemove,
  enabled,
}: SwipeableGroceryItemProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Right swipe: green check — light at first, dark green at threshold
  const checkOpacity = useTransform(x, [0, 40, SWIPE_THRESHOLD], [0, 0.3, 1]);
  const checkScale = useTransform(x, [0, SWIPE_THRESHOLD], [0.5, 1]);

  // Left swipe: red delete — light at first, dark red at threshold
  const deleteOpacity = useTransform(x, [-SWIPE_THRESHOLD, -40, 0], [1, 0.3, 0]);
  const deleteScale = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0.5]);

  if (!enabled) return <>{children}</>;

  return (
    <motion.div
      layout
      className="relative overflow-hidden rounded-lg"
      exit={{
        opacity: 0,
        height: 0,
        marginTop: 0,
        marginBottom: 0,
        transition: { duration: 0.2 },
      }}
    >
      {/* Green check background (swipe right) */}
      <motion.div
        className="absolute inset-0 flex items-center pl-4 bg-garnish-600 rounded-lg"
        style={{ opacity: checkOpacity }}
      >
        <motion.div style={{ scale: checkScale }}>
          <Check className="h-5 w-5 text-white" />
        </motion.div>
      </motion.div>

      {/* Red delete background (swipe left) */}
      <motion.div
        className="absolute inset-0 flex items-center justify-end pr-4 bg-red-600 rounded-lg"
        style={{ opacity: deleteOpacity }}
      >
        <motion.div style={{ scale: deleteScale }}>
          <Trash2 className="h-5 w-5 text-white" />
        </motion.div>
      </motion.div>

      {/* touch-pan-y keeps page scroll in the browser's hands; Framer Motion
          claims horizontal via drag="x". */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -SWIPE_THRESHOLD * 1.25, right: SWIPE_THRESHOLD * 1.25 }}
        dragElastic={0.15}
        dragMomentum={false}
        style={{ x, y }}
        onDrag={() => {
          // Pin y at 0 on every tick. drag="x" alone isn't sufficient:
          // something in the drag pipeline writes a y value proportional to
          // the x delta, and the literal `y: 0` in style won't override it
          // because it's a static initial value, not a live MotionValue.
          // Using a real MotionValue plus this per-tick reset keeps the
          // swipe strictly horizontal.
          if (y.get() !== 0) y.set(0);
        }}
        onDragEnd={(_e, info) => {
          if (info.offset.x > SWIPE_THRESHOLD) {
            onSwipeCheck();
          } else if (info.offset.x < -SWIPE_THRESHOLD) {
            onSwipeRemove();
          }
          // Always snap back to 0 on release. Constraints only bounce back on
          // overshoot; anything released inside the threshold window would
          // otherwise stay wherever the finger let go.
          animate(x, 0, { type: "spring", stiffness: 500, damping: 40 });
          y.set(0);
        }}
        className="relative touch-pan-y"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
