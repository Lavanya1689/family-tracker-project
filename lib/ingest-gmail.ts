import { supabaseAdmin } from "./supabase";
import { fetchCandidateEmails, fetchEmailContent } from "./google";
import { extractItems, looksSkippable } from "./gemini";
import { getKidsConfig } from "./env";
import { gmailProvenance } from "./provenance";
import { localToUtcIso } from "./timezone";
import { sendPushToAll } from "./push";
import { getGeminiCustomInstructions, markLastRun } from "./settings";
import { getSoleHouseholdId } from "./household";

// Gemini is instructed to return naive local wall-clock strings (no
// timezone suffix) — convert them to the correct UTC instant for the
// family's configured timezone before they ever reach the database.
function toUtc(naive: string | undefined): string | null {
  return naive ? localToUtcIso(naive) : null;
}

export interface GmailIngestResult {
  emailsSeen: number;
  emailsSkippedAlreadyProcessed: number;
  emailsProcessed: number;
  emailsFailed: number;
  emailsDeferred: number;
  itemsCreated: number;
}

// Gemini's free tier caps gemini-2.5-flash at 5 requests/minute — hit for
// real once every email started reaching the model instead of ~5% of them
// (most of a run's 429s were legitimate mail losing a race against
// marketing for the same 5-per-minute budget, not just spam failing).
// Vercel's function timeout (60s on Hobby) also rules out just slowing
// down to stay under the limit across a big backlog in one run. Capping
// calls per run and leaving the rest for the next (roughly-hourly) run is
// the only fix that doesn't require either a batched-prompt rewrite or
// enabling billing on the Gemini project — undone messages aren't marked
// processed, so they're retried automatically, not lost.
const MAX_EXTRACTIONS_PER_RUN = 4;

