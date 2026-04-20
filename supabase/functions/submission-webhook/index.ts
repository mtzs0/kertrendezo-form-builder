// supabase/functions/submission-webhook/index.ts
// Relays a stored submission to the form's configured webhook URL.
// Uses the SERVICE ROLE key to read the submission + form (bypassing RLS),
// then POSTs the payload to webhook_url and stores the relay status back
// onto the submission row.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  submissionId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { submissionId } = (await req.json()) as RequestBody;
    if (!submissionId) {
      return json({ error: "submissionId is required" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return json({ error: "Server is missing Supabase env" }, 500);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: submission, error: subErr } = await admin
      .from("form_submissions")
      .select("id, values, created_at, form_id, forms!inner(id, slug, title, webhook_url)")
      .eq("id", submissionId)
      .single();

    if (subErr || !submission) {
      console.error("Submission not found", subErr);
      return json({ error: "Submission not found" }, 404);
    }

    // Supabase typing for joined row
    const form = (submission as unknown as { forms: { webhook_url: string | null; slug: string; title: string; id: string } }).forms;
    if (!form?.webhook_url) {
      // Nothing to relay — mark as skipped, return 200 so caller doesn't retry.
      await admin
        .from("form_submissions")
        .update({ webhook_status: "skipped_no_url" })
        .eq("id", submissionId);
      return json({ ok: true, relayed: false, reason: "no webhook configured" });
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

    return json({ ok: true, relayed: true, status });
  } catch (e) {
    console.error("submission-webhook error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
