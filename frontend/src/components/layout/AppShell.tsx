import { Suspense } from "react";
import { Outlet, useLocation } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, ArrowDown } from "lucide-react";
import { BottomNav } from "./BottomNav";
import { OfflineBanner } from "./OfflineBanner";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

export function AppShell() {
  const location = useLocation();
  const { pullProgress, isRefreshing, handlers } = usePullToRefresh();

  return (
    <div className="flex min-h-svh flex-col" {...handlers}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-garnish-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg"
      >
        Skip to content
      </a>
      <OfflineBanner />

      {/* Pull-to-refresh indicator */}
      <AnimatePresence>
        {(pullProgress > 0 || isRefreshing) && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: isRefreshing ? 40 : pullProgress * 40 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex items-center justify-center overflow-hidden"
          >
            {isRefreshing ? (
              <Loader2 className="h-5 w-5 animate-spin text-garnish-500" />
            ) : (
              <ArrowDown
                className="h-5 w-5 text-garnish-500"
                style={{
                  opacity: pullProgress,
                  transform: `rotate(${pullProgress * 180}deg)`,
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <main id="main-content" className="flex-1 pb-16">
        <Suspense
          fallback={
            <div className="flex justify-center pt-20">
              <Loader2 className="h-6 w-6 animate-spin text-garnish-400" />
            </div>
          }
        >
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Outlet />
          </motion.div>
        </Suspense>
      </main>
      <BottomNav />
    </div>
  );
}
