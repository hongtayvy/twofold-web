-- Pre-launch waitlist for the marketing site (twofold-web).
--
-- This is the canonical copy: Flyway owns the schema for the shared Supabase Postgres.
-- twofold-web/supabase/V2__waitlist.sql is a reference copy of this file. Keep them identical.
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

-- Housekeeping: the attempts ledger only needs a rolling window. Called by the Edge
-- Function so it stays small on its own.
create or replace function public.prune_waitlist_attempts()
returns void
language sql
security definer
set search_path = public
as $$
    delete from public.waitlist_attempts where created_at < now() - interval '24 hours';
$$;

-- Supabase exposes every function in `public` over its REST API, and new functions are
-- executable by anon by default. This one is security definer, so left alone anyone
-- holding the public anon key could wipe the rate limit ledger. Only the Edge Function
-- (service_role) may call it. Guarded so the migration also runs on a plain Postgres.
do $$
declare
    r text;
begin
    revoke all on function public.prune_waitlist_attempts() from public;
    foreach r in array array['anon', 'authenticated'] loop
        if exists (select 1 from pg_roles where rolname = r) then
            execute format('revoke all on function public.prune_waitlist_attempts() from %I', r);
        end if;
    end loop;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
        grant execute on function public.prune_waitlist_attempts() to service_role;
    end if;
end
$$;
