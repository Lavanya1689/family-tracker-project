import { supabaseAdmin } from "./supabase";
import { supabaseServer } from "./supabase-server";

export interface HouseholdMember {
  user_email: string;
  joined_at: string;
}

// The signed-in user's household, or null if they haven't created/joined
// one yet (new sign-in, no invite used — see app/auth/callback/route.ts).
// Uses the service-role client (supabaseAdmin), not the anon-key session
// client — there's no RLS on household_members, so household lookups only
// ever happen server-side through here, never via the anon key.
export async function getCurrentHouseholdId(): Promise<string | null> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("household_members")
    .select("household_id")
    .eq("user_email", user.email)
    .maybeSingle();
  if (error) throw error;
  return data?.household_id ?? null;
}

export async function getHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("household_members")
    .select("user_email, joined_at")
    .eq("household_id", householdId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as HouseholdMember[];
}

function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Creates a brand-new household for a first-time user — the /onboarding
// entry point. Also creates that household's app_settings row, since
// schema.sql no longer seeds one (a fresh household has nowhere for it to
// come from otherwise).
export async function createHousehold(name: string, creatorEmail: string): Promise<string> {
  const db = supabaseAdmin();
  const { data: household, error } = await db
    .from("households")
    .insert({ name, ics_publish_token: generateToken(), created_by: creatorEmail })
    .select()
    .single();
  if (error) throw error;

  const [{ error: memberError }, { error: settingsError }] = await Promise.all([
    db.from("household_members").insert({ household_id: household.id, user_email: creatorEmail }),
    db.from("app_settings").insert({ household_id: household.id }),
  ]);
  if (memberError) throw memberError;
  if (settingsError) throw settingsError;

  return household.id;
}

// Generates a shareable invite link's token — the household admin sends
// the resulting /invite/<token> URL manually (text, WhatsApp, etc.), same
// "private unguessable URL" pattern the ICS feed publish endpoint uses.
export async function createInvitation(householdId: string, creatorEmail: string): Promise<string> {
  const db = supabaseAdmin();
  const token = generateToken();
  const { error } = await db
    .from("household_invitations")
    .insert({ household_id: householdId, token, created_by: creatorEmail });
  if (error) throw error;
  return token;
}

// Interim helper for background jobs (Gmail/ICS sync, reminders) that
// don't have a signed-in session to resolve a household from, and don't
// yet loop over multiple households — that's real Phase C work (each
// cron route fetching every household and running the job once per
// household). This works correctly today because there is exactly one
// household; it becomes wrong the moment a second household exists, and
// must be replaced then, not left as a permanent shortcut.
export async function getSoleHouseholdId(): Promise<string> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("households").select("id").limit(1).single();
  if (error) throw error;
  return data.id;
}
