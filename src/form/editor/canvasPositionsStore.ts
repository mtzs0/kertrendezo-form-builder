// Shared store for visual-canvas box positions (demo).
//
// Source of truth: the `form_field_canvas_positions` Supabase table (one row
// per field). We keep an in-memory cache per formId and persist changes back
// to the DB with a small debounce so dragging doesn't fire a request per
// pointermove. A pub/sub layer on top lets the Canvas tab and the Előnézet
// (demo) tab stay in sync without prop drilling.
//
// The on-disk row uses `order_index`; the in-memory shape exposes it as
// `order` to match what the rest of the app already uses.

import { useEffect, useState } from "react";
import {
  deleteAllCanvasPositionsForForm,
  deleteCanvasPosition,
  loadCanvasPositions,
  upsertCanvasPosition,
} from "@/form/canvasPositionsApi";

export interface BoxPos {
  x: number;
  y: number;
  /** Optional 1-based ordering for the demo preview tab. */
  order?: number;
}

export type PositionsMap = Record<string, BoxPos>;

// ---------- Per-form in-memory cache ----------

interface FormState {
  /** Latest positions known to the client. */
  positions: PositionsMap;
  /** Whether we've fetched from Supabase at least once. */
  loaded: boolean;
  /** In-flight load promise (so concurrent callers share one fetch). */
  loading?: Promise<void>;
  /** Per-field debounce timers for upserts. */
  saveTimers: Map<string, ReturnType<typeof setTimeout>>;
  /** Listeners to notify on any change. */
  listeners: Set<() => void>;
}

const states = new Map<string, FormState>();

function keyOf(formId: string | null | undefined) {
  return formId ?? "__none__";
}

function getState(formId: string | null | undefined): FormState {
  const k = keyOf(formId);
  let s = states.get(k);
  if (!s) {
    s = { positions: {}, loaded: false, saveTimers: new Map(), listeners: new Set() };
    states.set(k, s);
  }
  return s;
}

function notify(s: FormState) {
  s.listeners.forEach((l) => l());
}

// ---------- Public read API ----------

/** Synchronous current snapshot. Empty {} until the first load resolves. */
export function getPositions(formId: string | null | undefined): PositionsMap {
  return getState(formId).positions;
}

/** Trigger a (cached) load from the DB. Safe to call repeatedly. */
export function ensurePositionsLoaded(formId: string | null | undefined): Promise<void> {
  const s = getState(formId);
  if (s.loaded) return Promise.resolve();
  if (s.loading) return s.loading;
  if (!formId) {
    s.loaded = true;
    return Promise.resolve();
  }
  s.loading = (async () => {
    try {
      const rows = await loadCanvasPositions(formId);
      const next: PositionsMap = {};
      for (const r of rows) {
        next[r.field_id] = {
          x: r.x,
          y: r.y,
          order: r.order_index == null ? undefined : r.order_index,
        };
      }
      s.positions = next;
      s.loaded = true;
      notify(s);
    } catch (e) {
      // Surface in console but don't blow up the UI — leave positions empty.
      // eslint-disable-next-line no-console
      console.error("Failed to load canvas positions", e);
      s.loaded = true;
    } finally {
      s.loading = undefined;
    }
  })();
  return s.loading;
}

// ---------- Public write API ----------

/**
 * Set/replace a single field's position. Updates the in-memory cache
 * immediately (so the UI reacts), then persists to the DB after a short
 * debounce window (so a drag fires one upsert, not 50).
 */
export function setPosition(
  formId: string | null | undefined,
  fieldId: string,
  pos: BoxPos
) {
  const s = getState(formId);
  s.positions = { ...s.positions, [fieldId]: pos };
  notify(s);
  if (!formId) return;
  scheduleSave(s, formId, fieldId);
}

/**
 * Apply a functional update to the entire positions map (kept for parity
 * with the previous setState((prev) => …) pattern in the canvas).
 * Persists every changed field individually.
 */
