import { useCallback, useEffect, useRef, useState } from "react";
import {
  bundleToSchema,
  createField,
  createGroup,
  createSubGroup,
  deleteField,
  duplicateFieldRow,
  deleteGroup,
  deleteSubGroup,
  ensureForm,
  loadEditorBundle,
  replaceFieldOptions,
  setFieldPositions,
  setGroupPositions,
  setSubGroupPositions,
  updateField,
  updateFormMeta,
  updateGroup,
  updateSubGroup,
  type EditorBundle,
  type EditorForm,
  type FieldPatch,
} from "./editorApi";
import { loadConditions, saveFieldCondition } from "./conditionApi";
import { saveGroupCondition } from "./editorApi";
import {
  applySnapshotToBundle,
  getActiveLayoutId,
  setActiveLayoutId as apiSetActiveLayoutId,
  type LayoutSnapshot,
} from "./layoutsApi";
import { supabase } from "@/integrations/supabase/client";
import type {
  ConditionGroup,
  FieldOption,
  FieldType,
  FormField,
  FormGroup,
  FormSchema,
  FormSubGroup,
  VisualBackground,
} from "./types";

type FormMetaInput = Partial<{
  title: string;
  description: string | null;
  webhook_url: string | null;
  test_webhook_url: string | null;
  thank_you_text: string | null;
  output_url: string | null;
  include_device_type: boolean;
  include_browser: boolean;
  include_page_url: boolean;
  buttonBackground: VisualBackground | undefined;
  tabsBackground: VisualBackground | undefined;
}>;

type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface UseEditorSchemaResult {
  loading: boolean;
  error: string | null;
  form: EditorForm | null;
  groups: FormGroup[];
  subGroups: FormSubGroup[];
  fields: FormField[];
  /** Schema view of the in-memory state — for preview rendering. */
  schema: FormSchema;
  /** Schema view with the active saved layout applied (or === schema when none). */
  previewSchema: FormSchema;
  /** Currently-active saved layout id, or null = "Jelenlegi nézet". */
  activeLayoutId: string | null;
  /** Set the active layout (null = use current editor state). */
  setActiveLayout: (layoutId: string | null) => Promise<void>;
  saveStatus: SaveStatus;

  /** Re-fetch all editor data from the DB (e.g. after applying a saved layout). */
  reload: () => Promise<void>;

  // Form meta ops
  patchForm: (patch: FormMetaInput) => void;

  // Group ops
  addGroup: () => Promise<string | undefined>;
  patchGroup: (id: string, patch: Partial<FormGroup>) => void;
  removeGroup: (id: string) => Promise<void>;
  reorderGroups: (orderedIds: string[]) => Promise<void>;
  /** Re-parent a group: pass a parent id to demote it to a sub-group, or null to promote it back to top-level. */
  nestGroup: (id: string, parentGroupId: string | null, location?: number) => Promise<void>;

  // Sub-group ops
  addSubGroup: (groupId: string) => Promise<string | undefined>;
  patchSubGroup: (id: string, patch: Partial<FormSubGroup>) => void;
  removeSubGroup: (id: string) => Promise<void>;
  reorderSubGroups: (groupId: string, orderedIds: string[]) => Promise<void>;

  // Field ops
  addField: (type: FieldType, opts?: { groupId?: string; subGroupId?: string }) => Promise<string>;
  /** Duplicate an existing field (including options + condition). Returns the new field id. */
  duplicateField: (id: string) => Promise<string | undefined>;
  patchField: (id: string, patch: Partial<FormField> & { type?: FieldType }) => void;
  removeField: (id: string) => Promise<void>;
  reorderFields: (
    container: { groupId?: string | null; subGroupId?: string | null },
    orderedIds: string[]
  ) => Promise<void>;
  /** Replace the full set of options for an option-type field (immediate save). */
  setFieldOptions: (fieldId: string, options: FieldOption[]) => Promise<void>;
  /** Save a field's display condition (or remove it when undefined). */
  setFieldCondition: (fieldId: string, condition: ConditionGroup | undefined) => Promise<void>;
  /** Save a group's (or sub-group's) display condition (or remove it when undefined). */
  setGroupCondition: (groupId: string, condition: ConditionGroup | undefined) => Promise<void>;
}

