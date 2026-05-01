import { supabase } from "@/integrations/supabase/client";
import type { FormField, FormGroup, FormSubGroup } from "./types";
import {
  ensurePositionsLoaded,
  getPositions,
} from "./editor/canvasPositionsStore";
import {
  ensureFramesLoaded,
  getFrames,
  setFrame as setFrameInStore,
  removeFrame as removeFrameInStore,
  frameKey,
} from "./editor/groupFramesStore";
import { upsertManyCanvasPositions, deleteCanvasPosition } from "./canvasPositionsApi";
import type { FrameKind } from "./groupCanvasFramesApi";

// `form_layouts` was added after the last Supabase types regeneration, so we
// access it via an untyped client view to keep TS happy.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as unknown as { from: (table: string) => any };

/**
 * A layout snapshot captures STRUCTURE only:
 * - Group order (group_id -> position)
 * - Sub-group order + which group each belongs to
 * - Field placement: which group/sub-group + position
 *
 * Fields and groups themselves (labels, options, etc.) are NOT captured;
 * they remain shared across layouts and are looked up at apply-time by id.
 *
 * Fields/groups/sub-groups present in the form but missing from the snapshot
 * are sent to "unplaced" (position = 0).
 */
export interface LayoutSnapshot {
  version: 1;
  groups: Array<{ id: string; position: number }>;
  subGroups: Array<{ id: string; groupId: string; position: number }>;
  fields: Array<{
    id: string;
    position: number;
    groupId: string | null;
    subGroupId: string | null;
  }>;
  /** Visual canvas xy + numbering for each placed field. */
  canvasPositions?: Array<{
    fieldId: string;
    x: number;
    y: number;
    order: number | null;
  }>;
  /** Visual canvas frames for groups / sub-groups. */
  canvasFrames?: Array<{
    groupId: string;
    kind: FrameKind;
    x: number;
    y: number;
    w: number;
    h: number;
    collapsed: boolean;
  }>;
}

export interface FormLayout {
  id: string;
  form_id: string;
  name: string;
  snapshot: LayoutSnapshot;
  created_at: string;
  updated_at: string;
}

// Supabase types for form_layouts haven't been regenerated yet — use a loose
// cast to keep this module self-contained.
type LayoutRow = {
  id: string;
  form_id: string;
  name: string;
  snapshot: unknown;
  created_at: string;
  updated_at: string;
};

