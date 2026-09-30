#!/usr/bin/env node
// Push waitlist rows that never reached the email provider.
//
// The Edge Function forwards each signup as it arrives, but that call is best
// effort on purpose: if the provider is down we still keep the signup rather than
// failing the visitor. Those rows land with synced_at = null. This catches them.
//
// Run:  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... BUTTONDOWN_API_KEY=... \
//         node supabase/scripts/backfill-provider.mjs
//
// Service role key only. Never put it anywhere the browser can reach.

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BUTTONDOWN_API_KEY } = process.env;
for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BUTTONDOWN_API_KEY })) {
  if (!v) { console.error(`Missing ${k}`); process.exit(1); }
}

const rest = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/waitlist`;
const auth = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` };

const pending = await fetch(`${rest}?synced_at=is.null&select=id,email&order=created_at.asc`, { headers: auth })
  .then((r) => r.json());

if (!Array.isArray(pending) || pending.length === 0) {
  console.log('Nothing to backfill.');
  process.exit(0);
}
console.log(`${pending.length} row(s) to sync.`);

let ok = 0, failed = 0;
for (const row of pending) {
  const res = await fetch('https://api.buttondown.com/v1/subscribers', {
    method: 'POST',
    headers: { Authorization: `Token ${BUTTONDOWN_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email_address: row.email, tags: ['waitlist'] }),
  });

  // 409 means the provider already has them, which still counts as synced.
  if (res.ok || res.status === 409) {
    await fetch(`${rest}?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ synced_at: new Date().toISOString() }),
    });
    ok++;
  } else {
    console.error(`  failed ${row.email}: ${res.status} ${await res.text()}`);
    failed++;
  }
  // Stay well under provider rate limits.
  await new Promise((r) => setTimeout(r, 250));
}
console.log(`Synced ${ok}, failed ${failed}.`);
