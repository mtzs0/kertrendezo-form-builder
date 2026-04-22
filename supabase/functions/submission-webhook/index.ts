// supabase/functions/submission-webhook/index.ts
// Persists a form submission (using SERVICE ROLE to bypass RLS) and relays
// the payload to the form's configured webhook URL. Returns the new
// submission id and the relay status.
//
// Two call modes are supported for backwards compatibility:
//   { formId, values, userAgent? }  → insert + relay  (preferred)
//   { submissionId }                → relay an already-inserted submission

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  submissionId?: string;
  formId?: string;
  values?: Record<string, unknown>;
  userAgent?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return json({ ok: false, error: "Server is missing Supabase env" }, 500);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // ----- Resolve / create the submission row -----
    let submissionId = body.submissionId ?? null;

    if (!submissionId) {
      if (!body.formId) {
        return json({ ok: false, error: "formId or submissionId is required" }, 400);
      }

      // Verify the form exists and is published before inserting.
      const { data: formCheck, error: formErr } = await admin
        .from("forms")
        .select("id, published")
        .eq("id", body.formId)
        .maybeSingle();
      if (formErr || !formCheck) {
        return json({ ok: false, error: "Form not found" }, 404);
      }
      if (!formCheck.published) {
        return json({ ok: false, error: "Form is not published" }, 400);
      }

      const { data: ins, error: insErr } = await admin
        .from("form_submissions")
        .insert({
          form_id: body.formId,
          values: body.values ?? {},
          user_agent: body.userAgent ?? null,
        })
        .select("id")
        .single();
      if (insErr || !ins) {
        console.error("Insert submission failed", insErr);
        return json({ ok: false, error: "Failed to store submission" }, 500);
      }
      submissionId = ins.id;
    }

    // ----- Load full submission + form (with webhook url) -----
    const { data: submission, error: subErr } = await admin
      .from("form_submissions")
      .select("id, values, created_at, form_id, forms!inner(id, slug, title, webhook_url)")
      .eq("id", submissionId)
      .single();

    if (subErr || !submission) {
      console.error("Submission not found", subErr);
      return json({ ok: false, error: "Submission not found" }, 404);
    }

    const form = (submission as unknown as {
      forms: { webhook_url: string | null; slug: string; title: string; id: string };
    }).forms;

    if (!form?.webhook_url) {
      await admin
        .from("form_submissions")
        .update({ webhook_status: "skipped_no_url" })
        .eq("id", submissionId);
      return json({ ok: true, submissionId, relayed: false, reason: "no webhook configured" });
    }

    const payload = {
      submissionId: submission.id,
      formId: form.id,
      formSlug: form.slug,
      formTitle: form.title,
      submittedAt: submission.created_at,
      values: submission.values,
    };

    let status = "error";
    let responseText = "";
    try {
      const resp = await fetch(form.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      responseText = (await resp.text()).slice(0, 1000);
      status = `${resp.status}`;
    } catch (e) {
      responseText = e instanceof Error ? e.message : String(e);
    }

    await admin
      .from("form_submissions")
      .update({ webhook_status: status, webhook_response: responseText })
      .eq("id", submissionId);

    return json({ ok: true, submissionId, relayed: true, status });
  } catch (e) {
    console.error("submission-webhook error", e);
    return json({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
