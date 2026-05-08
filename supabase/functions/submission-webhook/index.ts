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
  /** Optional override webhook URL — used by the "Demo küldés" button. */
  testWebhookUrl?: string;
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

    // Load all fields/groups/sub-groups, then optionally apply the form's
    // active layout snapshot so we use the same placement the user sees.
    const [
      { data: fields },
      { data: groups },
      { data: subGroups },
      { data: formRow },
    ] = await Promise.all([
      admin
        .from("form_fields")
        .select("id, internal_name, position, group_id, sub_group_id")
        .eq("form_id", form.id),
      admin
        .from("form_groups")
        .select("id, position")
        .eq("form_id", form.id),
      admin
        .from("form_sub_groups")
        .select("id, position, group_id")
        .eq("form_id", form.id),
      admin
        .from("forms")
        .select("active_layout_id")
        .eq("id", form.id)
        .maybeSingle(),
    ]);

    // If an active layout exists, virtually override positions/parents using
    // the snapshot — exactly what the live/preview renderer does.
    const activeLayoutId = (formRow as { active_layout_id: string | null } | null)
      ?.active_layout_id ?? null;
    let effFields = (fields ?? []).map((f) => ({ ...f }));
    let effGroups = (groups ?? []).map((g) => ({ ...g }));
    let effSubGroups = (subGroups ?? []).map((s) => ({ ...s }));

    if (activeLayoutId) {
      const { data: layoutRow } = await admin
        .from("form_layouts")
        .select("snapshot")
        .eq("id", activeLayoutId)
        .maybeSingle();
      const snapshot = (layoutRow?.snapshot ?? null) as
        | {
            groups?: Array<{ id: string; position: number }>;
            subGroups?: Array<{ id: string; groupId: string; position: number }>;
            fields?: Array<{
              id: string;
              position: number;
              groupId: string | null;
              sub_group_id?: string | null;
              subGroupId?: string | null;
            }>;
          }
        | null;
      if (snapshot) {
        const snapGroup = new Map(
          (snapshot.groups ?? []).map((g) => [g.id, g.position]),
        );
        const snapSub = new Map(
          (snapshot.subGroups ?? []).map((s) => [
            s.id,
            { position: s.position, groupId: s.groupId },
          ]),
        );
        const snapField = new Map(
          (snapshot.fields ?? []).map((f) => [
            f.id,
            {
              position: f.position,
              groupId: f.groupId,
              subGroupId: f.subGroupId ?? f.sub_group_id ?? null,
            },
          ]),
        );
        effGroups = effGroups.map((g) => ({
          ...g,
          position: snapGroup.get(g.id) ?? 0,
        }));
        effSubGroups = effSubGroups.map((s) => {
          const snap = snapSub.get(s.id);
          return {
            ...s,
            group_id: snap?.groupId ?? s.group_id,
            position: snap?.position ?? 0,
          };
        });
        effFields = effFields.map((f) => {
          const snap = snapField.get(f.id);
          return {
            ...f,
            position: snap?.position ?? 0,
            group_id: snap ? snap.groupId : null,
            sub_group_id: snap ? snap.subGroupId : null,
          };
        });
      }
    }

    const groupPos = new Map<string, number>(
      effGroups.map((g) => [g.id, g.position ?? 0]),
    );
    const subGroupPos = new Map<string, number>(
      effSubGroups.map((s) => [s.id, s.position ?? 0]),
    );

    // Only include fields that are actually placed (position > 0) and whose
    // containing group/sub-group (if any) is also placed.
    const placedFields = effFields.filter((f) => {
      if ((f.position ?? 0) <= 0) return false;
      if (f.group_id && (groupPos.get(f.group_id) ?? 0) <= 0) return false;
      if (f.sub_group_id && (subGroupPos.get(f.sub_group_id) ?? 0) <= 0) return false;
      return true;
    });

    // Sort fields by [group position, sub-group position, field position],
    // matching the top-level → group → sub-group rendering order.
    placedFields.sort((a, b) => {
      const ag = a.group_id ? (groupPos.get(a.group_id) ?? 0) : (a.position ?? 0);
      const bg = b.group_id ? (groupPos.get(b.group_id) ?? 0) : (b.position ?? 0);
      if (ag !== bg) return ag - bg;
      const asg = a.sub_group_id ? (subGroupPos.get(a.sub_group_id) ?? 0) : 0;
      const bsg = b.sub_group_id ? (subGroupPos.get(b.sub_group_id) ?? 0) : 0;
      if (asg !== bsg) return asg - bsg;
      return (a.position ?? 0) - (b.position ?? 0);
    });

    const rawValues = (submission.values ?? {}) as Record<string, unknown>;
    const namedValues: Record<string, unknown> = {};
    for (const f of placedFields) {
      if (Object.prototype.hasOwnProperty.call(rawValues, f.id)) {
        namedValues[f.internal_name] = rawValues[f.id];
      }
    }

    const payload = {
      submissionId: submission.id,
      formId: form.id,
      formSlug: form.slug,
      formTitle: form.title,
      submittedAt: submission.created_at,
      values: namedValues,
    };

    let status = "error";
    let responseText = "";
    // Normalize the URL: prefix https:// if no protocol was provided.
    let targetUrl = form.webhook_url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }
    try {
      const resp = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      responseText = (await resp.text()).slice(0, 1000);
      status = `${resp.status}`;
    } catch (e) {
      responseText = e instanceof Error ? e.message : String(e);
      console.error("Webhook relay failed", { targetUrl, error: responseText });
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
