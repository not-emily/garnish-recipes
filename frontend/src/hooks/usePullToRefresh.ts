import { useState, useRef, useCallback, type TouchEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";

const THRESHOLD = 60;

export function usePullToRefresh() {
  const queryClient = useQueryClient();
  const [pullProgress, setPullProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const onTouchStart = useCallback((e: TouchEvent) => {
    // Only activate if scrolled to the top
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    if (scrollTop > 0 || isRefreshing) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, [isRefreshing]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta < 0) {
      pulling.current = false;
      setPullProgress(0);
      return;
    }
    setPullProgress(Math.min(delta / THRESHOLD, 1));
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!pulling.current) return;
    pulling.current = false;

    if (pullProgress >= 1) {
      setIsRefreshing(true);
      queryClient.invalidateQueries().then(() => {
        setIsRefreshing(false);
        setPullProgress(0);
      });
    } else {
      setPullProgress(0);
    }
  }, [pullProgress, queryClient]);

  return {
    pullProgress,
    isRefreshing,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
