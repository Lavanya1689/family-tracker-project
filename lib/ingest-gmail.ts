import { supabaseAdmin } from "./supabase";
import { fetchRecentEmails } from "./google";
import { extractItems, looksSkippable } from "./gemini";
import { getWatchSenders, getKidsConfig, senderIsWatched } from "./env";
import { gmailProvenance } from "./provenance";

export interface GmailIngestResult {
  emailsSeen: number;
  emailsSkippedAlreadyProcessed: number;
  emailsSkippedNotWatched: number;
  emailsProcessed: number;
  itemsCreated: number;
}

// Fetches the last `days` days of mail from WATCH_SENDERS, extracts items
// with Gemini, and stores them. Dedupes on gmail_message_id: a message
// already in gmail_messages is never re-sent to the model or re-inserted.
export async function ingestGmail(days = 7): Promise<GmailIngestResult> {
  const watchSenders = getWatchSenders();
  const kidsConfig = getKidsConfig();
  const db = supabaseAdmin();

  const result: GmailIngestResult = {
    emailsSeen: 0,
    emailsSkippedAlreadyProcessed: 0,
    emailsSkippedNotWatched: 0,
    emailsProcessed: 0,
    itemsCreated: 0,
  };

  const emails = await fetchRecentEmails(watchSenders, days);
  result.emailsSeen = emails.length;

  const { data: kidRows, error: kidsError } = await db
    .from("kids")
    .select("id, name");
  if (kidsError) throw kidsError;

  for (const email of emails) {
    // Belt-and-suspenders: re-check even though the Gmail query already
    // filtered by sender. Never let an unlisted sender reach Gemini.
    if (!senderIsWatched(email.sender, watchSenders)) {
      result.emailsSkippedNotWatched++;
      continue;
    }

    const { data: existing } = await db
      .from("gmail_messages")
      .select("gmail_message_id")
      .eq("gmail_message_id", email.gmailMessageId)
      .maybeSingle();
    if (existing) {
      result.emailsSkippedAlreadyProcessed++;
      continue;
    }

    // Extract before writing anything: if Gemini throws (rate limit,
    // billing, transient error), nothing is persisted for this email, so
    // the next run retries it instead of silently losing it forever.
    const extracted = looksSkippable(email) ? [] : await extractItems(email, kidsConfig);

    // gmail_messages must be inserted before items (items.gmail_message_id
    // is a foreign key into it).
    const { error: insertMsgError } = await db.from("gmail_messages").insert({
      gmail_message_id: email.gmailMessageId,
      sender: email.sender,
      subject: email.subject,
      received_at: email.receivedAt.toISOString(),
    });
    if (insertMsgError) throw insertMsgError;
    result.emailsProcessed++;

    if (extracted.length > 0) {
      const provenance = gmailProvenance(email.sender, email.receivedAt);
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
          starts_at: item.starts_at ?? null,
          ends_at: item.ends_at ?? null,
          all_day: item.all_day ?? false,
          due_at: item.due_at ?? null,
          status: "needs_attention" as const,
          source_type: "gmail" as const,
          gmail_message_id: email.gmailMessageId,
          provenance_label: provenance,
        };
      });

      const { error: insertItemsError } = await db.from("items").insert(rows);
      if (insertItemsError) throw insertItemsError;
      result.itemsCreated += rows.length;
    }
  }

  return result;
}
