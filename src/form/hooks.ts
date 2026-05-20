import { useEffect, useRef, useState } from "react";
import type { HotkeyModifier } from "./adminAccess";

/**
 * Detects the user double-pressing a configured hotkey (with optional modifier)
 * within `windowMs`. Calls `onTrigger` on the second press.
 */
export function useDoubleHotkey(
  onTrigger: () => void,
  options: { key?: string; modifier?: HotkeyModifier; windowMs?: number } = {}
) {
  const { key = "k", modifier = "ctrl", windowMs = 600 } = options;
  const lastPress = useRef<number>(0);
  const onTriggerRef = useRef(onTrigger);
  onTriggerRef.current = onTrigger;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const modOk =
        modifier === "none"
          ? !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey
          : modifier === "ctrl"
            ? e.ctrlKey || e.metaKey
            : modifier === "alt"
              ? e.altKey
              : e.shiftKey;
      if (!modOk) return;
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      if (modifier === "none") {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      }
      e.preventDefault();
      const now = Date.now();
      if (now - lastPress.current <= windowMs) {
        lastPress.current = 0;
        onTriggerRef.current();
      } else {
        lastPress.current = now;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [key, modifier, windowMs]);
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
