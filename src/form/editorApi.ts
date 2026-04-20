import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type {
  FieldType,
  FormField,
  FormGroup,
  FormSchema,
  FormSubGroup,
  NotePosition,
  WidthPercent,
} from "./types";

// The generated Database types may not yet contain `width_percent` (added in a
// recent migration). We extend the Row/Insert/Update shapes locally with an
// optional column so the rest of the file stays type-safe without requiring a
// types regeneration.
type WidthCol = { width_percent?: number | null };
type GroupRow = Database["public"]["Tables"]["form_groups"]["Row"] & WidthCol;
type SubGroupRow = Database["public"]["Tables"]["form_sub_groups"]["Row"] & WidthCol;
type FieldRow = Database["public"]["Tables"]["form_fields"]["Row"] & WidthCol;
type OptionRow = Database["public"]["Tables"]["form_field_options"]["Row"];

function asWidth(v: number | null | undefined): WidthPercent | undefined {
  if (v == null) return undefined;
  if (v === 25 || v === 33 || v === 40 || v === 50 || v === 60 || v === 100) return v;
  return undefined;
}

export interface EditorForm {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  published: boolean;
}

export interface EditorBundle {
  form: EditorForm;
  groups: FormGroup[];
  subGroups: FormSubGroup[];
  fields: FormField[];
}

/**
 * Find or create the form row identified by slug. Returns the form id.
 * The first time this runs in a fresh DB it will create the row.
 */
export async function ensureForm(slug: string, defaults: { title: string; description?: string }): Promise<EditorForm> {
  const { data: existing, error: selErr } = await supabase
    .from("forms")
    .select("id, slug, title, description, published")
    .eq("slug", slug)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing as EditorForm;

  const { data: created, error: insErr } = await supabase
    .from("forms")
    .insert({
      slug,
      title: defaults.title,
      description: defaults.description ?? null,
      schema: { fields: [], groups: [], subGroups: [] },
      published: true,
    })
    .select("id, slug, title, description, published")
    .single();
  if (insErr) throw insErr;
  return created as EditorForm;
}

/** Update form-level metadata (title, description). */
export async function updateFormMeta(
  id: string,
  patch: Partial<{ title: string; description: string | null }>
) {
  const u: Database["public"]["Tables"]["forms"]["Update"] = {};
  if (patch.title !== undefined) u.title = patch.title;
  if (patch.description !== undefined) u.description = patch.description;
  if (Object.keys(u).length === 0) return;
  const { error } = await supabase.from("forms").update(u).eq("id", id);
  if (error) throw error;
}

export async function loadEditorBundle(formId: string): Promise<Omit<EditorBundle, "form">> {
  const [groupsRes, subGroupsRes, fieldsRes, optionsRes] = await Promise.all([
    supabase.from("form_groups").select("*").eq("form_id", formId),
    supabase.from("form_sub_groups").select("*").eq("form_id", formId),
    supabase.from("form_fields").select("*").eq("form_id", formId),
    supabase
      .from("form_field_options")
      .select("*, form_fields!inner(form_id)")
      .eq("form_fields.form_id", formId),
  ]);

  for (const r of [groupsRes, subGroupsRes, fieldsRes, optionsRes]) {
    if (r.error) throw r.error;
  }

  const groups: FormGroup[] = (groupsRes.data ?? []).map((g: GroupRow) => ({
    id: g.id,
    internalName: g.internal_name,
    label: g.label,
    location: g.position,
    width: asWidth(g.width_percent),
  }));

  const subGroups: FormSubGroup[] = (subGroupsRes.data ?? []).map((s: SubGroupRow) => ({
    id: s.id,
    groupId: s.group_id,
    internalName: s.internal_name,
    label: s.label,
    location: s.position,
    width: asWidth(s.width_percent),
  }));

  const optionsByField = new Map<string, OptionRow[]>();
  for (const o of (optionsRes.data ?? []) as unknown as OptionRow[]) {
    const arr = optionsByField.get(o.field_id) ?? [];
    arr.push(o);
    optionsByField.set(o.field_id, arr);
  }

  const fields: FormField[] = (fieldsRes.data ?? []).map((f: FieldRow) => rowToField(f, optionsByField.get(f.id) ?? []));

  return { groups, subGroups, fields };
}

