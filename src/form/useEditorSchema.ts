import { useCallback, useEffect, useRef, useState } from "react";
import {
  bundleToSchema,
  createField,
  createGroup,
  createSubGroup,
  deleteField,
  deleteGroup,
  deleteSubGroup,
  ensureForm,
  loadEditorBundle,
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
import type { FieldType, FormField, FormGroup, FormSchema, FormSubGroup } from "./types";

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
  saveStatus: SaveStatus;

  // Form meta ops
  patchForm: (patch: Partial<{ title: string; description: string | null }>) => void;

  // Group ops
  addGroup: () => Promise<void>;
  patchGroup: (id: string, patch: Partial<FormGroup>) => void;
  removeGroup: (id: string) => Promise<void>;
  reorderGroups: (orderedIds: string[]) => Promise<void>;

  // Sub-group ops
  addSubGroup: (groupId: string) => Promise<void>;
  patchSubGroup: (id: string, patch: Partial<FormSubGroup>) => void;
  removeSubGroup: (id: string) => Promise<void>;
  reorderSubGroups: (groupId: string, orderedIds: string[]) => Promise<void>;

  // Field ops
  addField: (type: FieldType, opts?: { groupId?: string; subGroupId?: string }) => Promise<string>;
  patchField: (id: string, patch: Partial<FormField> & { type?: FieldType }) => void;
  removeField: (id: string) => Promise<void>;
  reorderFields: (
    container: { groupId?: string | null; subGroupId?: string | null },
    orderedIds: string[]
  ) => Promise<void>;
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

  // Debounced patch buffers, keyed by row id.
  const fieldPatchBuf = useRef<Map<string, FieldPatch>>(new Map());
  const groupPatchBuf = useRef<Map<string, Partial<FormGroup>>>(new Map());
  const subGroupPatchBuf = useRef<Map<string, Partial<FormSubGroup>>>(new Map());
  const formPatchBuf = useRef<Partial<{ title: string; description: string | null }>>({});
  const flushTimer = useRef<number | null>(null);

  // ---------- Load ----------
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const f = await ensureForm(slug, defaults);
        const b = await loadEditorBundle(f.id);
        if (cancelled) return;
        setForm(f);
        setBundle(b);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Ismeretlen hiba");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

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
          })
        ),
        ...subGroupEntries.map(([id, patch]) =>
          updateSubGroup(id, {
            internalName: patch.internalName,
            label: patch.label,
            position: patch.location,
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

  const addGroup = useCallback(async () => {
    if (!form || !bundle) return;
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

  const addSubGroup = useCallback(
    async (groupId: string) => {
      if (!form || !bundle) return;
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
                  groupId: row.group_id,
                  internalName: row.internal_name,
                  label: row.label,
                  location: row.position,
                },
              ],
            }
          : b
      );
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

  const reorderSubGroups = useCallback(async (_groupId: string, orderedIds: string[]) => {
    setBundle((b) =>
      b
        ? {
            ...b,
            subGroups: b.subGroups.map((s) =>
              orderedIds.includes(s.id) ? { ...s, location: orderedIds.indexOf(s.id) + 1 } : s
            ),
          }
        : b
    );
    setSaveStatus("saving");
    try {
      await setSubGroupPositions(orderedIds.map((id, i) => ({ id, position: i + 1 })));
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

  const patchField = useCallback(
    (id: string, patch: Partial<FormField> & { type?: FieldType }) => {
      setBundle((b) =>
        b ? { ...b, fields: b.fields.map((f) => (f.id === id ? ({ ...f, ...patch } as FormField) : f)) } : b
      );
      // Translate to FieldPatch (only the basic-config keys for this pass).
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
      const buf = fieldPatchBuf.current.get(id) ?? {};
      fieldPatchBuf.current.set(id, { ...buf, ...fp });
      scheduleFlush();
    },
    [scheduleFlush]
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

  return {
    loading,
    error,
    form,
    groups: bundle?.groups ?? [],
    subGroups: bundle?.subGroups ?? [],
    fields: bundle?.fields ?? [],
    schema,
    saveStatus,
    addGroup,
    patchGroup,
    removeGroup,
    reorderGroups,
    addSubGroup,
    patchSubGroup,
    removeSubGroup,
    reorderSubGroups,
    addField,
    patchField,
    removeField,
    reorderFields,
  };
}
