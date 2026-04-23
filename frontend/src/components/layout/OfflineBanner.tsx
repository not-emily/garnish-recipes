import { WifiOff, CloudOff } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useConnectionState } from "@/lib/connectionState";

export function OfflineBanner() {
  const { isOffline, isServerUnreachable } = useConnectionState();
  const visible = isOffline || isServerUnreachable;

  const message = isOffline
    ? "You're offline — some features may be unavailable"
    : "Can't reach the server — retrying…";
  const Icon = isOffline ? WifiOff : CloudOff;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden bg-amber-500 text-white"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium">
            <Icon className="h-3 w-3" />
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