function rowToLayout(r: LayoutRow): FormLayout {
  return {
    id: r.id,
    form_id: r.form_id,
    name: r.name,
    snapshot: (r.snapshot ?? { version: 1, groups: [], subGroups: [], fields: [] }) as LayoutSnapshot,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function listLayouts(formId: string): Promise<FormLayout[]> {
  const { data, error } = await sb.from("form_layouts")
    .select("*")
    .eq("form_id", formId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data as LayoutRow[]) ?? []).map(rowToLayout);
}

/** Build a snapshot from the current in-memory editor state. */
export function buildSnapshot(
  groups: FormGroup[],
  subGroups: FormSubGroup[],
  fields: FormField[]
): LayoutSnapshot {
  return {
    version: 1,
    groups: groups.map((g) => ({ id: g.id, position: g.location ?? 0 })),
    subGroups: subGroups.map((s) => ({
      id: s.id,
      groupId: s.groupId,
      position: s.location ?? 0,
    })),
    fields: fields.map((f) => ({
      id: f.id,
      position: f.location ?? 0,
      groupId: f.groupId ?? null,
      subGroupId: f.subGroupId ?? null,
    })),
  };
}

export async function createLayout(
  formId: string,
  name: string,
  snapshot: LayoutSnapshot
): Promise<FormLayout> {
  const { data, error } = await sb.from("form_layouts")
    .insert({ form_id: formId, name, snapshot })
    .select("*")
    .single();
  if (error) throw error;
  return rowToLayout(data as LayoutRow);
}

export async function updateLayoutSnapshot(
  layoutId: string,
  snapshot: LayoutSnapshot
): Promise<void> {
  const { error } = await sb.from("form_layouts")
    .update({ snapshot })
    .eq("id", layoutId);
  if (error) throw error;
}

export async function renameLayout(layoutId: string, name: string): Promise<void> {
  const { error } = await sb.from("form_layouts")
    .update({ name })
    .eq("id", layoutId);
  if (error) throw error;
}

export async function deleteLayout(layoutId: string): Promise<void> {
  const { error } = await sb.from("form_layouts")
    .delete()
    .eq("id", layoutId);
  if (error) throw error;
}

// ---------- Active layout pointer (forms.active_layout_id) ----------

/** Returns the currently-active layout id for a form, or null = "Jelenlegi nézet". */
export async function getActiveLayoutId(formId: string): Promise<string | null> {
  const { data, error } = await sb.from("forms")
    .select("active_layout_id")
    .eq("id", formId)
    .maybeSingle();
  if (error) throw error;
  return ((data?.active_layout_id as string | null) ?? null);
}

/** Sets (or clears) the active layout pointer. null = "Jelenlegi nézet". */
export async function setActiveLayoutId(formId: string, layoutId: string | null): Promise<void> {
  const { error } = await sb.from("forms")
    .update({ active_layout_id: layoutId })
    .eq("id", formId);
  if (error) throw error;
}

/**
 * Pure, in-memory transformation: returns new arrays of groups/sub-groups/fields
 * with positions and parent assignments overridden by the snapshot.
 *
 * Items missing from the snapshot are sent to position 0 (unplaced) so they
 * disappear from the rendered structure — same semantics as `applyLayout` but
 * without writing to the DB.
 */
export function applySnapshotToBundle(
  snapshot: LayoutSnapshot,
  groups: FormGroup[],
  subGroups: FormSubGroup[],
  fields: FormField[]
): { groups: FormGroup[]; subGroups: FormSubGroup[]; fields: FormField[] } {
  const snapGroup = new Map(snapshot.groups.map((g) => [g.id, g.position]));
  const snapSub = new Map(
    snapshot.subGroups.map((s) => [s.id, { position: s.position, groupId: s.groupId }])
  );
  const snapField = new Map(
    snapshot.fields.map((f) => [
      f.id,
      { position: f.position, groupId: f.groupId, subGroupId: f.subGroupId },
    ])
  );

  return {
    groups: groups.map((g) => ({ ...g, location: snapGroup.get(g.id) ?? 0 })),
    subGroups: subGroups.map((s) => {
      const snap = snapSub.get(s.id);
      return {
        ...s,
        groupId: snap?.groupId ?? s.groupId,
        location: snap?.position ?? 0,
      };
    }),
    fields: fields.map((f) => {
      const snap = snapField.get(f.id);
      return {
        ...f,
        location: snap?.position ?? 0,
        groupId: snap ? (snap.groupId ?? undefined) : undefined,
        subGroupId: snap ? (snap.subGroupId ?? undefined) : undefined,
      };
    }),
  };
}

/**
 * Apply a snapshot to the current form by writing positions/placements for
 * groups, sub-groups, and fields. Anything not referenced in the snapshot is
 * sent to position 0 (unplaced) so it disappears from the live form.
 */
export async function applyLayout(
  formId: string,
  snapshot: LayoutSnapshot
): Promise<void> {
  // Pull the current set of ids so we can unplace anything not in the snapshot.
  // Sub-groups now live in form_groups (parent_group_id IS NOT NULL).
  const [allGroupsRes, fieldsRes] = await Promise.all([
    sb.from("form_groups").select("id, parent_group_id").eq("form_id", formId),
    supabase.from("form_fields").select("id").eq("form_id", formId),
  ]);
  if (allGroupsRes.error) throw allGroupsRes.error;
  if (fieldsRes.error) throw fieldsRes.error;

  const allGroupRows = (allGroupsRes.data ?? []) as Array<{
    id: string;
    parent_group_id: string | null;
  }>;
  const topLevelGroups = allGroupRows.filter((g) => !g.parent_group_id);
  const subGroupRows = allGroupRows.filter((g) => !!g.parent_group_id);

  const snapGroupPos = new Map(snapshot.groups.map((g) => [g.id, g.position]));
  const snapSubGroup = new Map(
    snapshot.subGroups.map((s) => [s.id, { position: s.position, groupId: s.groupId }])
  );
  const snapField = new Map(
    snapshot.fields.map((f) => [
      f.id,
      { position: f.position, groupId: f.groupId, subGroupId: f.subGroupId },
    ])
  );

  const groupUpdates = topLevelGroups.map((g) => ({
    id: g.id,
    position: snapGroupPos.get(g.id) ?? 0,
  }));

  const subGroupUpdates = subGroupRows.map((s) => {
    const snap = snapSubGroup.get(s.id);
    return {
      id: s.id,
      parent_group_id: snap?.groupId ?? s.parent_group_id,
      position: snap?.position ?? 0,
    };
  });

  const fieldUpdates = (fieldsRes.data ?? []).map((f) => {
    const snap = snapField.get(f.id);
    return {
      id: f.id,
      position: snap?.position ?? 0,
      group_id: snap ? snap.groupId : null,
      sub_group_id: snap ? snap.subGroupId : null,
    };
  });

  await Promise.all([
    ...groupUpdates.map((u) =>
      sb.from("form_groups").update({ position: u.position }).eq("id", u.id)
    ),
    ...subGroupUpdates.map((u) =>
      sb
        .from("form_groups")
        .update({ position: u.position, parent_group_id: u.parent_group_id })
        .eq("id", u.id)
    ),
    ...fieldUpdates.map((u) =>
      supabase
        .from("form_fields")
        .update({
          position: u.position,
          group_id: u.group_id,
          sub_group_id: u.sub_group_id,
        })
        .eq("id", u.id)
    ),
  ]);
}
