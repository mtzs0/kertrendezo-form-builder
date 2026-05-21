import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadEditorBundle, bundleToSchema, type EditorForm } from "./editorApi";
import { loadConditions } from "./conditionApi";
import { applySnapshotToBundle, type LayoutSnapshot } from "./layoutsApi";
import type { FormField, FormSchema } from "./types";

export interface UseFormResult {
  loading: boolean;
  error: string | null;
  /** Backing form record from Supabase. */
  form: EditorForm | null;
  /** Render-ready data: rebuilt from the normalized tables. */
  title: string;
  description?: string;
  schema: FormSchema;
  /** Form id to attach to submissions. Null when no published form exists. */
  formId: string | null;
}

const EMPTY_SCHEMA: FormSchema = {
  title: "",
  description: undefined,
  groups: [],
  subGroups: [],
  fields: [],
};

// `forms.active_layout_id` was added after the last types regeneration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as unknown as { from: (table: string) => any };

/**
 * Loads a published form by slug from the normalized editor tables. Returns
 * an empty schema when no published row exists or the form has no fields yet.
 *
 * If the form has an `active_layout_id` set, the corresponding saved layout
 * snapshot is applied virtually (in memory) before rendering. When the
 * pointer is null, the live editor state is used as-is ("Jelenlegi nézet").
 */
export function usePublishedForm(slug = "default"): UseFormResult {
  const [form, setForm] = useState<EditorForm | null>(null);
  const [schema, setSchema] = useState<FormSchema>(EMPTY_SCHEMA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data: row, error: selErr } = await sb
          .from("forms")
          .select("id, slug, title, description, published, thank_you_text, active_layout_id, button_bg_enabled, button_bg_image_url, button_bg_overlay_color, button_bg_overlay_opacity, button_bg_font_color, button_bg_text_stroke_width, button_bg_text_stroke_color, tabs_bg_enabled, tabs_bg_image_url, tabs_bg_overlay_color, tabs_bg_overlay_opacity, tabs_bg_font_color, tabs_bg_text_stroke_width, tabs_bg_text_stroke_color")
          .eq("slug", slug)
          .eq("published", true)
          .maybeSingle();
        if (selErr) throw selErr;
        if (!row) {
          if (!cancelled) {
            setForm(null);
            setSchema(EMPTY_SCHEMA);
            setError(null);
          }
          return;
        }
        const f: EditorForm = row as EditorForm;
        const activeLayoutId: string | null = (row as { active_layout_id: string | null }).active_layout_id ?? null;

        const [bundle, conditions, layoutRes] = await Promise.all([
          loadEditorBundle(f.id),
          loadConditions(f.id),
          activeLayoutId
            ? sb.from("form_layouts").select("snapshot").eq("id", activeLayoutId).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);
        if (cancelled) return;

        // Merge per-field conditions into the bundle so isFieldVisible works.
        const mergedFields: FormField[] = bundle.fields.map((field) =>
          conditions.has(field.id)
            ? ({ ...field, condition: conditions.get(field.id) } as FormField)
            : field
        );

        // If an active layout is set, apply its snapshot virtually.
        let finalGroups = bundle.groups;
        let finalSubGroups = bundle.subGroups;
        let finalFields = mergedFields;
        const snapshot = (layoutRes?.data?.snapshot ?? null) as LayoutSnapshot | null;
        if (snapshot) {
          const applied = applySnapshotToBundle(snapshot, bundle.groups, bundle.subGroups, mergedFields);
          finalGroups = applied.groups;
          finalSubGroups = applied.subGroups;
          finalFields = applied.fields;
        }

        setForm(f);
        setSchema(
          bundleToSchema(f, { groups: finalGroups, subGroups: finalSubGroups, fields: finalFields })
        );
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Ismeretlen hiba");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return {
    loading,
    error,
    form,
    title: form?.title ?? "",
    description: form?.description ?? undefined,
    schema,
    formId: form?.id ?? null,
  };
}
