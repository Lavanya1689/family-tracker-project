-- Nestly — Phase 1 schema
-- Single-household app (no multi-tenant / RLS needed yet): API routes talk to
-- Supabase with the service role key. Run this once against a fresh project
-- via the SQL editor, or `supabase db push` if you're using the CLI.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- kids: real names come from KIDS env config at seed time, never hardcoded.
-- color_key drives the per-kid UI color (blue/orange) from the prototype.
-- ---------------------------------------------------------------------------
create table if not exists kids (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color_key text not null check (color_key in ('a', 'b')),
  context text, -- e.g. "2nd grade at May Watts Elementary" — helps Gemini attribute items
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- oauth_tokens: server-held Google refresh token so cron jobs can read Gmail
-- without a user present. Singleton per provider (one household, one inbox).
-- ---------------------------------------------------------------------------
create table if not exists oauth_tokens (
  provider text primary key,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- gmail_messages: dedupe ledger. A message id present here has already been
-- sent to Gemini — reprocessing must check this table first and skip, rather
-- than relying on item-level dedupe. Only metadata is stored, never the body.
-- ---------------------------------------------------------------------------
create table if not exists gmail_messages (
  id uuid primary key default gen_random_uuid(),
  gmail_message_id text not null unique,
  sender text not null,
  subject text not null,
  received_at timestamptz not null,
  processed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ics_feeds: external calendars ingested as a structured source (school
-- district, activities, a parent's work calendar via private ICS link).
-- ---------------------------------------------------------------------------
create table if not exists ics_feeds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  kid_id uuid references kids(id) on delete set null,
  last_fetched_at timestamptz,
  last_etag text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- items: the unified extracted/ingested record behind both the Today view
-- and the published ICS feed. Every item must carry provenance — the UI must
-- never show one without a source label.
-- ---------------------------------------------------------------------------
create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('event', 'deadline', 'action_item')),
  title text not null,
  description text,
  category text, -- school | daycare | activity | event
  kid_id uuid references kids(id) on delete set null,

  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean not null default false,
  due_at timestamptz,

  status text not null default 'needs_attention'
    check (status in ('needs_attention', 'scheduled', 'handled')),

  source_type text not null check (source_type in ('gmail', 'ics', 'manual')),
  gmail_message_id text references gmail_messages(gmail_message_id) on delete cascade,
  ics_feed_id uuid references ics_feeds(id) on delete cascade,
  ics_uid text, -- the ICS event UID, stable across refetches of the same feed

  -- shown in the UI, e.g. "From Brightwheel email · Tuesday"
  provenance_label text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Refetching an ICS feed must upsert on (feed, uid), not append duplicates.
create unique index if not exists items_ics_dedupe
  on items (ics_feed_id, ics_uid)
  where ics_feed_id is not null;

create index if not exists items_status_idx on items (status);
create index if not exists items_starts_at_idx on items (starts_at);
create index if not exists items_due_at_idx on items (due_at);
create index if not exists items_kid_id_idx on items (kid_id);

-- ---------------------------------------------------------------------------
-- push_subscriptions: browser Push API subscriptions for PWA notifications.
-- One household, but multiple devices (each parent's phone) can subscribe.
-- ---------------------------------------------------------------------------
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Seed kids from placeholders — replace with real names via KIDS env or
-- directly in this table. Safe to run once; skipped if already seeded.
-- ---------------------------------------------------------------------------
insert into kids (name, color_key, context)
select * from (values
  ('Vihaan', 'a', '2nd grade at May Watts Elementary'),
  ('Aanya', 'b', 'Little Sprouts daycare')
) as seed(name, color_key, context)
where not exists (select 1 from kids);
