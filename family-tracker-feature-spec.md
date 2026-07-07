# Family Tracker — Feature Spec (v1 Draft)

## Vision
An AI-powered family organizer that pulls kids' school, daycare, and activity info out of email, apps, and paper/photo flyers, then turns it into a shared calendar, a weekly "what needs focus" digest, and household task tracking — with age-appropriate access for middle/high schoolers to manage their own schedules.

---

## Account & Permissions Model
- **Parent account(s):** full access to all kids, all data, household admin (grocery list, payments, medical/emergency info)
- **Teen account (middle/high school):** own calendar and activities, can add their own events/homework, no visibility into siblings' private info (grades, medical) or household admin features
- Shared/limited access for grandparents or caregivers (view-only calendar, no admin) — decide scope before building

---

## Phase 1 — Core Loop (build first)
- Gmail extraction: pull events, deadlines, and categories from Procare, Brightwheel, and ParentVUE alert emails
- Family data store: per kid, per source, categorized (school / daycare / activity / event)
- Calendar sync: write extracted events to Google/Apple Calendar
- Conflict detection: flag overlapping events across kids/parents on the same calendar

## Phase 2 — Fast Follow
- Manual document upload: report cards, progress PDFs, screenshots of flyers or texted invites (Gemini extraction on images, not just text)
- Recurring activity entry: sports, dance, tutoring — manually set up once
- Weekly synthesis + digest: prioritized "what needs focus this week" summary per kid
- Grocery list + shared household to-do list
- Conflict resolution suggestions: AI-suggested alternative times/changes when it detects a scheduling clash
- RSVP status tracking for parties/family events (responded / not yet / declined)
- Reminder job: daily check for unanswered RSVPs or approaching deadlines

## Phase 3 — Manual for Now / Future
- Evite / invitation tracking from email
- Screenshot import for text-message invites (no direct SMS access possible on iOS; limited on Android)
- Homework/assignment tracking pulled from ParentVUE-style academic data
- Carpool/pickup coordination between parents
- School fee / activity payment deadline reminders
- Family safety info: allergies, medications, emergency contacts
- Weather-aware reminders (e.g. "bring a jacket," "rain + early dismissal")
- Teen-managed calendar view/app experience

---

## Open Decisions to Make Before Building
1. How much calendar visibility does a teen get into shared family events vs. their own private ones?
2. Does the calendar itself show "why it matters" (e.g. "Permission slip due") or stay to bare event titles, leaving prioritization to the separate digest?
3. Who besides parents (grandparents, caregivers) gets access, and at what permission level?
