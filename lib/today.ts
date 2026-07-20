import { supabaseAdmin } from "./supabase";
import { localMidnightUtc } from "./timezone";
import { groupAttentionItems, type AttentionEntry } from "./attention-grouping";
import type { Item, Kid } from "./types";

export interface TodayData {
  kids: Kid[];
  attentionEntries: AttentionEntry[];
  todayEvents: Item[];
  emailsReadRecently: number;
  // Which connected Gmail account a message actually belongs to — Nestly
  // is multi-account (each parent connects their own), and the "view
  // email" link needs this to open in the right account instead of
  // whichever one happens to be the browser's default.
  accountEmailByMessageId: Map<string, string>;
}

export async function getTodayData(): Promise<TodayData> {
  const db = supabaseAdmin();

  const startOfToday = localMidnightUtc(0);
  const startOfTomorrow = localMidnightUtc(1);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [{ data: kids }, { data: needsAttention }, { data: todayEvents }, { count: emailsReadRecently }] =
    await Promise.all([
      db.from("kids").select("*"),
      db
        .from("items")
        .select("*")
        .eq("status", "needs_attention")
        .order("due_at", { ascending: true, nullsFirst: false }),
      db
        .from("items")
        .select("*")
        .neq("status", "handled")
        .gte("starts_at", startOfToday.toISOString())
        .lt("starts_at", startOfTomorrow.toISOString())
        .order("starts_at", { ascending: true }),
      db
        .from("gmail_messages")
        .select("*", { count: "exact", head: true })
        .gte("processed_at", since24h.toISOString()),
    ]);

  const attentionItems = (needsAttention ?? []) as Item[];

  // Group labels use the source email's subject when available — a much
  // better cluster header ("Belt Testing") than repeating the full
  // provenance sentence on every group.
  const messageIds = Array.from(
    new Set(attentionItems.map((i) => i.gmail_message_id).filter((id): id is string => Boolean(id)))
  );
  const { data: messages } =
    messageIds.length > 0
      ? await db
          .from("gmail_messages")
          .select("gmail_message_id, subject, account_email")
          .in("gmail_message_id", messageIds)
      : { data: [] };
  const subjectByMessageId = new Map((messages ?? []).map((m) => [m.gmail_message_id, m.subject]));
  const accountEmailByMessageId = new Map((messages ?? []).map((m) => [m.gmail_message_id, m.account_email]));

  return {
    kids: (kids ?? []) as Kid[],
    attentionEntries: groupAttentionItems(attentionItems, subjectByMessageId),
    todayEvents: (todayEvents ?? []) as Item[],
    emailsReadRecently: emailsReadRecently ?? 0,
    accountEmailByMessageId,
  };
}
