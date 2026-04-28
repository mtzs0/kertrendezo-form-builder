// Shared store for canvas group/sub-group frame rectangles.
// Mirrors canvasPositionsStore.ts: in-memory cache per formId, debounced
// per-frame upserts, pub/sub for hooks.

import { useEffect, useState } from "react";
import {
  deleteCanvasFrame,
  loadCanvasFrames,
  upsertCanvasFrame,
  type FrameKind,
} from "@/form/groupCanvasFramesApi";

export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
  collapsed?: boolean;
}

/** Key shape: `${kind}:${groupId}` so groups and sub-groups can share an id namespace. */
export type FramesMap = Record<string, FrameRect>;

export const frameKey = (kind: FrameKind, id: string) => `${kind}:${id}`;

interface FormState {
  frames: FramesMap;
  loaded: boolean;
  loading?: Promise<void>;
  saveTimers: Map<string, ReturnType<typeof setTimeout>>;
  listeners: Set<() => void>;
}

const states = new Map<string, FormState>();

const keyOf = (formId: string | null | undefined) => formId ?? "__none__";

function getState(formId: string | null | undefined): FormState {
  const k = keyOf(formId);
  let s = states.get(k);
  if (!s) {
    s = { frames: {}, loaded: false, saveTimers: new Map(), listeners: new Set() };
    states.set(k, s);
  }
  return s;
}

const notify = (s: FormState) => s.listeners.forEach((l) => l());

export function getFrames(formId: string | null | undefined): FramesMap {
  return getState(formId).frames;
}

export function ensureFramesLoaded(formId: string | null | undefined): Promise<void> {
  const s = getState(formId);
  if (s.loaded) return Promise.resolve();
  if (s.loading) return s.loading;
  if (!formId) {
    s.loaded = true;
    return Promise.resolve();
  }
  s.loading = (async () => {
    try {
      const rows = await loadCanvasFrames(formId);
      const next: FramesMap = {};
      for (const r of rows) {
        next[frameKey(r.kind, r.group_id)] = {
          x: r.x,
          y: r.y,
          w: r.w,
          h: r.h,
          collapsed: r.collapsed,
        };
      }
      s.frames = next;
      s.loaded = true;
      notify(s);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to load canvas frames", e);
      s.loaded = true;
    } finally {
      s.loading = undefined;
    }
  })();
  return s.loading;
}

const SAVE_DEBOUNCE_MS = 300;

function scheduleSave(
  s: FormState,
  formId: string,
  kind: FrameKind,
  groupId: string
) {
  const key = frameKey(kind, groupId);
  const existing = s.saveTimers.get(key);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    s.saveTimers.delete(key);
    const f = s.frames[key];
    if (!f) return;
    void upsertCanvasFrame({
      form_id: formId,
      group_id: groupId,
      kind,
      x: f.x,
      y: f.y,
      w: f.w,
      h: f.h,
      collapsed: !!f.collapsed,
    }).catch((e) => {
      // eslint-disable-next-line no-console
      console.error("Failed to save canvas frame", e);
    });
  }, SAVE_DEBOUNCE_MS);
  s.saveTimers.set(key, t);
}

export function setFrame(
  formId: string | null | undefined,
  kind: FrameKind,
  groupId: string,
  rect: FrameRect
) {
  const s = getState(formId);
  s.frames = { ...s.frames, [frameKey(kind, groupId)]: rect };
  notify(s);
  if (!formId) return;
  scheduleSave(s, formId, kind, groupId);
}

export function patchFrame(
  formId: string | null | undefined,
  kind: FrameKind,
  groupId: string,
  patch: Partial<FrameRect>
) {
  const s = getState(formId);
  const key = frameKey(kind, groupId);
  const prev = s.frames[key];
  if (!prev) return;
  s.frames = { ...s.frames, [key]: { ...prev, ...patch } };
  notify(s);
  if (!formId) return;
  scheduleSave(s, formId, kind, groupId);
}

export function removeFrame(
  formId: string | null | undefined,
  kind: FrameKind,
  groupId: string
) {
  const s = getState(formId);
  const key = frameKey(kind, groupId);
  if (!s.frames[key]) return;
  const { [key]: _omit, ...rest } = s.frames;
  s.frames = rest;
  const t = s.saveTimers.get(key);
  if (t) {
    clearTimeout(t);
    s.saveTimers.delete(key);
  }
  notify(s);
  if (!formId) return;
  void deleteCanvasFrame(formId, groupId, kind).catch((e) => {
    // eslint-disable-next-line no-console
    console.error("Failed to delete canvas frame", e);
  });
}

export function useGroupFrames(formId: string | null | undefined): FramesMap {
  const [, force] = useState(0);
  useEffect(() => {
    const st = getState(formId);
    const listener = () => force((n) => n + 1);
    st.listeners.add(listener);
    void ensureFramesLoaded(formId).then(() => force((n) => n + 1));
    force((n) => n + 1);
    return () => {
      st.listeners.delete(listener);
    };
  }, [formId]);
  return getState(formId).frames;
}
