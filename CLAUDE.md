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
- Web app first, mobile-responsive. No native app in phase 1. No localStorage for state.

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
5. Simple Today view (needs-attention cards + today's events) using the prototype UI
6. PWA support: manifest, icons, service worker, web push notifications
   (mobile = add-to-home-screen, no native app)

Explicitly OUT of phase 1: digest emails, grocery lists, task sharing/balance,
RSVP tracking, reminders, fridge-photo scanning, teen accounts, document upload.
These are phases 2-3 in the feature spec. Do not build them yet, even partially.

## Hard rules
- Only process emails whose sender matches WATCH_SENDERS (env var). Never send
  arbitrary personal email content to the model.
- Never store raw email bodies in the database. Store extracted structured data +
  message ID + subject + sender only.
- Dedupe on Gmail message ID — reprocessing must not create duplicate items.
- Kid names in code/seed data are placeholders (Aarav, Diya) — real names come
  from user config, never hardcoded.
- Secrets live in .env only. credentials.json and token.json are gitignored.
- Keep Gemini calls cheap: batch where possible, use flash-tier models, skip
  irrelevant emails before calling the model.

## Environment
- WATCH_SENDERS: comma-separated sender domains (brightwheel.com, ipsd.org, etc.)
- KIDS: name:context pairs to help the model attribute items to the right child
- See .env.example for the full list

## Decisions log (append here as we settle things)
- 2026-07: Name chosen: Nestly. Manual upload path (not scraping) for ParentVUE/
  Brightwheel content that doesn't arrive by email. No SMS reading — screenshot
  upload instead.
- 2026-07: Calendar strategy: ingest ICS feeds as primary structured source; publish
  Nestly as a private ICS feed for phone subscription. Google Calendar write API
  deferred — not needed in phase 1.
- 2026-07: Mobile = PWA (add to home screen + web push). Native app / App Store
  deferred to stage 3, and only alongside a subscription tier.
