// API for the per-group/sub-group rectangular frames drawn on the
// Visual Conditions Canvas (demo).
//
// Backed by `form_group_canvas_frames` — one row per (form_id, group_id, kind)
// with x/y/w/h/collapsed. The store layer (groupFramesStore.ts) handles
// batching and re-renders.

import { supabase } from "@/integrations/supabase/client";

export type FrameKind = "group" | "subgroup";

export interface CanvasFrameRow {
  form_id: string;
  group_id: string;
  kind: FrameKind;
  x: number;
  y: number;
  w: number;
  h: number;
  collapsed: boolean;
}

// Table isn't in the generated Database types yet — wrap in a loose any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbAny = supabase as unknown as { from: (t: string) => any };
const TABLE = "form_group_canvas_frames";

export async function loadCanvasFrames(formId: string): Promise<CanvasFrameRow[]> {
  const { data, error } = await sbAny
    .from(TABLE)
    .select("form_id, group_id, kind, x, y, w, h, collapsed")
    .eq("form_id", formId);
  if (error) throw error;
  return ((data ?? []) as Array<CanvasFrameRow & Record<string, unknown>>).map((r) => ({
    form_id: r.form_id,
    group_id: r.group_id,
    kind: r.kind as FrameKind,
    x: Number(r.x) || 0,
    y: Number(r.y) || 0,
    w: Number(r.w) || 0,
    h: Number(r.h) || 0,
    collapsed: !!r.collapsed,
  }));
}

export async function upsertCanvasFrame(row: CanvasFrameRow): Promise<void> {
  const { error } = await sbAny.from(TABLE).upsert(
    {
      form_id: row.form_id,
      group_id: row.group_id,
      kind: row.kind,
      x: row.x,
      y: row.y,
      w: row.w,
      h: row.h,
      collapsed: row.collapsed,
    },
    { onConflict: "form_id,group_id,kind" }
  );
  if (error) throw error;
}

export async function deleteCanvasFrame(
  formId: string,
  groupId: string,
  kind: FrameKind
): Promise<void> {
  const { error } = await sbAny
    .from(TABLE)
    .delete()
    .eq("form_id", formId)
    .eq("group_id", groupId)
    .eq("kind", kind);
  if (error) throw error;
}
