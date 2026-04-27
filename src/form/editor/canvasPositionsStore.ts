// Shared store for visual-canvas box positions (demo).
//
// The Vizuális feltételek (demo) tab places fields onto a freeform canvas
// and persists the box positions + an optional `order` number per box in
// localStorage, keyed by form id. Other tabs (e.g. the new Előnézet (demo)
// tab) need to read the same data without prop-drilling — this module
// provides a tiny subscribe/get/set API plus a helper hook.

import { useSyncExternalStore } from "react";

export interface BoxPos {
  x: number;
  y: number;
  /** Optional 1-based ordering for the demo preview tab. */
  order?: number;
}

export type PositionsMap = Record<string, BoxPos>;

function lsKey(formId: string | null | undefined) {
  return `condition-canvas-positions:${formId ?? "default"}`;
}

export function loadPositions(formId: string | null | undefined): PositionsMap {
  try {
    const raw = localStorage.getItem(lsKey(formId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function savePositions(
  formId: string | null | undefined,
  positions: PositionsMap
) {
  try {
    localStorage.setItem(lsKey(formId), JSON.stringify(positions));
  } catch {
    // ignore quota / serialization errors
  }
  notify(formId);
}

// ---------- Pub/sub so other tabs re-render on changes ----------

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

function notify(formId: string | null | undefined) {
  const key = lsKey(formId);
  listeners.get(key)?.forEach((l) => l());
}

function subscribe(formId: string | null | undefined, l: Listener) {
  const key = lsKey(formId);
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(l);
  return () => {
    set!.delete(l);
  };
}

/** Re-renders whenever positions for the given form change. */
export function useCanvasPositions(formId: string | null | undefined): PositionsMap {
  // Cache snapshots per formId so getSnapshot is referentially stable
  // between renders when nothing changed (required by useSyncExternalStore).
  const snapshotRef = positionsSnapshotCache;
  return useSyncExternalStore(
    (l) => subscribe(formId, l),
    () => {
      const next = loadPositions(formId);
      const key = lsKey(formId);
      const prev = snapshotRef.get(key);
      if (prev && shallowEqualPositions(prev, next)) return prev;
      snapshotRef.set(key, next);
      return next;
    }
  );
}

const positionsSnapshotCache = new Map<string, PositionsMap>();

function shallowEqualPositions(a: PositionsMap, b: PositionsMap) {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    const av = a[k];
    const bv = b[k];
    if (!bv) return false;
    if (av.x !== bv.x || av.y !== bv.y || av.order !== bv.order) return false;
  }
  return true;
}
