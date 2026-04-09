import { useCallback, useRef } from "react";

interface UseLongPressOptions {
  delay?: number;
  // Movement (in px) above which we cancel — prevents the press from
  // firing when the user is actually scrolling/swiping.
  moveThreshold?: number;
}

/**
 * Returns pointer event handlers that fire `callback` once the user has
 * held the pointer down for `delay` ms without moving more than
 * `moveThreshold` pixels. Designed for the "long-press to enter move
 * mode" interaction on mobile.
 *
 * Pointer events are used (not touch) so the same code path works for
 * mouse-based long-presses too.
 */
export function useLongPress(
  callback: () => void,
  { delay = 500, moveThreshold = 8 }: UseLongPressOptions = {}
) {
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      firedRef.current = false;
      startRef.current = { x: e.clientX, y: e.clientY };
      timerRef.current = window.setTimeout(() => {
        firedRef.current = true;
        callback();
      }, delay);
    },
    [callback, delay]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startRef.current) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      if (Math.hypot(dx, dy) > moveThreshold) clear();
    },
    [clear, moveThreshold]
  );

  // Suppress the click that follows a long-press so the entry's <Link>
  // doesn't navigate away when entering move mode.
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (firedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      firedRef.current = false;
    }
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onClickCapture,
  };
}