// Fetches the last `days` days of primary-inbox mail across every connected
// Google account. Every email reaches Gemini — its own extraction judgment
// (instructed to return nothing for non-actionable content, including pure
// marketing) decides relevance, not a sender allowlist or a header-based
// pre-filter. Previously, mail with a List-Unsubscribe header (bulk/
// marketing signal) was excluded before ever reaching the model — dropped
// for real invitation services too (Evite etc. send that header on every
// email, same as any mass sender), and the fix at the time was adding
// those senders to WATCH_SENDERS one at a time. That's the wrong shape:
// the model should be doing this judgment call, not a hand-maintained
// list. isBulkMail is still computed and passed to the extraction prompt
// as a signal, not a gate. Dedupes on Gmail's own message id, the email's
// RFC822 Message-ID, and a sender+subject+time-window fallback (shared
// across mailboxes, so the same email sent to both parents separately
// doesn't get processed twice).
export async function ingestGmail(days = 7): Promise<GmailIngestResult> {
  const kidsConfig = getKidsConfig();
  const db = supabaseAdmin();
  // Interim single-household lookup — see lib/household.ts's
  // getSoleHouseholdId for why this isn't a real per-household loop yet.
  const householdId = await getSoleHouseholdId();

  const result: GmailIngestResult = {
    emailsSeen: 0,
    emailsSkippedAlreadyProcessed: 0,
    emailsProcessed: 0,
    emailsFailed: 0,
    emailsDeferred: 0,
    itemsCreated: 0,
  };

  const emails = await fetchCandidateEmails(days);
  result.emailsSeen = emails.length;

  const { data: accounts } = await db.from("google_accounts").select("email");
  const multiAccount = (accounts?.length ?? 0) > 1;

  const { data: kidRows, error: kidsError } = await db
    .from("kids")
    .select("id, name");
  if (kidsError) throw kidsError;

  // Fetched once per run, not per email — this is user-editable via the
  // Settings page, refining Gemini's judgment on top of the base rules.
  const customInstructions = await getGeminiCustomInstructions(householdId);

  // Every item created below starts life as "needs_attention" — collect
  // their titles so we can push a single reminder notification once
  // ingestion finishes, instead of the parent having to notice on their own.
  const newAttentionTitles: string[] = [];
  let extractionsUsed = 0;

  for (const email of emails) {
    const { data: existingByGmailId } = await db
      .from("gmail_messages")
      .select("gmail_message_id")
      .eq("gmail_message_id", email.gmailMessageId)
      .maybeSingle();
    const { data: existingByRfc822 } = email.rfc822MessageId
      ? await db
          .from("gmail_messages")
          .select("gmail_message_id")
          .eq("rfc822_message_id", email.rfc822MessageId)
          .maybeSingle()
      : { data: null };
    // Fallback for mailing-list-style sends: some senders generate a
    // distinct Message-ID per recipient even though it's the same email
    // (e.g. the school sending individually to each parent, not a single
    // CC'd thread) — the RFC822 check above won't catch that. Same sender
    // + same subject within a tight time window is a strong enough signal
    // that it's the same email, not a coincidence.
    const windowStart = new Date(email.receivedAt.getTime() - 5 * 60_000).toISOString();
    const windowEnd = new Date(email.receivedAt.getTime() + 5 * 60_000).toISOString();
    const { data: existingBySenderSubject } = await db
      .from("gmail_messages")
      .select("gmail_message_id")
      .eq("sender", email.sender)
      .eq("subject", email.subject)
      .gte("received_at", windowStart)
      .lte("received_at", windowEnd)
      .maybeSingle();
    if (existingByGmailId || existingByRfc822 || existingBySenderSubject) {
      result.emailsSkippedAlreadyProcessed++;
      continue;
    }

    // Everything from here through the DB writes is wrapped so one email's
    // failure (Gemini error, transient network blip, malformed response)
    // logs and moves on to the next email instead of aborting the whole
    // batch — the message stays unmarked, so it's retried next run.
    try {
      // Only fetch the full body + attachments now, for a candidate that
      // already passed the relevance + dedup checks above — this is the
      // expensive part, and it must scale with what's actually relevant,
      // not with total inbox volume, or a broad scan across accounts blows
      // past the serverless function's time budget.
      const { body, attachments } = await fetchEmailContent(email.refreshToken, email.gmailMessageId);
      const emailWithBody = { ...email, body, attachments };

      let extracted: Awaited<ReturnType<typeof extractItems>>;
      if (looksSkippable(emailWithBody)) {
        extracted = [];
      } else if (extractionsUsed >= MAX_EXTRACTIONS_PER_RUN) {
        // Over this run's Gemini quota budget — leave the message unmarked
        // (no gmail_messages insert below) so it's retried, including a
        // real extraction attempt, on the next run instead of silently
        // being treated as "nothing here."
        result.emailsDeferred++;
        continue;
      } else {
        // Counts the attempt, not the success — a failed call (e.g. a 429)
        // still consumes this run's budget, otherwise a rate-limited burst
        // never trips the cap and just keeps retrying into the same wall
        // for the rest of the run (what actually happened the first time
        // this shipped: 23 failures, 0 deferred, cap never engaged).
        extractionsUsed++;
        extracted = await extractItems(emailWithBody, kidsConfig, customInstructions);
      }

      // gmail_messages must be inserted before items (items.gmail_message_id
      // is a foreign key into it).
      const { error: insertMsgError } = await db.from("gmail_messages").insert({
        gmail_message_id: email.gmailMessageId,
        rfc822_message_id: email.rfc822MessageId,
        account_email: email.accountEmail,
        sender: email.sender,
        subject: email.subject,
        received_at: email.receivedAt.toISOString(),
      });
      if (insertMsgError) throw insertMsgError;
      result.emailsProcessed++;

      if (extracted.length > 0) {
        const provenance = gmailProvenance(
          email.sender,
          email.receivedAt,
          multiAccount ? email.accountLabel : undefined
        );
        const rows = extracted.map((item) => {
          const kid = kidRows?.find(
            (k) => k.name.toLowerCase() === item.kid_name?.toLowerCase()
          );
          return {
            kind: item.kind,
            title: item.title,
            description: item.description ?? null,
            category: item.category ?? null,
            kid_id: kid?.id ?? null,
            starts_at: toUtc(item.starts_at),
            ends_at: toUtc(item.ends_at),
            all_day: item.all_day ?? false,
            due_at: toUtc(item.due_at),
            status: "needs_attention" as const,
            source_type: "gmail" as const,
            gmail_message_id: email.gmailMessageId,
            provenance_label: provenance,
          };
        });

        const { error: insertItemsError } = await db.from("items").insert(rows);
        if (insertItemsError) throw insertItemsError;
        result.itemsCreated += rows.length;
        newAttentionTitles.push(...rows.map((r) => r.title));
      }
    } catch (err) {
      console.error(`Failed to process "${email.subject}" from ${email.sender}:`, err);
      result.emailsFailed++;
    }
  }

  if (newAttentionTitles.length > 0) {
    // A failed push must never fail the ingestion run itself — the data
    // is already safely stored regardless of whether the phone hears about it.
    try {
      await sendPushToAll({
        title:
          newAttentionTitles.length === 1
            ? "Nestly: 1 thing needs your attention"
            : `Nestly: ${newAttentionTitles.length} things need your attention`,
        body:
          newAttentionTitles.slice(0, 3).join(" · ") +
          (newAttentionTitles.length > 3 ? ` +${newAttentionTitles.length - 3} more` : ""),
        url: "/",
      });
    } catch (err) {
      console.error("push notification failed", err);
    }
  }

  await markLastRun(householdId, "last_gmail_sync_at");
  return result;
}
