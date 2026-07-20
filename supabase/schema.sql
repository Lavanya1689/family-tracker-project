-- Nestly — schema
-- Multi-household: every household-scoped table carries a household_id
-- (see the households/household_members/household_invitations block
-- below). Still no RLS — API routes talk to Supabase with the service
-- role key and scope every query by household_id in application code
-- instead. Run this once against a fresh project via the SQL editor, or
-- `supabase db push` if you're using the CLI. Existing installs
-- migrating from the old single-household model: see the app_settings
-- section below for the two-pass run order.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- households / household_members / household_invitations: multi-tenancy.
-- One household per user (enforced by the unique index on user_email below)
-- — no household-switcher UI, no multi-membership edge cases. Every other
-- table below is scoped to a household via a household_id column.
-- Invitations are a shareable link (household_invitations.token), not sent
-- email — same "private unguessable URL" pattern the ICS feed publish
-- endpoint already uses, no new email infrastructure needed.
-- ---------------------------------------------------------------------------
create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Replaces the old global ICS_PUBLISH_TOKEN env var — each household
  -- needs its own, or one leaks every household's events on one URL.
  ics_publish_token text not null unique,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_email text not null,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_email)
);

create unique index if not exists household_members_user_unique
  on household_members (user_email);

create table if not exists household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  token text not null unique,
  created_by text not null,
  created_at timestamptz not null default now(),
  accepted_by text,
  accepted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- kids: real names come from KIDS env config at seed time, never hardcoded.
-- color_key drives the per-kid marker-pen UI color. Four slots (a-d) —
-- was capped at two ('a','b') from the original single-household seed
-- data, which silently blocked a real third kid once families could add
-- their own via /onboarding instead of raw SQL.
-- ---------------------------------------------------------------------------
create table if not exists kids (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color_key text not null check (color_key in ('a', 'b', 'c', 'd')),
  context text, -- e.g. "2nd grade at May Watts Elementary" — helps Gemini attribute items
  created_at timestamptz not null default now()
);

alter table kids drop constraint if exists kids_color_key_check;
alter table kids add constraint kids_color_key_check check (color_key in ('a', 'b', 'c', 'd'));

alter table kids add column if not exists household_id uuid references households(id);
create index if not exists kids_household_idx on kids (household_id);

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

alter table google_accounts add column if not exists household_id uuid references households(id);
create index if not exists google_accounts_household_idx on google_accounts (household_id);

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
alter table gmail_messages add column if not exists household_id uuid references households(id);

create unique index if not exists gmail_messages_rfc822_dedupe
  on gmail_messages (rfc822_message_id)
  where rfc822_message_id is not null;
create index if not exists gmail_messages_household_idx on gmail_messages (household_id);

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

alter table ics_feeds add column if not exists household_id uuid references households(id);
create index if not exists ics_feeds_household_idx on ics_feeds (household_id);

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

alter table items add column if not exists household_id uuid references households(id);
create index if not exists items_household_idx on items (household_id);

-- Set once each lead-time push has gone out for a timed event, so the
-- ~hourly cron doesn't re-alert every run while an event is inside a
-- window, and the day-before and hour-before alerts fire independently of
-- each other. See lib/event-alerts.ts.
alter table items add column if not exists day_before_alert_sent_at timestamptz;
alter table items add column if not exists hour_before_alert_sent_at timestamptz;

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

-- Which signed-in user registered this device — lets a notification be
-- targeted at "the other parent" instead of broadcasting to everyone,
-- e.g. so you don't get pushed your own comment back. Nullable: rows from
-- before Supabase Auth existed have no user attached and stay
-- broadcast-eligible via sendPushToAll.
alter table push_subscriptions add column if not exists user_email text;
-- Must be scoped too — without this, once a second household exists in
-- the same database, one household's event would incorrectly push-notify
-- another household's devices via the broadcast functions.
alter table push_subscriptions add column if not exists household_id uuid references households(id);
create index if not exists push_subscriptions_household_idx on push_subscriptions (household_id);

-- ---------------------------------------------------------------------------
-- item_comments: lightweight per-item discussion thread ("can you grab
-- this pickup?") so coordinating about a specific item doesn't require
-- leaving the app. Posting notifies every other household member's
-- devices (see lib/push.ts's sendPushToOthers), not the author's own.
-- ---------------------------------------------------------------------------
create table if not exists item_comments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  author_email text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists item_comments_item_idx on item_comments (item_id);

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

alter table todo_lists add column if not exists household_id uuid references households(id);
create index if not exists todo_lists_household_idx on todo_lists (household_id);

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
alter table tasks add column if not exists household_id uuid references households(id);
create index if not exists tasks_household_idx on tasks (household_id);

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
alter table reminders add column if not exists household_id uuid references households(id);

create index if not exists tasks_owner_idx on tasks (owner_name);
create index if not exists reminders_remind_at_idx on reminders (remind_at);
create index if not exists reminders_household_idx on reminders (household_id);

-- ---------------------------------------------------------------------------
-- app_settings: was a singleton row (id boolean primary key — a boolean PK
-- literally cannot hold more than one real row) for user-editable
-- configuration; now one row per household. Existing installs: run this
-- file once now (adds household_id, nullable), run
-- scripts/migrate-to-households.ts (creates the household and backfills
-- household_id on the existing row and everywhere else), then run this
-- file again — the guarded block below only flips the primary key over
-- once every row actually has a household_id, so re-running before the
-- backfill script is a safe no-op.
-- ---------------------------------------------------------------------------
create table if not exists app_settings (
  id boolean primary key default true check (id),
  gemini_custom_instructions text,
  updated_at timestamptz not null default now()
);

-- Last-run timestamps for the three background jobs, surfaced on the
-- Settings page so "did my reminder not fire because the cron isn't
-- running, or because push itself is broken?" has a real answer instead of
-- guessing blind.
alter table app_settings add column if not exists last_gmail_sync_at timestamptz;
alter table app_settings add column if not exists last_ics_sync_at timestamptz;
alter table app_settings add column if not exists last_reminders_run_at timestamptz;
-- Tracks the household's local calendar date (not a timestamp) the daily
-- digest last went out for — piggybacks on the existing 15-min reminders
-- cron rather than new infrastructure; the cron checks local hour == 9
-- and this date to fire exactly once per day without DST-aware UTC math.
alter table app_settings add column if not exists last_digest_sent_date date;

alter table app_settings add column if not exists household_id uuid references households(id);

-- No default-row insert here anymore (the old singleton always seeded
-- one via `insert ... values (true) on conflict do nothing`) — a fresh
-- install has no household yet to own that row, and it would sit forever
-- as an orphaned household_id-null row nothing ever backfills. Each
-- household's app_settings row is created by /onboarding when the
-- household itself is created (Phase B), and the existing production
-- row is backfilled by scripts/migrate-to-households.ts below.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'app_settings' and column_name = 'id'
  ) and not exists (
    select 1 from app_settings where household_id is null
  ) then
    alter table app_settings drop constraint if exists app_settings_pkey;
    alter table app_settings alter column household_id set not null;
    alter table app_settings add primary key (household_id);
    alter table app_settings drop column id;
  end if;
end $$;

-- Placeholder-kid seeding removed now that kids belong to a household
-- (household_id): a fresh install has no household to attach them to
-- until someone actually signs in and creates one via /onboarding, so
-- seeding here would only ever produce orphaned, invisible rows. Add kids
-- through the app once a household exists instead.
