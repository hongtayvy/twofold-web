# TwoFold waitlist

Everything behind the email capture on `landing-concepts/twofold-coming-soon.html`.

```
browser  ->  Edge Function (waitlist)  ->  Postgres public.waitlist
                                       ->  email provider (Buttondown)
```

The page holds no credential. The function runs with the service role key and is the
only thing that touches the tables, which is what makes rate limiting and a server
side honeypot check possible.

---

## 1. Schema

`V2__waitlist.sql` creates `waitlist` and `waitlist_attempts`.

Copy it into **twofold-business** at `src/main/resources/db/migration/V2__waitlist.sql`
rather than running it in the Supabase dashboard. All three repos share one Postgres
and Flyway owns that schema; creating tables by hand is drift you will trip over later.

Both tables have RLS enabled and **no policies at all**, so anon is denied by default.

## 2. Deploy the function

```bash
supabase functions deploy waitlist --no-verify-jwt
```

`--no-verify-jwt` is required. Signups are anonymous by definition, so there is no
JWT to check.

## 3. Secrets

```bash
supabase secrets set IP_SALT="$(openssl rand -hex 32)"
supabase secrets set ALLOWED_ORIGINS="https://twofold.app,https://www.twofold.app"
supabase secrets set BUTTONDOWN_API_KEY="..."   # optional, see below
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform.

`IP_SALT` matters: the ledger stores a salted hash, never a raw IP, so it is a rate
limit counter rather than a log of who visited the site. Do not rotate it casually or
you reset everyone's window.

## 4. Point the page at it

In `twofold-coming-soon.html`, set:

```js
var WAITLIST_ENDPOINT = 'https://<project>.supabase.co/functions/v1/waitlist';
```

Until it is set the form shows an error and logs to the console. It never fakes
success, because silently losing signups is the one thing a holding page cannot do.

---

## Sending, and why it is the harder half

Capture is solved. Sending is the part that bites people, and it is mostly DNS and
patience rather than code.

### Records to add before you send anything

Your provider gives you the exact values. The shapes are:

| Record | Host | Purpose |
|---|---|---|
| TXT | `@` | SPF, e.g. `v=spf1 include:<provider> ~all` |
| CNAME | provider supplied | DKIM signing keys, usually two |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:you@twofold.app` |

Start DMARC at `p=none` so you collect reports without bouncing your own mail. Move
to `quarantine` then `reject` once the reports come back clean, typically a few weeks.

One SPF record per domain. If you already have one, merge the include into it rather
than adding a second, which silently breaks both.

### Warming, which is why the function forwards at signup

A brand new domain that has never sent anything, blasting its entire list on launch
day, is the textbook way to land in spam. That is exactly what a big cold export
produces, so the function subscribes people to the provider **as they sign up**.

Then:

1. Send something small and real every few weeks from launch of this page onward. A
   short progress note to a few hundred people is enough.
2. Keep volume climbing gradually rather than in one step.
3. Watch the bounce and complaint rates in the provider dashboard. Above roughly
   0.1% complaints, slow down.

By the time you actually launch, the domain has a track record and the invite email
goes to inboxes rather than spam.

### If the provider was down

The forward is best effort: a provider outage never fails the visitor's signup. Those
rows keep `synced_at = null`. Catch them up with:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... BUTTONDOWN_API_KEY=... \
  node supabase/scripts/backfill-provider.mjs
```

Safe to re-run. It skips anything already synced and treats a provider 409 as done.

### No provider yet

Leave `BUTTONDOWN_API_KEY` unset. Signups still land in Postgres; they simply keep
`synced_at = null` until you add the key and run the backfill. Nothing is lost, but
the warming clock does not start until then, so do it sooner rather than later.

---

## Abuse handling

| Guard | Where |
|---|---|
| Honeypot field | Checked in the browser and again in the function |
| Per-IP rate limit | 5 per hour on a salted IP hash |
| Email shape | Validated in the browser and the function |
| Duplicates | Case-insensitive unique index; treated as success |
| List readable from the page | No. Zero anon policies, no key in the page |

If it still gets abused, the next step is Cloudflare Turnstile: add the widget to the
form and verify the token inside the function before the rate limit check. That needs
a secret key, which the function can already hold.

## Reading the list

Never from a browser. Service role key only:

```bash
curl "$SUPABASE_URL/rest/v1/waitlist?select=email,created_at&order=created_at.desc" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

## Later: waitlist to invites

twofold-business already has an `Invite` domain (entity, status, repo, service,
controller, DTOs). When you open the doors, read `waitlist` and issue invites through
`InviteService` rather than emailing signup links by hand.
