// API for the per-field canvas positions on the Visual Conditions Canvas (demo).
//
// Backed by the `form_field_canvas_positions` table — one row per field with
// x / y / order_index. We expose a tiny load + upsert + delete surface; the
// store layer (canvasPositionsStore.ts) handles batching and re-renders.

import { supabase } from "@/integrations/supabase/client";

export interface CanvasPositionRow {
  field_id: string;
  x: number;
  y: number;
  order_index: number | null;
}

// The table isn't in the generated Database types yet — wrap in a loose any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbAny = supabase as unknown as { from: (t: string) => any };
const TABLE = "form_field_canvas_positions";

/**
 * Load all positions for the fields belonging to a given form.
 * We filter via a join on form_fields(form_id) so callers don't have to
 * pass the field id list themselves.
 */
export async function loadCanvasPositions(formId: string): Promise<CanvasPositionRow[]> {
  const { data, error } = await sbAny
    .from(TABLE)
    .select("field_id, x, y, order_index, form_fields!inner(form_id)")
    .eq("form_fields.form_id", formId);
  if (error) throw error;
  return ((data ?? []) as Array<CanvasPositionRow & Record<string, unknown>>).map((r) => ({
    field_id: r.field_id,
    x: Number(r.x) || 0,
    y: Number(r.y) || 0,
    order_index: r.order_index == null ? null : Number(r.order_index),
  }));
}

/**
 * Upsert a single field's position. Uses the primary key (field_id) so
 * repeated saves overwrite the existing row.
 */
export async function upsertCanvasPosition(row: CanvasPositionRow): Promise<void> {
  const { error } = await sbAny.from(TABLE).upsert(
    {
      field_id: row.field_id,
      x: row.x,
      y: row.y,
      order_index: row.order_index,
    },
    { onConflict: "field_id" }
  );
  if (error) throw error;
}

/** Bulk upsert (used when the user clears the canvas → many deletes, etc.). */
export async function upsertManyCanvasPositions(rows: CanvasPositionRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await sbAny.from(TABLE).upsert(
    rows.map((r) => ({
      field_id: r.field_id,
      x: r.x,
      y: r.y,
      order_index: r.order_index,
    })),
    { onConflict: "field_id" }
  );
  if (error) throw error;
}

/** Remove a single field from the canvas. */
export async function deleteCanvasPosition(fieldId: string): Promise<void> {
  const { error } = await sbAny.from(TABLE).delete().eq("field_id", fieldId);
  if (error) throw error;
}

/** Remove every position for the given form (clears the canvas). */
export async function deleteAllCanvasPositionsForForm(formId: string): Promise<void> {
  // Fetch the field ids that have positions, then delete those rows. We do
  // this in two queries because a delete with an inner join isn't supported
  // by PostgREST.
  const rows = await loadCanvasPositions(formId);
  if (rows.length === 0) return;
  const ids = rows.map((r) => r.field_id);
  const { error } = await sbAny.from(TABLE).delete().in("field_id", ids);
  if (error) throw error;
}
