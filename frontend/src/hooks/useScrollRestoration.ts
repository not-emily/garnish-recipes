import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router";

/**
 * Per-page scroll position restoration keyed by a stable page id.
 *
 * Saves the current scroll position in sessionStorage on unmount and on
 * route change, and restores it when the page remounts as a result of a
 * POP navigation (browser back/forward). Forward navigation (PUSH/REPLACE)
 * starts from the top as usual.
 *
 * Not a router-wide solution — only the pages that explicitly opt in by
 * calling this hook get restoration, which keeps behaviour predictable.
 */
export function useScrollRestoration(pageId: string) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const storageKey = `garnish:scroll:${pageId}`;
  const restoredKey = useRef<string | null>(null);

  // Restore on mount / route-match, but only for back navigations. Defer
  // to the next paint so the recipe grid has had a chance to render and
  // the page's scrollHeight is accurate.
  useEffect(() => {
    if (navigationType !== "POP") return;
    if (restoredKey.current === location.key) return;
    restoredKey.current = location.key;

    const saved = sessionStorage.getItem(storageKey);
    if (!saved) return;

    const y = Number.parseInt(saved, 10);
    if (!Number.isFinite(y)) return;

    // Try a couple of times — the first frame often has a shorter
    // scrollHeight than the final layout once images load.
    const attempts = [0, 80, 200];
    const timers = attempts.map((delay) =>
      window.setTimeout(() => window.scrollTo(0, y), delay)
    );
    return () => timers.forEach(window.clearTimeout);
  }, [location.key, navigationType, storageKey]);

  // Save on unmount or route change.
  useEffect(() => {
    return () => {
      sessionStorage.setItem(storageKey, String(window.scrollY));
    };
  }, [storageKey]);
}
