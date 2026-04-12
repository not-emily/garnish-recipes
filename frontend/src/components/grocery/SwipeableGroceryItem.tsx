import { type ReactNode } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Check, Trash2 } from "lucide-react";

interface SwipeableGroceryItemProps {
  children: ReactNode;
  onSwipeCheck: () => void;
  onSwipeRemove: () => void;
  enabled: boolean;
}

const SWIPE_THRESHOLD = 120;

export function SwipeableGroceryItem({
  children,
  onSwipeCheck,
  onSwipeRemove,
  enabled,
}: SwipeableGroceryItemProps) {
  const x = useMotionValue(0);

  // Right swipe: green check — light at first, dark green at threshold
  const checkOpacity = useTransform(x, [0, 40, SWIPE_THRESHOLD], [0, 0.3, 1]);
  const checkScale = useTransform(x, [0, SWIPE_THRESHOLD], [0.5, 1]);

  // Left swipe: red delete — light at first, dark red at threshold
  const deleteOpacity = useTransform(x, [-SWIPE_THRESHOLD, -40, 0], [1, 0.3, 0]);
  const deleteScale = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0.5]);

  if (!enabled) return <>{children}</>;

  return (
    <div className="relative overflow-hidden rounded-lg">
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

      {/* Swipeable content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        style={{ x }}
        onDragEnd={(_e, info) => {
          if (info.offset.x > SWIPE_THRESHOLD) {
            onSwipeCheck();
          } else if (info.offset.x < -SWIPE_THRESHOLD) {
            onSwipeRemove();
          }
        }}
        className="relative"
      >
        {children}
      </motion.div>
    </div>
  );
}
