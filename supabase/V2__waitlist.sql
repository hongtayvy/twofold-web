-- Pre-launch waitlist for the marketing site (twofold-web).
--
-- WHERE THIS BELONGS: copy into twofold-business at
--   src/main/resources/db/migration/V2__waitlist.sql
-- so the schema stays tracked by Flyway. You share one Supabase Postgres across
-- app / api / web, so creating this by hand in the dashboard would be silent drift.
--
-- ACCESS MODEL
-- Writes arrive through the `waitlist` Edge Function, which holds the service role
-- key. The browser never touches these tables, so anon gets NO policies at all and
-- RLS denies it by default. That is strictly safer than an open anon INSERT: it lets
-- us rate limit, verify a honeypot, and validate server side before anything lands.

create table if not exists public.waitlist (
    id         uuid        primary key default gen_random_uuid(),
    email      text        not null,
    source     text        not null default 'coming-soon',
    -- Set once the address has been handed to the email provider, so a later
    -- backfill can find rows that never made it across.
    synced_at  timestamptz,
    created_at timestamptz not null default now()
);

-- One row per address, case insensitive. A repeat signup trips this; the function
-- treats it as success, because "you are already on the list" beats an error.
create unique index if not exists waitlist_email_lower_idx
    on public.waitlist (lower(email));

-- Lets the backfill job find un-synced rows cheaply.
create index if not exists waitlist_unsynced_idx
    on public.waitlist (created_at) where synced_at is null;

-- Rate limiting ledger. Stores a SALTED HASH of the IP, never the address itself,
-- so this is not a log of who visited the site.
create table if not exists public.waitlist_attempts (
    id         bigserial   primary key,
    ip_hash    text        not null,
    created_at timestamptz not null default now()
);

create index if not exists waitlist_attempts_lookup_idx
    on public.waitlist_attempts (ip_hash, created_at desc);

-- RLS on, zero policies. Only the service role reaches these tables.
alter table public.waitlist          enable row level security;
alter table public.waitlist_attempts enable row level security;

-- Any policy from an earlier draft that allowed the browser to write directly.
drop policy if exists waitlist_anon_insert on public.waitlist;

-- Housekeeping: the attempts ledger only needs a rolling window. Call from the
-- Edge Function or a scheduled job; either way it stays small on its own.
create or replace function public.prune_waitlist_attempts()
returns void
language sql
security definer
set search_path = public
as $$
    delete from public.waitlist_attempts where created_at < now() - interval '24 hours';
$$;
