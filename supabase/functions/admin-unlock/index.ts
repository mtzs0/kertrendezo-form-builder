// supabase/functions/admin-unlock/index.ts
//
// Password-only admin unlock. The client posts { password }. We compare it
// (constant-time) against the ADMIN_PASSWORD secret. On success we:
//   1. Ensure a designated admin user exists (single shared admin account
//      identified by a fixed internal email — never used for delivery).
//   2. Claim any forms with no owner for that admin.
//   3. Generate a one-shot magic-link token via the service role and return
//      its hashed token. The client exchanges it with `verifyOtp` to obtain
//      a real Supabase session — so all subsequent writes go through RLS as
//      an authenticated owner.
//
// No email is ever sent: we use `auth.admin.generateLink` purely to mint a
// short-lived token. The function is rate-limited per IP to slow brute force.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "admin@krform.internal";

// --- naive in-memory rate limit (per warm instance) -----------------------
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(ip, { count: 1, first: now });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_PER_WINDOW;
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) {
    // Still walk one buffer to keep timing closer to equal-length compare.
    let diff = ab.length ^ bb.length;
    for (let i = 0; i < Math.max(ab.length, bb.length); i++) {
      diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
    }
    return diff === 0;
  }
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

function randomPassword(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)) + "Aa1!";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  if (rateLimited(ip)) {
    return new Response(JSON.stringify({ error: "Too many attempts" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let password = "";
  try {
    const body = await req.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return new Response(JSON.stringify({ error: "Invalid body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const expected = Deno.env.get("ADMIN_PASSWORD") ?? "";
  if (!expected) {
    return new Response(JSON.stringify({ error: "Server not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Constant-time compare. Reject before doing any DB work.
  if (!timingSafeEqual(password, expected)) {
    // Small artificial delay to further smooth timing.
    await new Promise((r) => setTimeout(r, 300));
    return new Response(JSON.stringify({ error: "Invalid password" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Find or create the shared admin user.
  let adminUserId: string | null = null;
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) {
    return new Response(JSON.stringify({ error: listErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const existing = list.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL);
  if (existing) {
    adminUserId = existing.id;
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: randomPassword(),
      email_confirm: true,
    });
    if (createErr || !created.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? "Create failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    adminUserId = created.user.id;
  }

  // 2) Claim any unowned forms for the admin.
  await admin
    .from("forms")
    .update({ owner_id: adminUserId })
    .is("owner_id", null);

  // 3) Generate a magic-link token (we don't actually email it).
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: ADMIN_EMAIL,
  });
  if (linkErr || !link?.properties?.hashed_token) {
    return new Response(JSON.stringify({ error: linkErr?.message ?? "Token failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      email: ADMIN_EMAIL,
      token_hash: link.properties.hashed_token,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
