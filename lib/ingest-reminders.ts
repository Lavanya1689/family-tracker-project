import { supabaseAdmin } from "./supabase";
import { sendPushToAll } from "./push";
import { markLastRun } from "./settings";

export interface ReminderIngestResult {
  remindersDue: number;
  remindersNotified: number;
}

// Fires a push for every reminder whose remind_at has passed and hasn't
// been notified yet. Needs to run frequently (every 15-30 min) to feel
// like a real reminder — see the manual-trigger note in the setup docs
// for how to schedule this on Vercel's free tier, which only allows daily
// cron on its own.
export async function ingestReminders(): Promise<ReminderIngestResult> {
  const db = supabaseAdmin();
  const result: ReminderIngestResult = { remindersDue: 0, remindersNotified: 0 };

  const { data: due, error } = await db
    .from("reminders")
    .select("*")
    .lte("remind_at", new Date().toISOString())
    .is("notified_at", null);
  if (error) throw error;

  result.remindersDue = due?.length ?? 0;

  for (const reminder of due ?? []) {
    try {
      await sendPushToAll({
        title: reminder.title,
        body: reminder.subtitle ?? "Reminder from Nestly",
        url: "/lists",
      });
      const { error: updateError } = await db
        .from("reminders")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", reminder.id);
      if (updateError) throw updateError;
      result.remindersNotified++;
    } catch (err) {
      // One failed push (or DB write) must not block the rest of the
      // batch — it stays un-notified and gets retried next run.
      console.error(`Failed to notify reminder "${reminder.title}":`, err);
    }
  }

  await markLastRun("last_reminders_run_at");
  return result;
}
