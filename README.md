# twofold-web

The public website for TwoFold, the money app for couples: **twofoldfinance.com**.

Right now the site is a single coming-soon page with an email waitlist. The full
landing page is built and waiting in `landing-concepts/` until launch.

## What's where

| Path | What it is |
|---|---|
| `site/` | **What goes live.** `index.html` is the coming-soon page; `_headers` sets security headers. |
| `landing-concepts/twofold-ritual.html` | The full landing page for launch. Not deployed yet. |
| `brand/` | Brand kit: the folded "2" mark, colour and type prompts, and the icon pipeline. |
| `supabase/` | The waitlist backend (Edge Function, table, setup guide). |
| `wrangler.jsonc` | Tells Cloudflare to serve `site/` as a static website. |

## Run it locally

No build step. Any static server works:

```bash
python3 -m http.server 4174 --directory site
```

To run it exactly as Cloudflare will, with the security headers applied:

```bash
npx wrangler dev
```

## Deploy

Hosted on Cloudflare (Workers, static assets only). Cloudflare watches this repo and
redeploys on every push to `master`, so shipping a change is: merge into `master`.

## Before the waitlist goes live

The form shows an error until it is connected. Deploy the Supabase function and set
`WAITLIST_ENDPOINT` in `site/index.html`. Steps are in `supabase/README.md`.
