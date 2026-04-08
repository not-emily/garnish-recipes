import { useEffect, useState } from "react";

/**
 * Subscribes to a CSS media query and returns whether it currently matches.
 * SSR-safe: returns `false` on the first render if `window` is unavailable.
 *
 * Use this when Tailwind's arbitrary variant syntax gets awkward (e.g.
 * combined `@media (min-width: X) and (hover: hover)` checks that v4's
 * class parser doesn't always accept cleanly).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    // Keep local state in sync with the media query as the viewport or
    // input device changes (window resize, mouse plugged in, etc).
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", onChange);
    setMatches(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
