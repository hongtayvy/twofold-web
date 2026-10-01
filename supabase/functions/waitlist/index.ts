// Waitlist intake for the TwoFold coming-soon page.
//
// The browser posts here instead of straight at PostgREST. That buys three things
// an open anon INSERT cannot give you:
//   1. per-IP rate limiting, so the table cannot be flooded
//   2. a server side honeypot check a bot cannot skip by calling the API directly
//   3. forwarding to the email provider at signup time, so the list warms up
//      gradually instead of arriving as one cold blast on launch day
//
// Deploy:  supabase functions deploy waitlist --no-verify-jwt
//   --no-verify-jwt is required: signups are anonymous by definition.
//
// Secrets: supabase secrets set IP_SALT=... [BUTTONDOWN_API_KEY=...]
//   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",").map((o) => o.trim()).filter(Boolean);

const MAX_PER_WINDOW = 5;
const WINDOW_MINUTES = 60;

function corsHeaders(origin: string | null): Record<string, string> {
  // Echo the origin only when it is on the allowlist. An empty allowlist means
  // local development, where we fall back to "*".
  const allow = ALLOWED_ORIGINS.length === 0
    ? "*"
    : (origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

/** Salted SHA-256. We rate limit on this, never on the raw address. */
async function hashIp(ip: string): Promise<string> {
  const salt = Deno.env.get("IP_SALT") ?? "";
  const data = new TextEncoder().encode(salt + ip);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Best effort forward to the email provider. Never fails the signup. */
async function forwardToProvider(email: string): Promise<boolean> {
  const key = Deno.env.get("BUTTONDOWN_API_KEY");
  if (!key) return false; // Not wired up yet. The row is still safely in Postgres.
  try {
    const res = await fetch("https://api.buttondown.com/v1/subscribers", {
      method: "POST",
      headers: { "Authorization": `Token ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email_address: email, tags: ["waitlist"] }),
    });
    // 201 created, 409 already subscribed. Both mean the provider has them.
    return res.ok || res.status === 409;
  } catch (e) {
    console.error("provider forward failed", e);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);

  let payload: { email?: string; company?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400, origin);
  }

  // Honeypot. Report success so the bot gets no signal, and store nothing.
  if (payload.company) return json({ ok: true }, 200, origin);

  const email = (payload.email ?? "").trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "invalid_email" }, 400, origin);
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ipHash = await hashIp(ip);

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Rate limit before doing any writing.
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { count, error: countErr } = await db
    .from("waitlist_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);

  if (countErr) {
    console.error("rate check failed", countErr);
    return json({ error: "server_error" }, 500, origin);
  }
  if ((count ?? 0) >= MAX_PER_WINDOW) {
    return json({ error: "rate_limited" }, 429, origin);
  }

  await db.from("waitlist_attempts").insert({ ip_hash: ipHash });

  const synced = await forwardToProvider(email);

  const { error: insertErr } = await db
    .from("waitlist")
    .insert({ email, source: "coming-soon", synced_at: synced ? new Date().toISOString() : null });

  // 23505 is unique_violation: already on the list, which is a success for them.
  if (insertErr && insertErr.code !== "23505") {
    console.error("insert failed", insertErr);
    return json({ error: "server_error" }, 500, origin);
  }

  // Cheap opportunistic cleanup so the ledger never grows unbounded.
  if (Math.random() < 0.02) await db.rpc("prune_waitlist_attempts");

  return json({ ok: true }, 200, origin);
});