function rowToField(f: FieldRow, opts: OptionRow[]): FormField {
  const base = {
    id: f.id,
    internalName: f.internal_name,
    label: f.label,
    placeholder: f.placeholder ?? undefined,
    required: f.required,
    note:
      f.note_value && f.note_position
        ? { value: f.note_value, position: f.note_position as NotePosition }
        : undefined,
    location: f.position,
    groupId: f.group_id ?? undefined,
    subGroupId: f.sub_group_id ?? undefined,
    width: asWidth(f.width_percent),
  };

  switch (f.type) {
    case "text":
      return { ...base, type: "text" };
    case "textarea":
      return { ...base, type: "textarea" };
    case "phone":
      return { ...base, type: "phone" };
    case "date":
      return { ...base, type: "date", withTime: f.with_time };
    case "image":
      return { ...base, type: "image", multiple: f.multiple_images };
    case "slider":
      return {
        ...base,
        type: "slider",
        min: Number(f.slider_min ?? 0),
        max: Number(f.slider_max ?? 100),
        step: f.slider_step != null ? Number(f.slider_step) : undefined,
        unit: f.slider_unit ?? undefined,
      };
    case "radio":
    case "checkbox":
    case "select":
      return {
        ...base,
        type: f.type,
        columns: f.columns ?? 1,
        useImages: f.use_images,
        uniqueNotePerOption: f.unique_note_per_option,
        options: opts
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((o) => ({
            displayName: o.display_name,
            dataName: o.data_name,
            note:
              o.note_value && o.note_position
                ? { value: o.note_value, position: o.note_position as NotePosition }
                : undefined,
            imageUrl: o.image_url ?? undefined,
          })),
      };
  }
}

// ---------- Mutations ----------

export async function createGroup(formId: string, position: number) {
  const { data, error } = await supabase
    .from("form_groups")
    .insert({ form_id: formId, internal_name: "uj_csoport", label: "Új csoport", position })
    .select("*")
    .single();
  if (error) throw error;
  return data as GroupRow;
}

export async function updateGroup(
  id: string,
  patch: Partial<{ internalName: string; label: string; position: number; width: WidthPercent | null }>
) {
  const u: Database["public"]["Tables"]["form_groups"]["Update"] & WidthCol = {
    internal_name: patch.internalName,
    label: patch.label,
    position: patch.position,
  };
  if (patch.width !== undefined) u.width_percent = patch.width;
  const { error } = await supabase.from("form_groups").update(u).eq("id", id);
  if (error) throw error;
}

export async function deleteGroup(id: string) {
  const { error } = await supabase.from("form_groups").delete().eq("id", id);
  if (error) throw error;
}

