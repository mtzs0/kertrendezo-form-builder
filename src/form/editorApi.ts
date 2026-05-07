import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type {
  FieldImagePosition,
  FieldOption,
  FieldType,
  FormField,
  FormGroup,
  FormSchema,
  FormSubGroup,
  NotePosition,
  OptionLabelPosition,
  RepeaterField,
  WidthPercent,
} from "./types";

// The generated Database types may not yet contain `width_percent` (added in a
// recent migration). We extend the Row/Insert/Update shapes locally with an
// optional column so the rest of the file stays type-safe without requiring a
// types regeneration.
type WidthCol = { width_percent?: number | null };
type FieldExtraCols = {
  width_percent?: number | null;
  placeholder_image_url?: string | null;
  placeholder_note_value?: string | null;
  placeholder_note_position?: NotePosition | null;
  option_label_position?: OptionLabelPosition | null;
  field_image_position?: FieldImagePosition | null;
  slider_custom_stops?: number[] | { stops: number[]; spacing?: "equal" | "proportional" } | null;
  hide_label?: boolean | null;
  repeater_config?: unknown | null;
};
// `parent_group_id` was added after the last Supabase types regeneration.
type GroupRow = Database["public"]["Tables"]["form_groups"]["Row"] &
  WidthCol & { parent_group_id?: string | null };
// Legacy alias — sub-groups are now just rows in form_groups with parent_group_id set.
// Kept under this name to avoid renaming the rest of the file.
type SubGroupRow = GroupRow & { parent_group_id: string };
type FieldRow = Database["public"]["Tables"]["form_fields"]["Row"] & FieldExtraCols;
type OptionRow = Database["public"]["Tables"]["form_field_options"]["Row"];

// Untyped supabase view — types haven't been regenerated since form_sub_groups was dropped
// and parent_group_id was added.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbAny = supabase as unknown as { from: (t: string) => any };

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
  webhook_url: string | null;
  thank_you_text: string | null;
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
    .select("id, slug, title, description, published, webhook_url, thank_you_text")
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
    .select("id, slug, title, description, published, webhook_url, thank_you_text")
    .single();
  if (insErr) throw insErr;
  return created as EditorForm;
}

/** Update form-level metadata (title, description, webhook_url). */
export async function updateFormMeta(
  id: string,
  patch: Partial<{ title: string; description: string | null; webhook_url: string | null; thank_you_text: string | null }>
) {
  const u: Database["public"]["Tables"]["forms"]["Update"] & { thank_you_text?: string | null } = {};
  if (patch.title !== undefined) u.title = patch.title;
  if (patch.description !== undefined) u.description = patch.description;
  if (patch.webhook_url !== undefined) u.webhook_url = patch.webhook_url;
  if (patch.thank_you_text !== undefined) u.thank_you_text = patch.thank_you_text;
  if (Object.keys(u).length === 0) return;
  const { error } = await supabase.from("forms").update(u).eq("id", id);
  if (error) throw error;
}

