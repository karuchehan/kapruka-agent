"use client";
import { useEffect, useState } from "react";

/**
 * SSR-safe media query hook. Returns false on the server and on the first client
 * render (so server HTML and first client render agree — no hydration mismatch),
 * then syncs to the real match inside useEffect.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
