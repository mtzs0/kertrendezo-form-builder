import { useEffect, useRef, useState } from "react";

/**
 * Detects the user pressing Ctrl+K (or Cmd+K) twice within `windowMs`.
 * Calls `onTrigger` on the second press.
 */
export function useDoubleHotkey(
  onTrigger: () => void,
  options: { key?: string; windowMs?: number } = {}
) {
  const { key = "k", windowMs = 600 } = options;
  const lastPress = useRef<number>(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isModifier = e.ctrlKey || e.metaKey;
      if (!isModifier || e.key.toLowerCase() !== key) return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastPress.current <= windowMs) {
        lastPress.current = 0;
        onTrigger();
      } else {
        lastPress.current = now;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [key, windowMs, onTrigger]);
}

/** Tracks whether the viewport is below the given breakpoint (default 768px). */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === "undefined" ? false : window.innerWidth < breakpoint
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);
  return isMobile;
}