export async function loadEditorBundle(formId: string): Promise<Omit<EditorBundle, "form">> {
  const [allGroupsRes, fieldsRes, optionsRes] = await Promise.all([
    sbAny.from("form_groups").select("*").eq("form_id", formId),
    supabase.from("form_fields").select("*").eq("form_id", formId),
    supabase
      .from("form_field_options")
      .select("*, form_fields!inner(form_id)")
      .eq("form_fields.form_id", formId),
  ]);

  if (allGroupsRes.error) throw allGroupsRes.error;
  for (const r of [fieldsRes, optionsRes]) {
    if (r.error) throw r.error;
  }

  const allGroupRows = (allGroupsRes.data ?? []) as Array<
    GroupRow & { condition_combinator?: string | null; condition_rules?: unknown }
  >;

  const rowToCondition = (
    r: { condition_combinator?: string | null; condition_rules?: unknown }
  ): import("./types").ConditionGroup | undefined => {
    const rules = Array.isArray(r.condition_rules) ? r.condition_rules : [];
    if (!rules.length) return undefined;
    const combinator = r.condition_combinator === "or" ? "or" : "and";
    return {
      combinator,
      rules: rules as import("./types").ConditionGroup["rules"],
    };
  };

  // Top-level groups: parent_group_id is null/undefined.
  const groups: FormGroup[] = allGroupRows
    .filter((g) => !g.parent_group_id)
    .map((g) => ({
      id: g.id,
      internalName: g.internal_name,
      label: g.label,
      location: g.position,
      width: asWidth(g.width_percent),
      color: ((g as unknown as { color?: string | null }).color ?? undefined) || undefined,
      condition: rowToCondition(g),
    }));

  // Sub-groups: rows in form_groups that have parent_group_id set.
  const subGroups: FormSubGroup[] = allGroupRows
    .filter((g) => !!g.parent_group_id)
    .map((s) => ({
      id: s.id,
      groupId: s.parent_group_id as string,
      internalName: s.internal_name,
      label: s.label,
      location: s.position,
      width: asWidth(s.width_percent),
      condition: rowToCondition(s),
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
    hideLabel: !!(f as FieldRow & { hide_label?: boolean }).hide_label,
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
    case "label":
      return { ...base, type: "label" };
    case "post_code":
      return { ...base, type: "post_code" };
    case "city":
      return { ...base, type: "city" };
    case "street":
      return { ...base, type: "street" };
    case "email":
      return { ...base, type: "email" };
    case "slider": {
      const stopsRaw = (f as FieldRow & { slider_custom_stops?: unknown }).slider_custom_stops;
      // Backwards-compat: legacy rows store a plain number[]; new rows may store
      // { stops: number[], spacing: "equal" | "proportional" }.
      let customStops: number[] | undefined;
      let customStopsSpacing: "equal" | "proportional" | undefined;
      if (Array.isArray(stopsRaw)) {
        customStops = (stopsRaw as unknown[]).map((n) => Number(n)).filter((n) => Number.isFinite(n));
      } else if (stopsRaw && typeof stopsRaw === "object") {
        const obj = stopsRaw as { stops?: unknown; spacing?: unknown };
        if (Array.isArray(obj.stops)) {
          customStops = (obj.stops as unknown[]).map((n) => Number(n)).filter((n) => Number.isFinite(n));
        }
        if (obj.spacing === "equal" || obj.spacing === "proportional") {
          customStopsSpacing = obj.spacing;
        }
      }
      return {
        ...base,
        type: "slider",
        min: Number(f.slider_min ?? 0),
        max: Number(f.slider_max ?? 100),
        step: f.slider_step != null ? Number(f.slider_step) : undefined,
        unit: f.slider_unit ?? undefined,
        customStops: customStops && customStops.length ? customStops : undefined,
        customStopsSpacing,
      };
    }
    case "radio":
    case "checkbox":
    case "select":
      return {
        ...base,
        type: f.type,
        columns: f.columns ?? 1,
        useImages: f.use_images,
        uniqueNotePerOption: f.unique_note_per_option,
        optionLabelPosition: (f.option_label_position ?? undefined) as OptionLabelPosition | undefined,
        fieldImagePosition: (f.field_image_position ?? undefined) as FieldImagePosition | undefined,
        placeholderImageUrl: f.placeholder_image_url ?? undefined,
        placeholderNote:
          f.placeholder_note_value && f.placeholder_note_position
            ? { value: f.placeholder_note_value, position: f.placeholder_note_position as NotePosition }
            : undefined,
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
    case "measurement":
      return {
        ...base,
        type: "measurement",
        options: opts
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((o) => ({
            displayName: o.display_name,
            dataName: o.data_name,
          })),
      };
    case "repeater": {
      const cfg = ((f as FieldRow & { repeater_config?: unknown }).repeater_config ?? null) as
        | (Partial<RepeaterField> & { children?: FormField[] })
        | null;
      return {
        ...base,
        type: "repeater",
        itemLabel: cfg?.itemLabel,
        addButtonLabel: cfg?.addButtonLabel,
        minInstances: cfg?.minInstances,
        maxInstances: cfg?.maxInstances,
        titleChildId: cfg?.titleChildId,
        children: Array.isArray(cfg?.children) ? (cfg!.children as FormField[]) : [],
      };
    }
  }
}

// ---------- Mutations ----------

export async function createGroup(formId: string, position: number) {
  const { data, error } = await sbAny
    .from("form_groups")
    .insert({ form_id: formId, internal_name: "uj_csoport", label: "Új csoport", position })
    .select("*")
    .single();
  if (error) throw error;
  return data as GroupRow;
}

export async function updateGroup(
  id: string,
  patch: Partial<{
    internalName: string;
    label: string;
    position: number;
    width: WidthPercent | null;
    /** Set/clear the parent group (null = make top-level, string = nest under that group). */
    parentGroupId: string | null;
    /** Hex color (or null to clear) used by the visual canvas frame. */
    color: string | null;
  }>
) {
  const u: Record<string, unknown> = {};
  if (patch.internalName !== undefined) u.internal_name = patch.internalName;
  if (patch.label !== undefined) u.label = patch.label;
  if (patch.position !== undefined) u.position = patch.position;
  if (patch.width !== undefined) u.width_percent = patch.width;
  if (patch.parentGroupId !== undefined) u.parent_group_id = patch.parentGroupId;
  if (patch.color !== undefined) u.color = patch.color;
  if (Object.keys(u).length === 0) return;
  const { error } = await sbAny.from("form_groups").update(u).eq("id", id);
  if (error) throw error;
}

export async function deleteGroup(id: string) {
  const { error } = await supabase.from("form_groups").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Sub-groups are now stored as rows in `form_groups` with `parent_group_id` set.
 * Creating a sub-group = inserting a group row with parent_group_id = groupId.
 */
export async function createSubGroup(formId: string, groupId: string, position: number) {
  const { data, error } = await sbAny
    .from("form_groups")
    .insert({
      form_id: formId,
      parent_group_id: groupId,
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
  patch: Partial<{ internalName: string; label: string; position: number; width: WidthPercent | null; groupId: string }>
) {
  const u: Record<string, unknown> = {};
  if (patch.internalName !== undefined) u.internal_name = patch.internalName;
  if (patch.label !== undefined) u.label = patch.label;
  if (patch.position !== undefined) u.position = patch.position;
  if (patch.width !== undefined) u.width_percent = patch.width;
  if (patch.groupId !== undefined) u.parent_group_id = patch.groupId;
  if (Object.keys(u).length === 0) return;
  const { error } = await sbAny.from("form_groups").update(u).eq("id", id);
  if (error) throw error;
}

export async function deleteSubGroup(id: string) {
  const { error } = await supabase.from("form_groups").delete().eq("id", id);
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
  if (type === "repeater") {
    (insert as Record<string, unknown>).repeater_config = { children: [] };
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
  /** Manual stops between min/max. null = clear, undefined = no change. */
  sliderCustomStops?: number[] | null;
  /** Visual spacing of custom stops. undefined = no change. */
  sliderCustomStopsSpacing?: "equal" | "proportional" | null;
  withTime?: boolean;
  multipleImages?: boolean;
  useImages?: boolean;
  uniqueNotePerOption?: boolean;
  columns?: number;
  width?: WidthPercent | null;
  optionLabelPosition?: OptionLabelPosition | null;
  fieldImagePosition?: FieldImagePosition | null;
  placeholderImageUrl?: string | null;
  placeholderNoteValue?: string | null;
  placeholderNotePosition?: NotePosition | null;
  hideLabel?: boolean;
  /**
   * Full repeater config blob (children + settings) — written verbatim to the
   * `repeater_config` JSONB column. `null` clears the column.
   */
  repeaterConfig?: Record<string, unknown> | null;
}

export async function updateField(id: string, patch: FieldPatch) {
  const u: Database["public"]["Tables"]["form_fields"]["Update"] & FieldExtraCols = {
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
  if (patch.optionLabelPosition !== undefined) u.option_label_position = patch.optionLabelPosition;
  if (patch.fieldImagePosition !== undefined) u.field_image_position = patch.fieldImagePosition;
  if (patch.placeholderImageUrl !== undefined) u.placeholder_image_url = patch.placeholderImageUrl;
  if (patch.placeholderNoteValue !== undefined) u.placeholder_note_value = patch.placeholderNoteValue;
  if (patch.placeholderNotePosition !== undefined) u.placeholder_note_position = patch.placeholderNotePosition;
  if (patch.hideLabel !== undefined) u.hide_label = patch.hideLabel;
  if (patch.repeaterConfig !== undefined) (u as Record<string, unknown>).repeater_config = patch.repeaterConfig;
  if (patch.sliderCustomStops !== undefined || patch.sliderCustomStopsSpacing !== undefined) {
    // We piggyback the spacing onto the JSONB column. If clearing stops, write null.
    if (patch.sliderCustomStops === null) {
      u.slider_custom_stops = null;
    } else {
      // Need both pieces — fetch existing if only one provided.
      const stops = patch.sliderCustomStops;
      const spacing = patch.sliderCustomStopsSpacing;
      // Read current row to merge missing piece, but only when one of them is undefined.
      if (stops === undefined || spacing === undefined) {
        const { data: cur } = await supabase
          .from("form_fields")
          .select("slider_custom_stops")
          .eq("id", id)
          .maybeSingle();
        const raw = cur?.slider_custom_stops as unknown;
        let curStops: number[] = [];
        let curSpacing: "equal" | "proportional" | undefined;
        if (Array.isArray(raw)) curStops = (raw as unknown[]).map(Number).filter(Number.isFinite);
        else if (raw && typeof raw === "object") {
          const o = raw as { stops?: unknown; spacing?: unknown };
          if (Array.isArray(o.stops)) curStops = (o.stops as unknown[]).map(Number).filter(Number.isFinite);
          if (o.spacing === "equal" || o.spacing === "proportional") curSpacing = o.spacing;
        }
        const finalStops = stops === undefined ? curStops : stops;
        const finalSpacing = spacing === undefined ? curSpacing : spacing ?? undefined;
        u.slider_custom_stops = finalStops.length
          ? { stops: finalStops, spacing: finalSpacing ?? "equal" }
          : null;
      } else {
        u.slider_custom_stops = stops.length
          ? { stops, spacing: spacing ?? "equal" }
          : null;
      }
    }
  }
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

/**
 * Duplicate a field row (and its options + condition) at the DB level.
 * The new row gets a fresh `id`, an incremented `internal_name` and
 * `position` set to old+1 (callers can pass anything via `position`).
 * Returns the new row's id.
 */
export async function duplicateFieldRow(
  fieldId: string,
  newInternalName: string,
  position: number
): Promise<string> {
  // 1) Read the original row.
  const { data: orig, error: selErr } = await supabase
    .from("form_fields")
    .select("*")
    .eq("id", fieldId)
    .single();
  if (selErr) throw selErr;
  if (!orig) throw new Error("Field not found");

  // 2) Insert a clone (omit `id`, set new internal_name + position).
  const insertRow: Record<string, unknown> = { ...(orig as Record<string, unknown>) };
  delete insertRow.id;
  delete insertRow.created_at;
  delete insertRow.updated_at;
  insertRow.internal_name = newInternalName;
  insertRow.position = position;
  const { data: created, error: insErr } = await supabase
    .from("form_fields")
    .insert(insertRow as Database["public"]["Tables"]["form_fields"]["Insert"])
    .select("id")
    .single();
  if (insErr) throw insErr;
  const newId = (created as { id: string }).id;

  // 3) Clone options.
  const { data: opts, error: optErr } = await supabase
    .from("form_field_options")
    .select("*")
    .eq("field_id", fieldId);
  if (optErr) throw optErr;
  if (opts && opts.length) {
    const optRows = (opts as OptionRow[]).map((o) => {
      const r: Record<string, unknown> = { ...o };
      delete r.id;
      delete r.created_at;
      delete r.updated_at;
      r.field_id = newId;
      return r;
    });
    const { error: optInsErr } = await supabase
      .from("form_field_options")
      .insert(optRows as Database["public"]["Tables"]["form_field_options"]["Insert"][]);
    if (optInsErr) throw optInsErr;
  }

  // 4) Clone condition (if any). Stored in form_field_conditions (one row / field).
  const { data: condRow } = await supabase
    .from("form_field_conditions")
    .select("combinator, rules")
    .eq("field_id", fieldId)
    .maybeSingle();
  if (condRow) {
    const c = condRow as { combinator: string; rules: unknown };
    await supabase.from("form_field_conditions").insert({
      field_id: newId,
      combinator: c.combinator,
      rules: c.rules as Database["public"]["Tables"]["form_field_conditions"]["Insert"]["rules"],
    });
  }

  return newId;
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

export async function setSubGroupPositions(
  updates: Array<{ id: string; position: number; groupId?: string }>
) {
  await Promise.all(
    updates.map((u) => {
      const patch: Record<string, unknown> = { position: u.position };
      if (u.groupId !== undefined) patch.parent_group_id = u.groupId;
      return sbAny.from("form_groups").update(patch).eq("id", u.id);
    })
  );
}

// ---------- Field options ----------

/** Replace the full set of options for a field. */
export async function replaceFieldOptions(fieldId: string, options: FieldOption[]) {
  const { error: delErr } = await supabase
    .from("form_field_options")
    .delete()
    .eq("field_id", fieldId);
  if (delErr) throw delErr;
  if (!options.length) return;
  const rows = options.map((o, idx) => ({
    field_id: fieldId,
    display_name: o.displayName,
    data_name: o.dataName,
    position: idx + 1,
    image_url: o.imageUrl ?? null,
    note_value: o.note?.value ?? null,
    note_position: o.note?.position ?? null,
  }));
  const { error: insErr } = await supabase.from("form_field_options").insert(rows);
  if (insErr) throw insErr;
}

/** Upload an image to the public option-images bucket and return its public URL. */
export async function uploadOptionImage(
  file: File,
  opts: { fieldId: string; key: string }
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${opts.fieldId}/${opts.key}-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("form-option-images")
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from("form-option-images").getPublicUrl(path);
  return data.publicUrl;
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

/**
 * Save (or clear) the display condition for a group / sub-group. Both kinds
 * of rows live in the `form_groups` table, so this is a single-row update.
 * Passing `undefined` (or an empty rules array) clears the condition.
 */
export async function saveGroupCondition(
  groupId: string,
  condition: import("./types").ConditionGroup | undefined
) {
  const u: Record<string, unknown> = {};
  if (!condition || !condition.rules.length) {
    u.condition_combinator = "and";
    u.condition_rules = [];
  } else {
    u.condition_combinator = condition.combinator;
    u.condition_rules = condition.rules;
  }
  const { error } = await sbAny.from("form_groups").update(u).eq("id", groupId);
  if (error) throw error;
}