export async function createSubGroup(formId: string, groupId: string, position: number) {
  const { data, error } = await supabase
    .from("form_sub_groups")
    .insert({
      form_id: formId,
      group_id: groupId,
      internal_name: "uj_alcsoport",
      label: "Új al-csoport",
      position,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as SubGroupRow;
}

export async function updateSubGroup(
  id: string,
  patch: Partial<{ internalName: string; label: string; position: number; width: WidthPercent | null }>
) {
  const u: Database["public"]["Tables"]["form_sub_groups"]["Update"] & WidthCol = {
    internal_name: patch.internalName,
    label: patch.label,
    position: patch.position,
  };
  if (patch.width !== undefined) u.width_percent = patch.width;
  const { error } = await supabase.from("form_sub_groups").update(u).eq("id", id);
  if (error) throw error;
}

export async function deleteSubGroup(id: string) {
  const { error } = await supabase.from("form_sub_groups").delete().eq("id", id);
  if (error) throw error;
}

export async function createField(
  formId: string,
  type: FieldType,
  position: number,
  groupId?: string,
  subGroupId?: string
) {
  const insert: Database["public"]["Tables"]["form_fields"]["Insert"] = {
    form_id: formId,
    type,
    internal_name: "uj_mezo",
    label: "Új mező",
    position,
    group_id: groupId ?? null,
    sub_group_id: subGroupId ?? null,
  };
  if (type === "slider") {
    insert.slider_min = 0;
    insert.slider_max = 100;
    insert.slider_step = 1;
  }
  const { data, error } = await supabase.from("form_fields").insert(insert).select("*").single();
  if (error) throw error;
  return data as FieldRow;
}

export interface FieldPatch {
  internalName?: string;
  label?: string;
  placeholder?: string | null;
  required?: boolean;
  type?: FieldType;
  position?: number;
  groupId?: string | null;
  subGroupId?: string | null;
  noteValue?: string | null;
  notePosition?: NotePosition | null;
  sliderMin?: number | null;
  sliderMax?: number | null;
  sliderStep?: number | null;
  sliderUnit?: string | null;
  withTime?: boolean;
  multipleImages?: boolean;
  useImages?: boolean;
  uniqueNotePerOption?: boolean;
  columns?: number;
  width?: WidthPercent | null;
}

export async function updateField(id: string, patch: FieldPatch) {
  const u: Database["public"]["Tables"]["form_fields"]["Update"] & WidthCol = {
    internal_name: patch.internalName,
    label: patch.label,
    placeholder: patch.placeholder,
    required: patch.required,
    type: patch.type,
    position: patch.position,
    group_id: patch.groupId,
    sub_group_id: patch.subGroupId,
    note_value: patch.noteValue,
    note_position: patch.notePosition,
    slider_min: patch.sliderMin,
    slider_max: patch.sliderMax,
    slider_step: patch.sliderStep,
    slider_unit: patch.sliderUnit,
    with_time: patch.withTime,
    multiple_images: patch.multipleImages,
    use_images: patch.useImages,
    unique_note_per_option: patch.uniqueNotePerOption,
    columns: patch.columns,
  };
  if (patch.width !== undefined) u.width_percent = patch.width;
  // Strip undefined keys so we don't blow away unrelated columns.
  Object.keys(u).forEach((k) => {
    if ((u as Record<string, unknown>)[k] === undefined) delete (u as Record<string, unknown>)[k];
  });
  const { error } = await supabase.from("form_fields").update(u).eq("id", id);
  if (error) throw error;
}

export async function deleteField(id: string) {
  const { error } = await supabase.from("form_fields").delete().eq("id", id);
  if (error) throw error;
}

/** Bulk position update — used by drag-and-drop reorder. */
export async function setFieldPositions(
  updates: Array<{ id: string; position: number; groupId?: string | null; subGroupId?: string | null }>
) {
  // Run in parallel — small list, simple updates.
  await Promise.all(
    updates.map((u) =>
      supabase
        .from("form_fields")
        .update({
          position: u.position,
          ...(u.groupId !== undefined ? { group_id: u.groupId } : {}),
          ...(u.subGroupId !== undefined ? { sub_group_id: u.subGroupId } : {}),
        })
        .eq("id", u.id)
    )
  );
}

export async function setGroupPositions(updates: Array<{ id: string; position: number }>) {
  await Promise.all(
    updates.map((u) => supabase.from("form_groups").update({ position: u.position }).eq("id", u.id))
  );
}

export async function setSubGroupPositions(updates: Array<{ id: string; position: number }>) {
  await Promise.all(
    updates.map((u) =>
      supabase.from("form_sub_groups").update({ position: u.position }).eq("id", u.id)
    )
  );
}

/** Build a FormSchema from the editor bundle so the existing renderer can preview it. */
export function bundleToSchema(form: EditorForm, bundle: Omit<EditorBundle, "form">): FormSchema {
  return {
    title: form.title,
    description: form.description ?? undefined,
    groups: bundle.groups,
    subGroups: bundle.subGroups,
    fields: bundle.fields,
  };
}
