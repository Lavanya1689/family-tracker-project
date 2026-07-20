# Nestly

AI-powered family organizer. Reads school/daycare emails from Gmail, extracts events,
deadlines, and action items with Gemini, syncs them to Google Calendar, and surfaces
a "needs attention" view for parents. Built by a two-person team (~10-15 hrs/week),
side project, cost-sensitive — free tiers everywhere possible.

## Stack (decided — do not re-litigate)
- **Next.js** (App Router) — web app + API routes, deploy on Vercel free tier
- **Supabase** — Postgres + auth (free tier)
- **Gemini API** — email/document extraction (developer already uses Gemini at work)
- **Google APIs** — Gmail readonly + Calendar events scopes
- Web app first, mobile-responsive. No localStorage for state. Native app
  shell (Capacitor, wrapping the live hosted site — see 2026-07-10 decision)
  added on top of, not instead of, the web app.

## Design reference
- `nestly-prototype.html` is superseded by the 2026-07-13 redesign (see decisions
  log) — kept in the repo for history, don't match its colors/type anymore.
- Current direction: ink-navy (#1E2B3C light / #F0ECE0 dark) for structure,
  marigold (#BE8A2E / #E5B462) as the one decorative brand accent, sticky-note
  red (#D14E2E / #FF8259) reserved exclusively for "needs attention" (same rule
  as before, just recolored from amber), moss green (#3F6B5C / #7FBBA3) for
  scheduled/calendar indicators, dusty marker-pen per-kid colors (denim blue /
  plum) instead of flat blue/orange. Bricolage Grotesque headings, IBM Plex Sans
  body, IBM Plex Mono for timestamps/counts — loaded via `next/font/google` in
  `app/layout.tsx`. All colors are CSS custom properties in `app/globals.css`
  (`--ink`, `--brand`, `--urgent`, `--scheduled`, `--kidA`/`--kidB`, etc.) —
  never hardcode a hex value in a component; both light and dark values already
  exist for every token.
- Signature UX rule: every AI-extracted item shows its provenance
  ("From Brightwheel email · Tuesday"). Never show an extracted item without its source.

## Phase 1 scope (current — build ONLY this)
1. Gmail OAuth (readonly) + fetch recent primary-inbox emails
2. Gemini extraction -> structured items in Supabase (see feature spec for fields)
3. ICS ingestion: subscribe to external ICS feeds (school district, activities,
   parents' work calendars via private ICS links) as the primary structured source
4. ICS publishing: expose Nestly items as a private, unguessable ICS feed URL that
   the parents subscribe to in Apple/Google Calendar
5. Today view (needs-attention cards + today's events) using the prototype UI
6. Nav shell (sidebar/mobile tabs) matching the prototype, linking Today/Week/Lists
7. Week view: items grouped by day for a rolling 7-day window
8. Lists: user-created to-do lists (generic, Microsoft To Do-style — Grocery
   is just the first one, not hardcoded) + shared tasks (owner + due date +
   priority + balance) + reminders (push-notified at their set time) —
   manual add/check only, no AI photo scanning
9. PWA support: manifest, icons, service worker, web push notifications
   (mobile = add-to-home-screen, plus a Capacitor native shell — see
   2026-07-10 decision — for App Store/Play Store presence)

Explicitly OUT of phase 1: digest emails (weekly per-kid synthesis), RSVP tracking,
fridge-photo scanning, teen accounts, document upload. These are phases 2-3 in the
feature spec. Do not build them yet, even partially.

## Hard rules
- Gmail scanning (see 2026-07-08 and 2026-07-20 decisions below): every
  email in the primary inbox reaches Gemini. Its own extraction judgment
  (instructed to return nothing for non-actionable content, including pure
  marketing) decides relevance — no sender allowlist, no keyword list, no
  header-based pre-filter that excludes mail before the model sees it.
  A List-Unsubscribe header is passed to the model as one signal, not a
  gate (real invitation/mailing-list senders carry it same as marketing
  does). Do not reintroduce a pre-Gemini exclusion rule or a
  hand-maintained sender list to work around a relevance miss — fix the
  extraction prompt instead; this was explicitly rejected twice now
  (WATCH_SENDERS retired 2026-07-20 for exactly this reason).
- Never store raw email bodies in the database. Store extracted structured data +
  message ID + subject + sender only.
- Dedupe on Gmail message ID, the email's RFC822 Message-ID, and a
  sender+subject+time-window fallback (some senders — e.g. a school mailing
  list — generate a distinct Message-ID per recipient for what's really the
  same email, so RFC822 alone doesn't catch it). Reprocessing or a second
  account seeing the same email must not create duplicate items.
- Kid names in code/seed data are placeholders (Aarav, Diya) — real names come
  from user config, never hardcoded.
- Secrets live in .env only. credentials.json and token.json are gitignored.
- Keep Gemini calls cheap: batch where possible, use flash-tier models, skip
  irrelevant emails before calling the model.

## Environment
- KIDS: name:context pairs to help the model attribute items to the right child
- PARENTS: comma-separated parent names for task assignment (e.g. "Lav,Harsha")
- google_accounts (DB table, not env): one row per connected Gmail account —
  connect via /api/auth/google/start?label=Name, each parent authorizing their own
- See .env.example for the full list

## Decisions log (append here as we settle things)
- 2026-07: Name chosen: Nestly. Manual upload path (not scraping) for ParentVUE/
  Brightwheel content that doesn't arrive by email. No SMS reading — screenshot
  upload instead.
- 2026-07: Calendar strategy: ingest ICS feeds as primary structured source; publish
  Nestly as a private ICS feed for phone subscription. Google Calendar write API
  deferred — not needed in phase 1.
- 2026-07: Mobile = PWA (add to home screen + web push). Native app / App Store
  deferred to stage 3, and only alongside a subscription tier. (Superseded
  2026-07-10 — see below.)
- 2026-07-07: Pulled Week view and Lists (grocery/tasks/reminders) into phase 1
  after reviewing the built Today view against nestly-prototype.html — the nav
  shell felt incomplete with only one screen reachable. Digest, RSVP tracking,
  fridge-photo scanning, teen accounts, and document upload remain deferred.
- 2026-07-08: Relaxed the WATCH_SENDERS-only rule and added multi-account Gmail
  support. Reasoning: school mail wasn't the only actionable stuff arriving —
  invitations, dues, payments from unlisted senders were being missed, and only
  one parent's inbox was ever read. Each parent connects their own Gmail via
  /api/auth/google/start?label=Name (their own OAuth consent — not something
  done on their behalf). Cross-account dedup added via the email's RFC822
  Message-ID since Gmail's own message id is mailbox-scoped.
- 2026-07-08 (later same day): First cut used a local keyword pre-filter
  (invite/due/payment/etc) to gate non-watched-sender mail before it reached
  Gemini. Dropped it — it was both too loose (matched "$", "expires" on pure
  marketing spam) and too rigid (missed real things that didn't happen to use
  those words). Replaced with: bulk-mail exclusion (List-Unsubscribe header)
  is the only pre-Gemini gate for non-watched senders; Gemini's own extraction
  judgment decides relevance for everything else. Also found mailing-list
  sends can give the same email a different Message-ID per recipient, so
  RFC822 dedupe got a sender+subject+time-window fallback.
- 2026-07-10: Generalized the hardcoded Grocery list into user-created
  to-do lists (todo_lists/todo_items tables) — Grocery is now just the
  first list, not a special case. Added due_date + priority to tasks.
  Reminders now actually push-notify at their remind_at time via a new
  /api/cron/reminders endpoint + ingestReminders(), rather than just sitting
  in a passive list — needs an external scheduler hitting it every 15-30 min
  (Vercel Hobby cron is daily-only, same constraint already hit for Gmail
  sync). Added an editable Gemini extraction prompt: app_settings.gemini_
  custom_instructions, set from a new /settings page, layered on top of
  (not replacing) the built-in extraction rules for every email scanned.
  Native mobile app, real accounts/permissions/sharing/invitations, an
  onboarding wizard, and goal tracking (week/month/year/career) were raised
  in the same request but explicitly deferred — user chose "quick wins
  first"; those need their own scoping pass before any implementation.
- 2026-07-10 (same day): Started native app work, reversing the "deferred to
  stage 3 + subscription tier" decision above at the user's direct request.
  Approach: Capacitor wraps the live hosted site in a native WebView shell
  (capacitor.config.ts, server.url) rather than a rewrite or a bundled
  static build — Nestly is server-rendered (Server Actions, API routes,
  live Supabase/Gemini/Gmail calls), so there's no static bundle to ship,
  and this reuses the app as-is. ios/ and android/ platform projects
  scaffolded (@capacitor/core+cli+ios+android pinned to 7.6.7 — 8.x
  requires Node >=22, this machine has 20). Android is fully synced.
  iOS needs `pod install`, which needs full Xcode (only Command Line Tools
  present) — that's a multi-GB App Store install tied to the user's own
  Apple ID, so it wasn't done here. Before this can actually ship: install
  Xcode, enroll in the Apple Developer Program ($99/yr) and Google Play
  Console ($25 one-time), set capacitor.config.ts's server.url to the real
  Vercel domain, add app icons/splash assets, test on simulator/device,
  and submit for store review. The original doc tied native to a paid
  tier because $99/yr only pencils out against revenue — that tension
  wasn't re-litigated, just deferred to whoever decides to actually pay
  for and submit the app.
- 2026-07-13: Replaced HTTP Basic Auth with Supabase Auth (Google sign-in,
  email-allowlisted via ALLOWED_EMAILS) as the login system. Reasoning:
  Basic Auth's browser-native 401 dialog has no UI in a standalone iOS PWA,
  so re-authentication forced a delete-and-reinstall cycle that also dropped
  the push subscription each time — a real /login page sidesteps that
  entirely since it's just a page, not a browser challenge. Also matches how
  actual family apps (Cozi, FamilyWall) work: real per-person sign-in
  against one shared household, not a shared password. Reuses the existing
  Gmail OAuth client (GOOGLE_CLIENT_ID/SECRET) for the Google provider in
  Supabase rather than creating a second one — just needed Supabase's
  callback URL added to that client's Authorized redirect URIs. Still a
  single-household app (no per-user data, no RLS) — the allowlist is purely
  a gate on who can sign in, not a permissions model. BASIC_AUTH_USER/PASS
  retired. Also added PNG PWA icons (previously SVG-only, which iOS ignores
  for the home-screen icon) and a Settings-page status panel (push
  subscription count, last sync/reminder-run timestamps, a "send test
  notification" button) so push delivery can be verified on demand instead
  of debugged blind. Setup/onboarding UI (kids/senders/ICS feeds currently
  still via .env + SQL) and general UI polish (optimistic updates, less
  "static" feel) were explicitly scoped out of this pass — deferred to a
  follow-up once the login+push loop is confirmed working end-to-end.
- 2026-07-13 (later same day): Rebranded off the original pine-green +
  amber prototype — the built app read as flat and generic ("static", "UI
  colour is not looking great"). Checked real references before designing:
  Cozi (mentioned as inspiration) turned out to look dated in current
  reviews, not a good target; pulled actual Fantastical App Store
  screenshots (not just written descriptions) and borrowed concrete moves
  from it — color-dot day density instead of a bare "Today" label, a solid
  gradient block for the single most-urgent item instead of a flat row.
  New direction: ink-navy structure, marigold brand accent, sticky-note red
  still exclusively for needs-attention (recolored, same rule), moss green
  for scheduled items, dusty marker-pen kid colors. Bricolage Grotesque /
  IBM Plex Sans / IBM Plex Mono via next/font/google, replacing the old
  Space Grotesk/Inter <link>-tag loading. Iterated live with the user via a
  throwaway HTML mockup (Claude artifact) before touching any app code —
  cheaper to react to than redeploying the real app each round. Landed on:
  a week strip (color dots per kid per day, reusing lib/week.ts's existing
  getWeekData(), no new backend logic), category + source icon badges on
  needs-attention cards (lib/category-icon.tsx; envelope/calendar/pencil
  icon by source_type), and the hero-card treatment. Scoped to the Today
  view + the shared CSS token system (which also recolors Schedule/Lists
  automatically, since they read the same --ink/--brand/--urgent/etc.
  variables) — did NOT extend the new structural elements (week strip,
  hero card, badges) to Schedule/Lists' own markup, and did NOT build
  kid progress rings, a full empty-state illustration family, or
  stacked-card grouping animation — all offered as options and explicitly
  not picked; follow-ups if wanted later. `nestly-prototype.html` is now
  stale (kept for history, not the design reference anymore).
- 2026-07-13 (later still): Removed the week strip added earlier the same
  day — user pointed out /schedule already has proper Day/Week/Month views
  (app/schedule/page.tsx), so a second, weaker dots-only week preview on
  Today was redundant, not additive, and had no legend or interactivity to
  justify the space. Deleted app/components/WeekStrip.tsx and its CSS;
  Today stays focused on needs-attention + today's events only. The rest
  of the rebrand (colors, fonts, hero card, category/source badges)
  stands.
- 2026-07-14: Added item comments (targeted push) and a read-only AI
  assistant. Comments needed a prerequisite: push_subscriptions had no
  concept of which signed-in user owns a device, so notifications could
  only ever broadcast to everyone — added push_subscriptions.user_email
  (set in app/api/push/subscribe/route.ts, which is now auth-checked
  in-handler since middleware's matcher excludes /api) and
  lib/push.ts's sendPushToOthers, so posting a comment notifies the other
  parent's devices, not your own. New item_comments table, scoped to
  needs-attention items only for v1 (AttentionCard.tsx) — Schedule/
  TimelineItem comments are a natural follow-up, not built yet. The AI
  assistant (app/assistant/page.tsx, "Ask" in the nav) is explicitly
  read-only — answers questions grounded in real current item data
  (lib/assistant.ts inlines all non-handled items into the prompt, same
  small-volume-so-no-RAG-needed reasoning lib/gemini.ts already uses for
  extraction) but has no tool-calling/mutation path at all, enforced by
  there being nothing wired up for it to call, not just a prompt
  instruction. Chat history is session-only (client React state, lost on
  refresh) — no new table for messages, kept deliberately simple. Both
  decisions (read-only, session-only) were explicit trade-offs against a
  bigger build (tool-calling agent, persisted cross-device chat) — could
  revisit either later if the simpler version proves limiting.
- 2026-07-14: Started multi-household support — reverses this file's
  earlier "single-household app (no per-user data, no RLS)" framing, at
  the user's explicit request after being warned this was a genuine
  multi-tenancy rewrite (every table needs a household_id) rather than an
  incremental feature, and that "real accounts/permissions/sharing/
  invitations" had already been flagged and deferred once (2026-07-10
  entry above) pending "its own scoping pass" — this is that pass.
  Decided: invites are a shareable link (household_invitations.token),
  not sent email — no new infrastructure, same pattern the ICS feed
  publish endpoint already uses. One household per user, no
  switcher UI — enforced by a unique index on household_members.user_email.
  Still no RLS — household_id is enforced in application code via
  supabaseAdmin() (service role), never the anon key, matching how the
  app already worked. Phase A (schema: households/household_members/
  household_invitations, household_id added to every existing table,
  app_settings restructured from a singleton `id boolean` row — which
  can't hold more than one real row — to one row per household) and
  Phase B (auth: /auth/callback checks household_members instead of
  ALLOWED_EMAILS, /onboarding for first-time sign-ins with no household,
  /invite/[token] for accepting one) are done; migrated the existing
  installation's data via scripts/migrate-to-households.ts (one-time,
  safe to re-run — skips if a household already exists).
  Known gap, explicit and temporary: lib/household.ts's
  getSoleHouseholdId() is an interim stand-in everywhere a real
  per-household loop belongs (the three cron jobs, the ICS feed publish
  token lookup) — correct today because there is exactly one household,
  wrong the moment a second one exists. Most page-level data reads
  (today.ts, week.ts, month.ts, lists.ts, todo-lists.ts, comments.ts,
  assistant.ts, push.ts's broadcast functions) are similarly still
  unscoped by household_id — safe for the same single-household-today
  reason, not yet safe for real multi-tenancy. This remaining query-
  scoping work, the members-list UI polish (last-sign-in, nicer
  invite-link presentation), and @mentions are not built yet — next up.
  Also: the second family member was an active user under the old
  ALLOWED_EMAILS model but is NOT YET in household_members post-migration
  (only the account that ran the migration script was auto-added) —
  deliberately left for them to join via a real invite link rather than
  the assistant inferring their identity from app data and adding them
  directly, per an explicit permission denial during this work (personal
  email addresses shouldn't be written into this file regardless — it's
  committed to a public repo). They must not sign in again until sent
  that invite, or they'll be routed into onboarding and create a second,
  wrong household.
- 2026-07-15: Fixed a real bug found testing the invite flow live:
  middleware.ts required a signed-in session for every path except
  /login and /auth, but /invite/[token] is exactly how a brand-new person
  accepts an invite *before* signing in — an unauthenticated click was
  being redirected to /login before the invite cookie ever got set,
  silently defeating the whole flow. Added /invite to the matcher's
  exclusion list.
- 2026-07-15 (later): Built a proper multi-step "Set up your family"
  onboarding wizard (app/onboarding/page.tsx) — name, then add kids,
  then connect Gmail (with plain-language consent copy: what's read,
  what's stored, that it's per-person and optional), then invite your
  partner — replacing the old one-field "create a household" form.
  Modeled on real onboarding flows from Cozi and Maple (screenshots the
  user pulled up live), reimplemented in Nestly's own visual language
  (icon + eyebrow + headline + body + CTA per step), not copied.
  Prerequisite: kids finally have a real UI (lib/kids.ts, addKidAction/
  deleteKidAction) — previously only addable via raw SQL since day one.
  That surfaced a latent bug: kids.color_key was hard-capped at ('a','b')
  from the original single-household seed data, silently blocking a real
  third kid; expanded to 4 slots (a-d) with 2 new marker-pen CSS tokens
  (--kidC olive, --kidD rust).
  Also added, same session: a manual "Add event" feature (AddEventModal
  component, addManualItem action) — Nestly previously had zero way to
  add anything without an email or ICS feed triggering it, a real gap
  once compared against Cozi/Maple's manual-entry-first design. A 9am
  daily digest push (lib/digest.ts), piggybacked on the existing 15-min
  reminders cron rather than new infrastructure — checks local hour via
  a new getLocalHour() timezone helper (DST-safe, no UTC-offset math)
  plus a per-household "already sent today" date guard so only the first
  cron run inside the 9 o'clock hour actually sends. And a refresh
  button on Today (RefreshButton.tsx, router.refresh()) after the user
  asked why nothing updates without a manual reload.
  Diagnosed live during this same session: Gmail sync had silently
  stopped (invalid_grant/token expired) — root cause is Google's
  OAuth "Testing" publish status auto-expiring refresh tokens after 7
  days regardless of activity, not a code bug; the only real fixes are
  periodic re-auth or pursuing Google's app verification to leave
  Testing status (not done). Unrelated to the auth/household work
  despite surfacing in the same conversation — Gmail reading uses its
  own separate OAuth grant (lib/google.ts) from the app's own login.
- 2026-07-16: Found and fixed the 9am digest never actually firing —
  `getLocalHour(now) !== 9` required a cron run to land inside the exact
  9 o'clock hour, but the GitHub Actions `schedule` trigger backing the
  15-min reminders cron (reminders-cron.yml) is only best-effort: GitHub
  deprioritizes/delays scheduled runs on low-traffic repos, and today's
  runs actually landed roughly 1-3 hours apart (confirmed via the Actions
  API — a real gap from 12:59 to 15:09 UTC swallowed 9am Chicago whole).
  Changed the guard to `< 9` (fire on the first run at-or-after 9am, not
  only inside that hour) so a sparse cron still catches up same-day
  instead of silently skipping the digest. Also implemented Phase E of
  the household plan (@mentions in comments, previously deferred):
  typing "@name" in a comment (CommentForm.tsx) autocompletes against the
  item's household members (display name = email's local part, same as
  already shown next to each comment) and, on submit, addComment resolves
  those tokens (lib/comment-format.ts's resolveMentions) to notify only
  the people actually named (new sendPushToUsers in lib/push.ts) instead
  of the previous broadcast-to-everyone-else; a comment with no
  recognized mention keeps the old broadcast behavior unchanged. Past
  comments render recognized @tokens highlighted (CommentPanel.tsx);
  unrecognized "@"s (e.g. a pasted email address) are left as plain text.
- 2026-07-20: Gmail/ICS sync moved from daily-only to roughly-hourly, at
  the user's explicit request after noticing a 2-day gap with nothing
  surfacing. Root cause: Vercel Hobby's cron only allows daily schedules,
  so vercel.json's `/api/cron/sync` trigger (0 12 * * *) was the only
  thing calling it — anything arriving after that one daily run sat
  unprocessed for up to 24h. Added .github/workflows/gmail-sync-cron.yml
  (same free-GitHub-Actions pattern as reminders-cron.yml, hourly
  schedule), left the Vercel daily cron in place as a baseline — both
  hitting the same endpoint is safe since ingestGmail/ingestIcsFeeds
  dedupe on message id/uid. Per the digest bug found 2026-07-16, GitHub's
  `schedule` trigger is only best-effort on low-traffic repos and can lag
  by an hour or more, so this is "roughly hourly," not exact.
- 2026-07-20 (same day): Added upcoming-event push alerts (lib/event-
  alerts.ts) — a timed, scheduled event (all_day=false) now pushes
  "Starting soon: X" once its start falls within 60 minutes, piggybacked
  on the same ~hourly reminders cron as the digest (no new
  infrastructure). New items.start_alert_sent_at column prevents
  re-alerting every cron run while inside that window; a 4-hour stale
  cutoff on the other side stops a long cron gap from surfacing alerts
  for events already well over. All-day events are intentionally
  excluded — no specific time to count down to, and they already surface
  on Today/the calendar feed. Also found and fixed why Evite reminder
  emails were never showing up as items at all: they carry a
  List-Unsubscribe header like any mass sender, so the bulk-mail gate
  (the one pre-Gemini filter that's supposed to only catch marketing
  spam) was silently dropping them before Gemini ever got a chance to
  judge relevance — confirmed via gmail_messages having zero record of
  any evite.com sender ever, even as "skipped." First fix attempt added
  evite.com to WATCH_SENDERS — the user immediately rejected that
  ("I don't want to keep adding websites or emails to watch senders...
  I want to use Gemini intelligence"), correctly pointing out it was the
  same hardcoded-list mistake in a new spot, not an actual fix. Reversed
  within the hour: removed the bulk-mail pre-Gemini gate entirely (and
  WATCH_SENDERS along with it — nothing else depended on it once the
  gate was gone, so kept it around would've been a dead, misleading
  env var). Every email now reaches Gemini; List-Unsubscribe is passed
  into the extraction prompt as one signal to weigh, not a filter that
  excludes before the model ever sees the content. See the Hard rules
  section above, which now explicitly forbids reintroducing this kind
  of pre-Gemini exclusion list.
- 2026-07-20 (later still): Removing the bulk-mail gate surfaced a real
  constraint that the gate had been accidentally hiding: Gemini's free
  tier caps gemini-2.5-flash at 5 requests/minute. With every email now
  reaching the model instead of ~5% of them, a single sync run (50 email
  candidates) threw 429 Too Many Requests for the large majority of
  calls — including legitimate mail losing the race against marketing
  for the same 5-per-minute budget, confirmed via a local run
  (emailsProcessed: 6, emailsFailed: 30). Vercel Hobby's 60s function
  timeout rules out just slowing down to clear a big backlog in one run.
  Fixed with a per-run cap (MAX_EXTRACTIONS_PER_RUN = 4 in
  lib/ingest-gmail.ts) — capped emails aren't marked processed, so
  they're retried (with a real extraction attempt) on the next
  roughly-hourly run rather than lost or silently treated as
  irrelevant. A proper batched-prompt rewrite (many emails per Gemini
  call, cutting request count rather than just capping it) or enabling
  billing on the Gemini project would both remove the cap entirely —
  neither done here; flagged as the real follow-up if the 4/run ceiling
  ever causes a backlog that doesn't clear.
  Same session: extended the upcoming-event alert (added earlier the
  same day) from one lead time to two, at the user's request — "a day
  before and an hour before." Redesigned before the single-column
  version was ever migrated: items.start_alert_sent_at replaced with
  day_before_alert_sent_at / hour_before_alert_sent_at (lib/event-
  alerts.ts now loops a small rule list instead of one hardcoded
  window), so only one SQL migration is needed, not two.
- 2026-07-20 (later still): Fixed the "view email" mail icon opening the
  wrong Gmail account — it hardcoded /mail/u/0/ (the browser's first
  Google account), so a message from the other parent's connected
  inbox would fail to open correctly. lib/today.ts now also maps
  gmail_message_id -> account_email (gmail_messages already stores
  this) and the link uses that account's email in place of the index,
  which Gmail's URL accepts directly.
- 2026-07-20 (later still): Added an in-app email preview — clicking a
  Needs Attention card's title/description now fetches the real email
  body live from Gmail (app/actions.ts's getEmailPreview, reusing
  lib/google.ts's fetchEmailContent that extraction already uses) and
  shows it in a modal, instead of requiring a trip to Gmail just to
  read the source. Deliberately never persisted anywhere — fetched
  fresh on each click, nothing new written to gmail_messages — so this
  doesn't touch the hard rule against storing raw email bodies.
  "Open in Gmail" stays as a fallback for replying or viewing
  attachments (attachment filenames are shown, not rendered inline).
  Not yet wired up on the collapsed group-email header (only on
  individual item cards, including ones inside an expanded group) —
  natural follow-up if wanted.
