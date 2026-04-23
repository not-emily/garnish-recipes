import { RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useConnectionState } from "@/lib/connectionState";

/**
 * Small pill shown when the WebSocket has been disconnected long enough that
 * real-time updates are paused, but HTTP is still working (so OfflineBanner
 * is hiding). Surfaced so the user knows meal plan + grocery changes from
 * other household members won't appear until the cable reconnects.
 */
export function ConnectionIndicator() {
  const { isCableReconnecting, isOffline, isServerUnreachable } =
    useConnectionState();
  // Don't stack with the OfflineBanner — that already tells the user the
  // app can't talk to the server.
  const visible = isCableReconnecting && !isOffline && !isServerUnreachable;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-none fixed left-1/2 top-2 z-[70] -translate-x-1/2"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-1.5 rounded-full bg-gray-800/90 px-3 py-1 text-xs font-medium text-white shadow-lg backdrop-blur">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Reconnecting…
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
