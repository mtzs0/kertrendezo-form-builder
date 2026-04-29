// Pub/sub store for the "reveal fields one-by-one" toggle on the
// Vizuális feltételek (demo) canvas.
//
// Persisted per form via the `forms.canvas_reveal_one_by_one` column in
// Supabase. The toggle is loaded lazily on first read and writes are
// debounced. While the value is loading, the default (true) is shown.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbAny = supabase as unknown as { from: (t: string) => any };

type Listener = () => void;

interface FormState {
  value: boolean;
  loaded: boolean;
  loading?: Promise<void>;
  saveTimer?: ReturnType<typeof setTimeout>;
  listeners: Set<Listener>;
}

const states = new Map<string, FormState>();

const keyOf = (formId: string | null | undefined) => formId ?? "__none__";

function getState(formId: string | null | undefined): FormState {
  const k = keyOf(formId);
  let s = states.get(k);
  if (!s) {
    s = { value: true, loaded: false, listeners: new Set() };
    states.set(k, s);
  }
  return s;
}

const notify = (s: FormState) => s.listeners.forEach((l) => l());

function ensureLoaded(formId: string | null | undefined): Promise<void> {
  const s = getState(formId);
  if (s.loaded) return Promise.resolve();
  if (s.loading) return s.loading;
  if (!formId) {
    s.loaded = true;
    return Promise.resolve();
  }
  s.loading = (async () => {
    try {
      const { data, error } = await sbAny
        .from("forms")
        .select("canvas_reveal_one_by_one")
        .eq("id", formId)
        .maybeSingle();
      if (error) throw error;
      if (data && typeof data.canvas_reveal_one_by_one === "boolean") {
        s.value = data.canvas_reveal_one_by_one;
      }
      s.loaded = true;
      notify(s);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to load reveal-mode toggle", e);
      s.loaded = true;
    } finally {
      s.loading = undefined;
    }
  })();
  return s.loading;
}

const SAVE_DEBOUNCE_MS = 300;

function scheduleSave(s: FormState, formId: string) {
  if (s.saveTimer) clearTimeout(s.saveTimer);
  s.saveTimer = setTimeout(async () => {
    s.saveTimer = undefined;
    try {
      const { error } = await sbAny
        .from("forms")
        .update({ canvas_reveal_one_by_one: s.value })
        .eq("id", formId);
      if (error) throw error;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to save reveal-mode toggle", e);
    }
  }, SAVE_DEBOUNCE_MS);
}

export function setRevealOneByOne(
  formId: string | null | undefined,
  value: boolean
) {
  const s = getState(formId);
  s.value = value;
  s.loaded = true;
  notify(s);
  if (formId) scheduleSave(s, formId);
}

export function useRevealOneByOne(
  formId: string | null | undefined
): [boolean, (v: boolean) => void] {
  const [, force] = useState(0);
  useEffect(() => {
    const st = getState(formId);
    const l = () => force((n) => n + 1);
    st.listeners.add(l);
    void ensureLoaded(formId).then(() => force((n) => n + 1));
    return () => {
      st.listeners.delete(l);
    };
  }, [formId]);
  return [getState(formId).value, (v: boolean) => setRevealOneByOne(formId, v)];
}
