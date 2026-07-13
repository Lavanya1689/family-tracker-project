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
- `nestly-prototype.html` in this repo is the approved UI direction. Match its look:
  Space Grotesk headings, Inter body, pine green (#0E4F45) brand, amber (#B45309)
  reserved exclusively for "needs attention," per-kid colors (blue/orange).
- Signature UX rule: every AI-extracted item shows its provenance
  ("From Brightwheel email · Tuesday"). Never show an extracted item without its source.

## Phase 1 scope (current — build ONLY this)
1. Gmail OAuth (readonly) + fetch recent emails from watched senders only
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
- Gmail scanning (see 2026-07-08 decisions below): WATCH_SENDERS mail always
  reaches Gemini. Everything else in the primary inbox also reaches Gemini —
  its own extraction judgment (already instructed to return nothing for
  non-actionable content) decides relevance, not a keyword list — except
  bulk/marketing mail (List-Unsubscribe header present), which is excluded
  before ever reaching the model. That exclusion is the one gate that must
  never be bypassed; everything else is intentionally sent to Gemini.
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
- WATCH_SENDERS: comma-separated sender domains (brightwheel.com, ipsd.org, etc.) —
  mail from these always goes to Gemini even if it looks like bulk mail
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
