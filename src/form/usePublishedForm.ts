import { useEffect, useState } from "react";
import { loadPublishedForm, type FormRecord } from "./api";
import { sampleSchema } from "./sampleSchema";

export interface UseFormResult {
  loading: boolean;
  error: string | null;
  /** Backing record from Supabase, if loaded. */
  record: FormRecord | null;
  /** Render-ready data: either the cloud schema or the local sample fallback. */
  title: string;
  description?: string;
  schema: FormRecord["schema"];
  /** Form id to attach to submissions. Null when using local fallback. */
  formId: string | null;
}

/**
 * Loads a published form from Supabase by slug. Falls back to the local
 * sample schema (with no formId) when no published row exists yet, so the
 * embed always has something meaningful to render during development.
 */
export function usePublishedForm(slug = "default"): UseFormResult {
  const [record, setRecord] = useState<FormRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadPublishedForm(slug)
      .then((r) => {
        if (cancelled) return;
        setRecord(r);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Ismeretlen hiba");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Use the cloud record only if it has at least one field defined.
  // Otherwise, fall back to the local sample so the foundation pass renders
  // a meaningful preview while the editor (next iteration) populates it.
  const hasCloudFields =
    record && Array.isArray(record.schema?.fields) && record.schema.fields.length > 0;

  if (hasCloudFields && record) {
    return {
      loading,
      error,
      record,
      title: record.title,
      description: record.description ?? undefined,
      schema: record.schema,
      formId: record.id,
    };
  }

  return {
    loading,
    error,
    record,
    title: record?.title ?? sampleSchema.title,
    description: record?.description ?? sampleSchema.description,
    schema: sampleSchema,
    formId: record?.id ?? null,
  };
}
