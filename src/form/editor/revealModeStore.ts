// Tiny pub/sub store for the "reveal fields one-by-one" toggle on the
// Vizuális feltételek (demo) canvas.
//
// Persisted to localStorage per form id. Demo-only — no DB row.

import { useEffect, useState } from "react";

const STORAGE_PREFIX = "kr_canvas_reveal_one_by_one_v1__";

type Listener = () => void;

const cache = new Map<string, boolean>();
const listeners = new Map<string, Set<Listener>>();

function keyOf(formId: string | null | undefined) {
  return formId ?? "__none__";
}

function storageKey(formId: string | null | undefined) {
  return `${STORAGE_PREFIX}${keyOf(formId)}`;
}

function read(formId: string | null | undefined): boolean {
  const k = keyOf(formId);
  if (cache.has(k)) return cache.get(k)!;
  // Default ON — sequential reveal is the canvas preview's default behavior.
  // Only an explicit "0" in storage disables it.
  let v = true;
  try {
    const raw = localStorage.getItem(storageKey(formId));
    if (raw === "0") v = false;
    else if (raw === "1") v = true;
  } catch {
    /* ignore */
  }
  cache.set(k, v);
  return v;
}

function notify(formId: string | null | undefined) {
  const set = listeners.get(keyOf(formId));
  if (!set) return;
  set.forEach((l) => l());
}

export function getRevealOneByOne(formId: string | null | undefined): boolean {
  return read(formId);
}

export function setRevealOneByOne(
  formId: string | null | undefined,
  value: boolean
) {
  cache.set(keyOf(formId), value);
  try {
    localStorage.setItem(storageKey(formId), value ? "1" : "0");
  } catch {
    /* ignore */
  }
  notify(formId);
}

export function useRevealOneByOne(
  formId: string | null | undefined
): [boolean, (v: boolean) => void] {
  const [, force] = useState(0);
  useEffect(() => {
    const k = keyOf(formId);
    let set = listeners.get(k);
    if (!set) {
      set = new Set();
      listeners.set(k, set);
    }
    const l = () => force((n) => n + 1);
    set.add(l);
    return () => {
      set!.delete(l);
    };
  }, [formId]);
  return [read(formId), (v: boolean) => setRevealOneByOne(formId, v)];
}
