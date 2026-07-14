// One-time migration: creates the single household this installation has
// always implicitly been, adds its current parents (ALLOWED_EMAILS) as
// members, and backfills household_id onto every existing row across every
// table so nothing already in the database becomes orphaned once queries
// start filtering by household. Safe to re-run: skips entirely if a
// household already exists.
//
// Run this BEFORE re-running supabase/schema.sql a second time — the
// app_settings primary-key migration in that file only proceeds once every
// row already has a household_id, which this script is what sets.
import "./load-env";
import { supabaseAdmin } from "../lib/supabase";

// Duplicated from lib/supabase-server.ts's getAllowedEmails rather than
// imported — that file also imports next/headers, which is coupled to
// the Next.js request runtime and shouldn't be pulled into a standalone
// script even though this one function doesn't use it.
function getAllowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

async function main() {
  const db = supabaseAdmin();

  const { data: existing, error: existingError } = await db
    .from("households")
    .select("id")
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    console.log(`A household already exists (${existing.id}) — skipping migration.`);
    return;
  }

  const emails = getAllowedEmails();
  if (emails.length === 0) {
    throw new Error(
      "ALLOWED_EMAILS is empty — set it to your current household's member emails before running this migration."
    );
  }

  const icsToken = process.env.ICS_PUBLISH_TOKEN;
  if (!icsToken) {
    throw new Error("ICS_PUBLISH_TOKEN is not set — needed so already-subscribed calendars keep working.");
  }

  const householdName = process.env.PARENTS
    ? `${process.env.PARENTS.split(",")[0].trim()}'s Family`
    : "My Family";

  const { data: household, error: householdError } = await db
    .from("households")
    .insert({ name: householdName, ics_publish_token: icsToken, created_by: emails[0] })
    .select()
    .single();
  if (householdError) throw householdError;
  const householdId = household.id;
  console.log(`Created household "${household.name}" (${householdId}).`);

  const { error: membersError } = await db
    .from("household_members")
    .insert(emails.map((email) => ({ household_id: householdId, user_email: email })));
  if (membersError) throw membersError;
  console.log(`Added ${emails.length} member(s): ${emails.join(", ")}`);

  // Every table that gained a household_id column in schema.sql — backfill
  // every existing row (there's only ever been one household's worth of
  // data before this migration, so this is unconditional, not filtered).
  const tables = [
    "kids",
    "google_accounts",
    "gmail_messages",
    "ics_feeds",
    "items",
    "push_subscriptions",
    "todo_lists",
    "tasks",
    "reminders",
    "app_settings",
  ];

  for (const table of tables) {
    const { error, count } = await db
      .from(table)
      .update({ household_id: householdId }, { count: "exact" })
      .is("household_id", null);
    if (error) throw error;
    console.log(`Backfilled ${count ?? 0} row(s) in ${table}.`);
  }

  console.log(
    "\nDone. Now re-run supabase/schema.sql once more to flip app_settings over to household_id as its primary key."
  );
}

main();
