import { supabase } from "@/integrations/supabase/client";
import type { FormSchema, FormValues } from "./types";

export interface FormRecord {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  schema: FormSchema;
  webhook_url: string | null;
  published: boolean;
}

/**
 * Load a published form by slug. Returns null if not found.
 * Anonymous reads are allowed by RLS for `published = true` rows.
 */
export async function loadPublishedForm(slug = "default"): Promise<FormRecord | null> {
  const { data, error } = await supabase
    .from("forms")
    .select("id, slug, title, description, schema, webhook_url, published")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (error) {
    console.error("loadPublishedForm error", error);
    throw error;
  }
  if (!data) return null;

  // Cast JSONB schema to our typed shape.
  return {
    ...data,
    schema: data.schema as unknown as FormSchema,
  };
}

/**
 * Submit a form. Inserts into `form_submissions` (RLS allows anon insert
 * when the referenced form is published) and asynchronously triggers the
 * webhook relay edge function if a webhook_url is configured server-side.
 */
export async function submitForm(
  formId: string,
  values: FormValues,
  opts?: { testWebhookUrl?: string }
) {
  // Serialize Date / File values into JSON-friendly shapes.
  const serializable = serializeValues(values);

  // Route everything through the edge function: it inserts the submission
  // (using the service role, bypassing RLS read-back limits for anon) and
  // then relays the payload to the form's webhook URL if configured. When a
  // testWebhookUrl is provided the edge function relays there instead of the
  // form's saved webhook URL — used by the "Demo küldés" button.
  const { data, error } = await supabase.functions.invoke("submission-webhook", {
    body: {
      formId,
      values: serializable,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      testWebhookUrl: opts?.testWebhookUrl,
    },
  });

  if (error) throw error;
  if (!data?.ok) {
    throw new Error(data?.error ?? "Submission failed");
  }
  return data.submissionId as string;
}

function serializeValues(values: FormValues): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (v instanceof Date) out[k] = v.toISOString();
    else if (Array.isArray(v) && v.length && v[0] instanceof File) {
      // Foundation pass: file uploads (storage) come in a later iteration.
      out[k] = (v as File[]).map((f) => ({ name: f.name, size: f.size, type: f.type }));
    } else {
      out[k] = v as unknown;
    }
  }
  return out;
}
