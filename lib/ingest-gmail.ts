import { supabaseAdmin } from "./supabase";
import { fetchCandidateEmails, fetchEmailContent } from "./google";
import { extractItems, looksSkippable } from "./gemini";
import { getWatchSenders, getKidsConfig, senderIsWatched } from "./env";
import { gmailProvenance } from "./provenance";
import { localToUtcIso } from "./timezone";
import { sendPushToAll } from "./push";
import { getGeminiCustomInstructions } from "./settings";

// Gemini is instructed to return naive local wall-clock strings (no
// timezone suffix) — convert them to the correct UTC instant for the
// family's configured timezone before they ever reach the database.
function toUtc(naive: string | undefined): string | null {
  return naive ? localToUtcIso(naive) : null;
}

export interface GmailIngestResult {
  emailsSeen: number;
  emailsSkippedAlreadyProcessed: number;
  emailsSkippedNotRelevant: number;
  emailsProcessed: number;
  emailsFailed: number;
  itemsCreated: number;
}

// Fetches the last `days` days of primary-inbox mail across every connected
// Google account. WATCH_SENDERS mail always goes to Gemini. Everything else
// also goes to Gemini — its own extraction judgment (already instructed to
// return nothing for non-actionable content) decides relevance, not a rigid
// keyword list — except bulk/marketing mail (List-Unsubscribe present),
// which is excluded before ever reaching the model; see CLAUDE.md's "what
// reaches the model" rule. Dedupes on Gmail's own message id, the email's
// RFC822 Message-ID, and a sender+subject+time-window fallback (shared
// across mailboxes, so the same email sent to both parents separately
// doesn't get processed twice).
export async function ingestGmail(days = 7): Promise<GmailIngestResult> {
  const watchSenders = getWatchSenders();
  const kidsConfig = getKidsConfig();
  const db = supabaseAdmin();

  const result: GmailIngestResult = {
    emailsSeen: 0,
    emailsSkippedAlreadyProcessed: 0,
    emailsSkippedNotRelevant: 0,
    emailsProcessed: 0,
    emailsFailed: 0,
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
  const customInstructions = await getGeminiCustomInstructions();

  // Every item created below starts life as "needs_attention" — collect
  // their titles so we can push a single reminder notification once
  // ingestion finishes, instead of the parent having to notice on their own.
  const newAttentionTitles: string[] = [];

  for (const email of emails) {
    const watched = senderIsWatched(email.sender, watchSenders);
    // Watched senders are always processed, even if they happen to trip
    // the bulk-mail signal (some school systems include unsubscribe links
    // on legitimate notices). Everyone else is excluded only if it's bulk
    // mail — no keyword gate; Gemini's own extraction judgment decides
    // relevance for the rest.
    if (!watched && email.isBulkMail) {
      result.emailsSkippedNotRelevant++;
      continue;
    }

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

      const extracted = looksSkippable(emailWithBody)
        ? []
        : await extractItems(emailWithBody, kidsConfig, customInstructions);

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

  return result;
}
