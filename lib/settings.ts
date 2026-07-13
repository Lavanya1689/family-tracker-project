import { supabaseAdmin } from "./supabase";

export async function getGeminiCustomInstructions(): Promise<string | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("app_settings")
    .select("gemini_custom_instructions")
    .eq("id", true)
    .maybeSingle();
  return data?.gemini_custom_instructions ?? null;
}

export type LastRunField = "last_gmail_sync_at" | "last_ics_sync_at" | "last_reminders_run_at";

// Called at the end of each background job (Gmail sync, ICS sync, reminders
// cron) so the Settings page can show whether a job is actually running,
// instead of the parent guessing why a reminder didn't show up.
export async function markLastRun(field: LastRunField): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db
    .from("app_settings")
    .update({ [field]: new Date().toISOString() })
    .eq("id", true);
  if (error) console.error(`Failed to record ${field}:`, error);
}

export interface JobStatus {
  pushSubscriptionCount: number;
  lastGmailSyncAt: string | null;
  lastIcsSyncAt: string | null;
  lastRemindersRunAt: string | null;
}

export async function getJobStatus(): Promise<JobStatus> {
  const db = supabaseAdmin();
  const [{ count }, { data: settings }] = await Promise.all([
    db.from("push_subscriptions").select("*", { count: "exact", head: true }),
    db
      .from("app_settings")
      .select("last_gmail_sync_at, last_ics_sync_at, last_reminders_run_at")
      .eq("id", true)
      .maybeSingle(),
  ]);

  return {
    pushSubscriptionCount: count ?? 0,
    lastGmailSyncAt: settings?.last_gmail_sync_at ?? null,
    lastIcsSyncAt: settings?.last_ics_sync_at ?? null,
    lastRemindersRunAt: settings?.last_reminders_run_at ?? null,
  };
}
