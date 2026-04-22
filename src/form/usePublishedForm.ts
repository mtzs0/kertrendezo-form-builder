import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadEditorBundle, bundleToSchema, type EditorForm } from "./editorApi";
import { loadConditions } from "./conditionApi";
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

/**
 * Loads a published form by slug from the normalized editor tables. Returns
 * an empty schema when no published row exists or the form has no fields yet.
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
        const { data: row, error: selErr } = await supabase
          .from("forms")
          .select("id, slug, title, description, published, webhook_url, thank_you_text")
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
        const [bundle, conditions] = await Promise.all([
          loadEditorBundle(f.id),
          loadConditions(f.id),
        ]);
        if (cancelled) return;
        // Merge per-field conditions into the bundle so isFieldVisible works.
        const mergedFields: FormField[] = bundle.fields.map((field) =>
          conditions.has(field.id)
            ? ({ ...field, condition: conditions.get(field.id) } as FormField)
            : field
        );
        setForm(f);
        setSchema(bundleToSchema(f, { ...bundle, fields: mergedFields }));
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