export function updatePositions(
  formId: string | null | undefined,
  updater: (prev: PositionsMap) => PositionsMap
) {
  const s = getState(formId);
  const prev = s.positions;
  const next = updater(prev);
  s.positions = next;
  notify(s);
  if (!formId) return;
  // Diff prev vs next and persist additions/changes; deletions are handled
  // through removePosition / clearPositions instead.
  for (const id of Object.keys(next)) {
    const a = prev[id];
    const b = next[id];
    if (!a || a.x !== b.x || a.y !== b.y || a.order !== b.order) {
      scheduleSave(s, formId, id);
    }
  }
}

/** Remove a single field from the canvas (and from the DB). */
export function removePosition(formId: string | null | undefined, fieldId: string) {
  const s = getState(formId);
  if (!s.positions[fieldId]) return;
  const { [fieldId]: _omit, ...rest } = s.positions;
  s.positions = rest;
  notify(s);
  // Cancel any pending save for this field — the row is going away.
  const t = s.saveTimers.get(fieldId);
  if (t) {
    clearTimeout(t);
    s.saveTimers.delete(fieldId);
  }
  if (!formId) return;
  void deleteCanvasPosition(fieldId).catch((e) => {
    // eslint-disable-next-line no-console
    console.error("Failed to delete canvas position", e);
  });
}

/** Wipe every position for the form. */
export function clearPositions(formId: string | null | undefined) {
  const s = getState(formId);
  s.positions = {};
  s.saveTimers.forEach((t) => clearTimeout(t));
  s.saveTimers.clear();
  notify(s);
  if (!formId) return;
  void deleteAllCanvasPositionsForForm(formId).catch((e) => {
    // eslint-disable-next-line no-console
    console.error("Failed to clear canvas positions", e);
  });
}

// ---------- Debounced per-field save ----------

const SAVE_DEBOUNCE_MS = 300;

function scheduleSave(s: FormState, formId: string, fieldId: string) {
  const existing = s.saveTimers.get(fieldId);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    s.saveTimers.delete(fieldId);
    const pos = s.positions[fieldId];
    if (!pos) return;
    void upsertCanvasPosition({
      field_id: fieldId,
      x: pos.x,
      y: pos.y,
      order_index: pos.order ?? null,
    }).catch((e) => {
      // eslint-disable-next-line no-console
      console.error("Failed to save canvas position", e);
    });
  }, SAVE_DEBOUNCE_MS);
  s.saveTimers.set(fieldId, t);
}

// ---------- Hook ----------

/**
 * Re-renders whenever positions for the given form change. Triggers a
 * lazy load from Supabase the first time it's mounted for a given form.
 *
 * Returns both the snapshot and a `loaded` flag indicating whether the
 * initial DB fetch has resolved. Callers MUST gate any auto-placement
 * logic on `loaded === true` — otherwise they'd write grid-default
 * positions over the (still-loading) DB values and scramble the canvas.
 */
export function useCanvasPositions(formId: string | null | undefined): PositionsMap {
  const [, force] = useState(0);

  useEffect(() => {
    const st = getState(formId);
    const listener = () => force((n) => n + 1);
    st.listeners.add(listener);
    // Trigger the load and re-render once it resolves so consumers see
    // `loaded === true` (via useCanvasPositionsLoaded) at the same time.
    void ensurePositionsLoaded(formId).then(() => force((n) => n + 1));
    // Re-sync immediately in case state changed between render and effect.
    force((n) => n + 1);
    return () => {
      st.listeners.delete(listener);
    };
  }, [formId]);

  return getState(formId).positions;
}

/** Whether the initial DB load for this form's positions has resolved. */
export function useCanvasPositionsLoaded(formId: string | null | undefined): boolean {
  const [, force] = useState(0);
  useEffect(() => {
    const st = getState(formId);
    const listener = () => force((n) => n + 1);
    st.listeners.add(listener);
    void ensurePositionsLoaded(formId).then(() => force((n) => n + 1));
    force((n) => n + 1);
    return () => {
      st.listeners.delete(listener);
    };
  }, [formId]);
  return getState(formId).loaded;
}