/**
 * Loads the editor state for the given form slug, exposing a schema view and
 * mutation helpers. All field/group/sub-group edits are debounced (~500ms)
 * and saved to Supabase automatically.
 */
export function useEditorSchema(slug: string, defaults: { title: string; description?: string }): UseEditorSchemaResult {
  const [form, setForm] = useState<EditorForm | null>(null);
  const [bundle, setBundle] = useState<Omit<EditorBundle, "form"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [activeLayoutId, setActiveLayoutIdState] = useState<string | null>(null);
  const [activeSnapshot, setActiveSnapshot] = useState<LayoutSnapshot | null>(null);

  // Debounced patch buffers, keyed by row id.
  const fieldPatchBuf = useRef<Map<string, FieldPatch>>(new Map());
  const groupPatchBuf = useRef<Map<string, Partial<FormGroup>>>(new Map());
  const subGroupPatchBuf = useRef<Map<string, Partial<FormSubGroup>>>(new Map());
  const formPatchBuf = useRef<FormMetaInput>({});
  const flushTimer = useRef<number | null>(null);

  // ---------- Load ----------
  const loadAll = useCallback(
    async (signal?: { cancelled: boolean }) => {
      setLoading(true);
      try {
        const f = await ensureForm(slug, defaults);
        const [b, conditions, activeId] = await Promise.all([
          loadEditorBundle(f.id),
          loadConditions(f.id),
          getActiveLayoutId(f.id),
        ]);
        if (signal?.cancelled) return;
        const fieldsWithCond: FormField[] = b.fields.map((field) =>
          conditions.has(field.id)
            ? ({ ...field, condition: conditions.get(field.id) } as FormField)
            : field
        );
        // Load the active layout snapshot if there is one.
        let snap: LayoutSnapshot | null = null;
        if (activeId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sb = supabase as unknown as { from: (t: string) => any };
          const { data: layoutRow } = await sb
            .from("form_layouts")
            .select("snapshot")
            .eq("id", activeId)
            .maybeSingle();
          snap = ((layoutRow?.snapshot as LayoutSnapshot | undefined) ?? null);
        }
        setForm(f);
        setBundle({ ...b, fields: fieldsWithCond });
        setActiveLayoutIdState(activeId);
        setActiveSnapshot(snap);
        setError(null);
      } catch (e) {
        if (!signal?.cancelled) setError(e instanceof Error ? e.message : "Ismeretlen hiba");
      } finally {
        if (!signal?.cancelled) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slug]
  );

  useEffect(() => {
    const signal = { cancelled: false };
    loadAll(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [loadAll]);

  const reload = useCallback(() => loadAll(), [loadAll]);

  // ---------- Debounced flush ----------
  const flush = useCallback(async () => {
    flushTimer.current = null;
    const fieldEntries = Array.from(fieldPatchBuf.current.entries());
    const groupEntries = Array.from(groupPatchBuf.current.entries());
    const subGroupEntries = Array.from(subGroupPatchBuf.current.entries());
    const formMeta = { ...formPatchBuf.current };
    fieldPatchBuf.current.clear();
    groupPatchBuf.current.clear();
    subGroupPatchBuf.current.clear();
    formPatchBuf.current = {};

    const hasFormMeta = Object.keys(formMeta).length > 0;
    if (!fieldEntries.length && !groupEntries.length && !subGroupEntries.length && !hasFormMeta) return;

    setSaveStatus("saving");
    try {
      await Promise.all([
        ...fieldEntries.map(([id, patch]) => updateField(id, patch)),
        ...groupEntries.map(([id, patch]) =>
          updateGroup(id, {
            internalName: patch.internalName,
            label: patch.label,
            position: patch.location,
            width: patch.width === undefined ? undefined : patch.width ?? null,
            color: patch.color === undefined ? undefined : (patch.color ?? null),
            visualBackground:
              "visualBackground" in patch ? patch.visualBackground : undefined,
          })
        ),
        ...subGroupEntries.map(([id, patch]) =>
          updateSubGroup(id, {
            internalName: patch.internalName,
            label: patch.label,
            position: patch.location,
            width: patch.width === undefined ? undefined : patch.width ?? null,
            visualBackground:
              "visualBackground" in patch ? patch.visualBackground : undefined,
          })
        ),
        ...(hasFormMeta && form ? [updateFormMeta(form.id, formMeta)] : []),
      ]);
      setSaveStatus("saved");
      window.setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 1500);
    } catch (e) {
      console.error("Editor autosave failed", e);
      setSaveStatus("error");
    }
  }, [form]);

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current != null) window.clearTimeout(flushTimer.current);
    flushTimer.current = window.setTimeout(flush, 500);
  }, [flush]);

  // Flush on unmount.
  useEffect(() => {
    return () => {
      if (flushTimer.current != null) {
        window.clearTimeout(flushTimer.current);
        flush();
      }
    };
  }, [flush]);

  // ---------- Mutations ----------

  const patchForm = useCallback(
    (patch: FormMetaInput) => {
      setForm((f) =>
        f
          ? {
              ...f,
              title: patch.title !== undefined ? patch.title : f.title,
              description:
                patch.description !== undefined ? patch.description : f.description,
              webhook_url:
                patch.webhook_url !== undefined ? patch.webhook_url : f.webhook_url,
              test_webhook_url:
                patch.test_webhook_url !== undefined ? patch.test_webhook_url : f.test_webhook_url,
              thank_you_text:
                patch.thank_you_text !== undefined ? patch.thank_you_text : f.thank_you_text,
              output_url:
                patch.output_url !== undefined ? patch.output_url : f.output_url,
              include_device_type:
                patch.include_device_type !== undefined ? patch.include_device_type : f.include_device_type,
              include_browser:
                patch.include_browser !== undefined ? patch.include_browser : f.include_browser,
              include_page_url:
                patch.include_page_url !== undefined ? patch.include_page_url : f.include_page_url,
              ...(patch.buttonBackground !== undefined
                ? {
                    button_bg_enabled: patch.buttonBackground?.enabled ?? false,
                    button_bg_image_url: patch.buttonBackground?.imageUrl ?? null,
                    button_bg_overlay_color: patch.buttonBackground?.overlayColor ?? null,
                    button_bg_overlay_opacity: patch.buttonBackground?.overlayOpacity ?? null,
                    button_bg_font_color: patch.buttonBackground?.fontColor ?? null,
                    button_bg_text_stroke_width: patch.buttonBackground?.textStrokeWidth ?? null,
                    button_bg_text_stroke_color: patch.buttonBackground?.textStrokeColor ?? null,
                  }
                : {}),
            }
          : f
      );
      formPatchBuf.current = { ...formPatchBuf.current, ...patch };
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const addGroup = useCallback(async () => {
    if (!form || !bundle) return undefined;
    // New groups start as 'unplaced' (position = 0). User drags into structure.
    const row = await createGroup(form.id, 0);
    setBundle((b) =>
      b
        ? {
            ...b,
            groups: [
              ...b.groups,
              { id: row.id, internalName: row.internal_name, label: row.label, location: row.position },
            ],
          }
        : b
    );
    return row.id as string;
  }, [form, bundle]);

  const patchGroup = useCallback(
    (id: string, patch: Partial<FormGroup>) => {
      setBundle((b) =>
        b ? { ...b, groups: b.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) } : b
      );
      const buf = groupPatchBuf.current.get(id) ?? {};
      groupPatchBuf.current.set(id, { ...buf, ...patch });
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const removeGroup = useCallback(async (id: string) => {
    await deleteGroup(id);
    setBundle((b) =>
      b
        ? {
            ...b,
            groups: b.groups.filter((g) => g.id !== id),
            subGroups: b.subGroups.filter((s) => s.groupId !== id),
            fields: b.fields.map((f) =>
              f.groupId === id ? { ...f, groupId: undefined, subGroupId: undefined } : f
            ),
          }
        : b
    );
  }, []);

  const reorderGroups = useCallback(async (orderedIds: string[]) => {
    setBundle((b) =>
      b
        ? {
            ...b,
            groups: b.groups
              .map((g) => ({ ...g, location: orderedIds.indexOf(g.id) + 1 }))
              .sort((a, b2) => a.location - b2.location),
          }
        : b
    );
    setSaveStatus("saving");
    try {
      await setGroupPositions(orderedIds.map((id, i) => ({ id, position: i + 1 })));
      setSaveStatus("saved");
      window.setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 1500);
    } catch {
      setSaveStatus("error");
    }
  }, []);

  /**
   * Re-parent a group: pass a parent groupId to demote it to a sub-group of
   * that group, or `null` to promote it back to top-level. Updates local
   * state so `groups` and `subGroups` arrays stay in sync, then persists via
   * `updateGroup` (parent_group_id column).
   *
   * Note: demoting a group that already has its own sub-groups is rejected by
   * a DB trigger (max 2 levels deep). We let that error bubble up.
   */
  const nestGroup = useCallback(
    async (id: string, parentGroupId: string | null, location = 0) => {
      setBundle((b) => {
        if (!b) return b;
        // Locate the row in either array.
        const fromGroups = b.groups.find((g) => g.id === id);
        const fromSubs = b.subGroups.find((s) => s.id === id);
        const src = fromGroups
          ? {
              id: fromGroups.id,
              internalName: fromGroups.internalName,
              label: fromGroups.label,
              width: fromGroups.width,
            }
          : fromSubs
          ? {
              id: fromSubs.id,
              internalName: fromSubs.internalName,
              label: fromSubs.label,
              width: fromSubs.width,
            }
          : null;
        if (!src) return b;

        if (parentGroupId === null) {
          // Promote → top-level group.
          const newGroup: FormGroup = { ...src, location };
          return {
            ...b,
            groups: fromGroups
              ? b.groups.map((g) => (g.id === id ? newGroup : g))
              : [...b.groups, newGroup],
            subGroups: b.subGroups.filter((s) => s.id !== id),
            // Any field that was attached to this id as subGroupId now no longer makes sense.
            fields: b.fields.map((f) =>
              f.subGroupId === id ? { ...f, subGroupId: undefined } : f
            ),
          };
        }

        // Demote → becomes sub-group of parentGroupId.
        const newSub: FormSubGroup = { ...src, groupId: parentGroupId, location };
        return {
          ...b,
          groups: b.groups.filter((g) => g.id !== id),
          subGroups: fromSubs
            ? b.subGroups.map((s) => (s.id === id ? newSub : s))
            : [...b.subGroups, newSub],
          // If the group being demoted contained fields directly, those fields'
          // subGroupId is irrelevant; only their groupId matters. Move any
          // field that was inside this group at the top-level (subGroupId
          // null) so it ends up inside the new sub-group's parent group.
          fields: b.fields.map((f) =>
            f.groupId === id
              ? { ...f, groupId: parentGroupId, subGroupId: id }
              : f
          ),
        };
      });

      setSaveStatus("saving");
      try {
        await updateGroup(id, { parentGroupId, position: location });
        // Also re-parent any fields that lived inside this (now demoted) group:
        // group_id becomes parentGroupId and sub_group_id becomes this id.
        const orphans = (bundle?.fields ?? []).filter(
          (f) => f.groupId === id && parentGroupId !== null
        );
        if (orphans.length) {
          await setFieldPositions(
            orphans.map((f) => ({
              id: f.id,
              position: f.location,
              groupId: parentGroupId,
              subGroupId: id,
            }))
          );
        }
        setSaveStatus("saved");
        window.setTimeout(
          () => setSaveStatus((s) => (s === "saved" ? "idle" : s)),
          1500
        );
      } catch (e) {
        console.error("Nest/unnest group failed", e);
        setSaveStatus("error");
      }
    },
    [bundle]
  );

  const addSubGroup = useCallback(
    async (groupId: string) => {
      if (!form || !bundle) return undefined;
      // New sub-groups start as 'unplaced' (position = 0).
      const row = await createSubGroup(form.id, groupId, 0);
      setBundle((b) =>
        b
          ? {
              ...b,
              subGroups: [
                ...b.subGroups,
                {
                  id: row.id,
                  groupId: row.parent_group_id,
                  internalName: row.internal_name,
                  label: row.label,
                  location: row.position,
                },
              ],
            }
          : b
      );
      return row.id as string;
    },
    [form, bundle]
  );

  const patchSubGroup = useCallback(
    (id: string, patch: Partial<FormSubGroup>) => {
      setBundle((b) =>
        b ? { ...b, subGroups: b.subGroups.map((s) => (s.id === id ? { ...s, ...patch } : s)) } : b
      );
      const buf = subGroupPatchBuf.current.get(id) ?? {};
      subGroupPatchBuf.current.set(id, { ...buf, ...patch });
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const removeSubGroup = useCallback(async (id: string) => {
    await deleteSubGroup(id);
    setBundle((b) =>
      b
        ? {
            ...b,
            subGroups: b.subGroups.filter((s) => s.id !== id),
            fields: b.fields.map((f) => (f.subGroupId === id ? { ...f, subGroupId: undefined } : f)),
          }
        : b
    );
  }, []);

  const reorderSubGroups = useCallback(async (groupId: string, orderedIds: string[]) => {
    setBundle((b) =>
      b
        ? {
            ...b,
            subGroups: b.subGroups.map((s) =>
              orderedIds.includes(s.id)
                ? { ...s, location: orderedIds.indexOf(s.id) + 1, groupId }
                : s
            ),
          }
        : b
    );
    setSaveStatus("saving");
    try {
      await setSubGroupPositions(
        orderedIds.map((id, i) => ({ id, position: i + 1, groupId }))
      );
      setSaveStatus("saved");
      window.setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 1500);
    } catch {
      setSaveStatus("error");
    }
  }, []);

  const addField = useCallback(
    async (type: FieldType, opts?: { groupId?: string; subGroupId?: string }) => {
      if (!form || !bundle) throw new Error("Editor not loaded");
      // New fields start as 'unplaced' (position = 0). User drags them into the
      // structure on the Űrlap tab. groupId/subGroupId stay untouched if not
      // provided so the field starts at the global unplaced area.
      const row = await createField(form.id, type, 0, opts?.groupId, opts?.subGroupId);
      // Re-load that field via row mapping (reuse loader for consistency)
      const fresh = await loadEditorBundle(form.id);
      setBundle(fresh);
      return row.id;
    },
    [form, bundle]
  );

  /**
   * Duplicate a field (including options + condition). The new field has the
   * same `internal_name` as the original with a numeric suffix incremented
   * (or `_1` appended if the original has no trailing number).
   */
  const duplicateField = useCallback(
    async (id: string): Promise<string | undefined> => {
      if (!form || !bundle) return undefined;
      const orig = bundle.fields.find((f) => f.id === id);
      if (!orig) return undefined;
      // Compute next internal name. If original ends with digits, increment;
      // otherwise check for existing names with suffixes and pick the next.
      const existingNames = new Set(bundle.fields.map((f) => f.internalName));
      const m = /^(.*?)(\d+)$/.exec(orig.internalName);
      const base = m ? m[1] : `${orig.internalName}_`;
      let n = m ? parseInt(m[2], 10) + 1 : 1;
      let candidate = `${base}${n}`;
      while (existingNames.has(candidate)) {
        n += 1;
        candidate = `${base}${n}`;
      }
      // Place the new field right after the original within the same container.
      const newPosition = (orig.location ?? 0) + 1;
      try {
        const newId = await duplicateFieldRow(id, candidate, newPosition);
        // Re-load editor bundle so the new field (with options + condition) shows up.
        const fresh = await loadEditorBundle(form.id);
        const conditions = await loadConditions(form.id);
        const fieldsWithCond: FormField[] = fresh.fields.map((field) =>
          conditions.has(field.id)
            ? ({ ...field, condition: conditions.get(field.id) } as FormField)
            : field
        );
        setBundle({ ...fresh, fields: fieldsWithCond });
        return newId;
      } catch (e) {
        console.error("Duplicate field failed", e);
        return undefined;
      }
    },
    [form, bundle]
  );

  const patchField = useCallback(
    (id: string, patch: Partial<FormField> & { type?: FieldType }) => {
      setBundle((b) =>
        b ? { ...b, fields: b.fields.map((f) => (f.id === id ? ({ ...f, ...patch } as FormField) : f)) } : b
      );
      // Translate to FieldPatch (basic config + slider step + width).
      const fp: FieldPatch = {};
      if ("internalName" in patch) fp.internalName = patch.internalName;
      if ("label" in patch) fp.label = patch.label;
      if ("placeholder" in patch) fp.placeholder = patch.placeholder ?? null;
      if ("required" in patch) fp.required = patch.required;
      if ("type" in patch && patch.type) fp.type = patch.type;
      if ("location" in patch) fp.position = patch.location;
      if ("groupId" in patch) fp.groupId = patch.groupId ?? null;
      if ("subGroupId" in patch) fp.subGroupId = patch.subGroupId ?? null;
      if ("note" in patch) {
        fp.noteValue = patch.note?.value ?? null;
        fp.notePosition = patch.note?.position ?? null;
      }
      if ("width" in patch) {
        fp.width = patch.width ?? null;
      }
      if ("hideLabel" in patch) {
        fp.hideLabel = !!(patch as { hideLabel?: boolean }).hideLabel;
      }
      // Slider-only attributes
      if ("step" in patch) fp.sliderStep = (patch as { step?: number | null }).step ?? null;
      if ("min" in patch) fp.sliderMin = (patch as { min?: number | null }).min ?? null;
      if ("max" in patch) fp.sliderMax = (patch as { max?: number | null }).max ?? null;
      if ("unit" in patch) fp.sliderUnit = (patch as { unit?: string | null }).unit ?? null;
      if ("customStops" in patch) {
        const cs = (patch as { customStops?: number[] | null }).customStops;
        fp.sliderCustomStops = cs && cs.length ? cs : null;
      }
      if ("customStopsSpacing" in patch) {
        const sp = (patch as { customStopsSpacing?: "equal" | "proportional" | null }).customStopsSpacing;
        fp.sliderCustomStopsSpacing = sp ?? null;
      }
      // Date / image extras
      if ("withTime" in patch) fp.withTime = (patch as { withTime?: boolean }).withTime;
      if ("multiple" in patch) fp.multipleImages = (patch as { multiple?: boolean }).multiple;
      // Option-field extras
      const op = patch as Partial<FormField> & {
        useImages?: boolean;
        uniqueNotePerOption?: boolean;
        columns?: number;
        optionLabelPosition?: "above" | "below" | null;
        fieldImagePosition?: "above" | "below" | "left" | "right" | null;
        placeholderImageUrl?: string | null;
        placeholderNote?: { value: string; position: "above" | "below" | "side" } | null;
      };
      if ("useImages" in op) fp.useImages = op.useImages;
      if ("uniqueNotePerOption" in op) fp.uniqueNotePerOption = op.uniqueNotePerOption;
      if ("columns" in op) fp.columns = op.columns;
      if ("optionLabelPosition" in op) fp.optionLabelPosition = op.optionLabelPosition ?? null;
      if ("fieldImagePosition" in op) fp.fieldImagePosition = op.fieldImagePosition ?? null;
      if ("placeholderImageUrl" in op) fp.placeholderImageUrl = op.placeholderImageUrl ?? null;
      if ("visualBackground" in (patch as Record<string, unknown>)) {
        fp.visualBackground = (patch as { visualBackground?: VisualBackground }).visualBackground;
      }
      if ("placeholderNote" in op) {
        fp.placeholderNoteValue = op.placeholderNote?.value ?? null;
        fp.placeholderNotePosition = op.placeholderNote?.position ?? null;
      }
      // Measurement-field extras
      if ("unitDisplay" in (patch as Record<string, unknown>)) {
        const ud = (patch as { unitDisplay?: "dropdown" | "radio" }).unitDisplay;
        fp.measurementConfig = { unitDisplay: ud ?? "radio" };
      }
      // Repeater extras: any change to a repeater-specific attribute triggers
      // a rewrite of the entire `repeater_config` JSONB blob from the merged
      // in-memory state. We compute it after the local setBundle below by
      // reading the just-patched field.
      const repeaterKeys = [
        "children",
        "itemLabel",
        "addButtonLabel",
        "minInstances",
        "maxInstances",
        "titleChildId",
      ] as const;
      const touchesRepeater = repeaterKeys.some((k) => k in (patch as Record<string, unknown>));
      if (touchesRepeater) {
        // Read the merged field from the bundle (after setBundle above).
        // setBundle is synchronous for our purposes here — but since React
        // state updates are async, instead build the merged shape inline.
        const current = bundle?.fields.find((f) => f.id === id);
        const merged = { ...(current ?? {}), ...patch } as Partial<{
          children: unknown;
          itemLabel: string;
          addButtonLabel: string;
          minInstances: number;
          maxInstances: number;
          titleChildId: string;
        }>;
        fp.repeaterConfig = {
          itemLabel: merged.itemLabel ?? null,
          addButtonLabel: merged.addButtonLabel ?? null,
          minInstances: merged.minInstances ?? null,
          maxInstances: merged.maxInstances ?? null,
          titleChildId: merged.titleChildId ?? null,
          children: Array.isArray(merged.children) ? merged.children : [],
        };
      }
      const buf = fieldPatchBuf.current.get(id) ?? {};
      fieldPatchBuf.current.set(id, { ...buf, ...fp });
      scheduleFlush();
    },
    [scheduleFlush, bundle]
  );

  const setFieldOptions = useCallback(
    async (fieldId: string, options: FieldOption[]) => {
      // Optimistic local update
      setBundle((b) =>
        b
          ? {
              ...b,
              fields: b.fields.map((f) =>
                f.id === fieldId && (f.type === "radio" || f.type === "checkbox" || f.type === "select")
                  ? ({ ...f, options } as FormField)
                  : f
              ),
            }
          : b
      );
      setSaveStatus("saving");
      try {
        await replaceFieldOptions(fieldId, options);
        setSaveStatus("saved");
        window.setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 1500);
      } catch (e) {
        console.error("Save options failed", e);
        setSaveStatus("error");
      }
    },
    []
  );

  const setFieldCondition = useCallback(
    async (fieldId: string, condition: ConditionGroup | undefined) => {
      // Optimistic local update
      setBundle((b) =>
        b
          ? {
              ...b,
              fields: b.fields.map((f) =>
                f.id === fieldId ? ({ ...f, condition } as FormField) : f
              ),
            }
          : b
      );
      setSaveStatus("saving");
      try {
        await saveFieldCondition(fieldId, condition);
        setSaveStatus("saved");
        window.setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 1500);
      } catch (e) {
        console.error("Save condition failed", e);
        setSaveStatus("error");
      }
    },
    []
  );

  const setGroupCondition = useCallback(
    async (groupId: string, condition: ConditionGroup | undefined) => {
      // Optimistic local update — the same id may be a top-level group or a sub-group.
      setBundle((b) =>
        b
          ? {
              ...b,
              groups: b.groups.map((g) =>
                g.id === groupId ? { ...g, condition } : g
              ),
              subGroups: b.subGroups.map((sg) =>
                sg.id === groupId ? { ...sg, condition } : sg
              ),
            }
          : b
      );
      setSaveStatus("saving");
      try {
        await saveGroupCondition(groupId, condition);
        setSaveStatus("saved");
        window.setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 1500);
      } catch (e) {
        console.error("Save group condition failed", e);
        setSaveStatus("error");
      }
    },
    []
  );

  const removeField = useCallback(async (id: string) => {
    await deleteField(id);
    setBundle((b) => (b ? { ...b, fields: b.fields.filter((f) => f.id !== id) } : b));
  }, []);

  const reorderFields = useCallback(
    async (
      container: { groupId?: string | null; subGroupId?: string | null },
      orderedIds: string[]
    ) => {
      setBundle((b) =>
        b
          ? {
              ...b,
              fields: b.fields.map((f) =>
                orderedIds.includes(f.id)
                  ? {
                      ...f,
                      location: orderedIds.indexOf(f.id) + 1,
                      groupId: container.groupId ?? undefined,
                      subGroupId: container.subGroupId ?? undefined,
                    }
                  : f
              ),
            }
          : b
      );
      setSaveStatus("saving");
      try {
        await setFieldPositions(
          orderedIds.map((id, i) => ({
            id,
            position: i + 1,
            groupId: container.groupId ?? null,
            subGroupId: container.subGroupId ?? null,
          }))
        );
        setSaveStatus("saved");
        window.setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 1500);
      } catch {
        setSaveStatus("error");
      }
    },
    []
  );

  const schema: FormSchema = bundle && form
    ? bundleToSchema(form, bundle)
    : { title: defaults.title, description: defaults.description, groups: [], subGroups: [], fields: [] };

  // Schema as it will appear in the live form: applies the active saved layout
  // (if any) over the in-memory bundle without writing to the DB.
  const previewSchema: FormSchema = (() => {
    if (!bundle || !form) return schema;
    if (!activeSnapshot) return schema;
    const applied = applySnapshotToBundle(
      activeSnapshot,
      bundle.groups,
      bundle.subGroups,
      bundle.fields
    );
    return bundleToSchema(form, applied);
  })();

  const setActiveLayout = useCallback(
    async (layoutId: string | null) => {
      if (!form) return;
      // Optimistic local update.
      setActiveLayoutIdState(layoutId);
      if (!layoutId) {
        setActiveSnapshot(null);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = supabase as unknown as { from: (t: string) => any };
        const { data: layoutRow } = await sb
          .from("form_layouts")
          .select("snapshot")
          .eq("id", layoutId)
          .maybeSingle();
        setActiveSnapshot(((layoutRow?.snapshot as LayoutSnapshot | undefined) ?? null));
      }
      try {
        await apiSetActiveLayoutId(form.id, layoutId);
      } catch (e) {
        console.error("Failed to set active layout", e);
      }
    },
    [form]
  );

  return {
    loading,
    error,
    form,
    groups: bundle?.groups ?? [],
    subGroups: bundle?.subGroups ?? [],
    fields: bundle?.fields ?? [],
    schema,
    previewSchema,
    activeLayoutId,
    setActiveLayout,
    saveStatus,
    reload,
    patchForm,
    addGroup,
    patchGroup,
    removeGroup,
    reorderGroups,
    nestGroup,
    addSubGroup,
    patchSubGroup,
    removeSubGroup,
    reorderSubGroups,
    addField,
    duplicateField,
    patchField,
    removeField,
    reorderFields,
    setFieldOptions,
    setFieldCondition,
    setGroupCondition,
  };
}
