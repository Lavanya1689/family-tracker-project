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
-- google_accounts: server-held Google refresh tokens so cron jobs can read
-- Gmail without a user present. One row per connected parent — a household
-- can have more than one inbox watched (e.g. both parents' Gmail).
-- ---------------------------------------------------------------------------
create table if not exists google_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  label text not null, -- e.g. "Lav" or "Harsha" — shown in provenance when >1 account
  refresh_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- gmail_messages: dedupe ledger. A message id present here has already been
-- sent to Gemini — reprocessing must check this table first and skip, rather
-- than relying on item-level dedupe. Only metadata is stored, never the body.
-- rfc822_message_id (the email's own Message-ID header, shared across
-- mailboxes) catches the case where the same email lands in more than one
-- connected account, e.g. both parents CC'd on the same school email.
-- ---------------------------------------------------------------------------
create table if not exists gmail_messages (
  id uuid primary key default gen_random_uuid(),
  gmail_message_id text not null unique,
  rfc822_message_id text,
  account_email text,
  sender text not null,
  subject text not null,
  received_at timestamptz not null,
  processed_at timestamptz not null default now()
);

-- Idempotent column additions for databases created before multi-account
-- support existed — `create table if not exists` above is a no-op against
-- an already-existing gmail_messages table, so these run separately, and
-- must run before the index below that references rfc822_message_id.
alter table gmail_messages add column if not exists rfc822_message_id text;
alter table gmail_messages add column if not exists account_email text;

create unique index if not exists gmail_messages_rfc822_dedupe
  on gmail_messages (rfc822_message_id)
  where rfc822_message_id is not null;

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
  -- Why an item was marked handled: 'ignored' (not relevant) vs 'done' (I
  -- took care of it) — same practical effect (hidden everywhere), but
  -- distinct for the handled-items log on the Lists screen.
  dismissal_reason text check (dismissal_reason in ('ignored', 'done')),

  source_type text not null check (source_type in ('gmail', 'ics', 'manual')),
  gmail_message_id text references gmail_messages(gmail_message_id) on delete cascade,
  ics_feed_id uuid references ics_feeds(id) on delete cascade,
  ics_uid text, -- the ICS event UID, stable across refetches of the same feed

  -- shown in the UI, e.g. "From Brightwheel email · Tuesday"
  provenance_label text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotent column addition for databases created before this existed.
alter table items add column if not exists dismissal_reason text;
alter table items drop constraint if exists items_dismissal_reason_check;
alter table items add constraint items_dismissal_reason_check
  check (dismissal_reason in ('ignored', 'done'));

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
-- grocery_items: superseded by todo_lists/todo_items below (kept around only
-- so the one-time migration script has something to read from; not used by
-- the app anymore). Safe to drop manually once you've confirmed the
-- migration ran.
-- ---------------------------------------------------------------------------
create table if not exists grocery_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  aisle text,
  done boolean not null default false,
  added_by text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- todo_lists / todo_items: generic user-defined lists (Microsoft To
-- Do-style) — "Grocery" is just the first list, not a special case anymore.
-- No AI photo scanning or auto-rebalancing — add/check only, per the phase-1
-- scope decision in CLAUDE.md.
-- ---------------------------------------------------------------------------
create table if not exists todo_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists todo_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references todo_lists(id) on delete cascade,
  name text not null,
  notes text,
  done boolean not null default false,
  added_by text,
  created_at timestamptz not null default now()
);

create index if not exists todo_items_list_idx on todo_items (list_id);

-- ---------------------------------------------------------------------------
-- tasks: shared household tasks with owner + weekly balance tracking.
-- ---------------------------------------------------------------------------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  owner_name text not null,
  done boolean not null default false,
  due_date date,
  priority text check (priority in ('low', 'medium', 'high')),
  created_at timestamptz not null default now()
);

alter table tasks add column if not exists due_date date;
alter table tasks add column if not exists priority text;
alter table tasks drop constraint if exists tasks_priority_check;
alter table tasks add constraint tasks_priority_check
  check (priority in ('low', 'medium', 'high'));

-- ---------------------------------------------------------------------------
-- reminders: manual reminders that actually push-notify at remind_at (see
-- /api/cron/reminders) — notified_at guards against sending the same
-- reminder twice.
-- ---------------------------------------------------------------------------
create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  remind_at timestamptz not null,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table reminders add column if not exists notified_at timestamptz;

create index if not exists tasks_owner_idx on tasks (owner_name);
create index if not exists reminders_remind_at_idx on reminders (remind_at);

-- ---------------------------------------------------------------------------
-- app_settings: singleton row for user-editable configuration that used to
-- require an env var + redeploy — starting with custom Gemini extraction
-- instructions.
-- ---------------------------------------------------------------------------
create table if not exists app_settings (
  id boolean primary key default true check (id),
  gemini_custom_instructions text,
  updated_at timestamptz not null default now()
);

insert into app_settings (id) values (true)
on conflict (id) do nothing;

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
