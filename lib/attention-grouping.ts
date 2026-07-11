import type { Item } from "./types";

export interface AttentionGroup {
  label: string;
  items: Item[];
}

export type AttentionEntry = { kind: "single"; item: Item } | { kind: "group"; group: AttentionGroup };

// Clusters needs-attention items that came from the same email (e.g. a
// multi-session testing schedule PDF producing 6 distinct items) into one
// collapsible entry, so a single rich source doesn't read as 6 unrelated
// cards. Items from different emails, or a lone item from its email, stay
// as individual cards. Preserves the original (due_at) ordering — a group
// appears wherever its first item would have.
export function groupAttentionItems(
  items: Item[],
  subjectByMessageId: Map<string, string>
): AttentionEntry[] {
  const countByMessage = new Map<string, number>();
  for (const item of items) {
    if (item.source_type === "gmail" && item.gmail_message_id) {
      countByMessage.set(item.gmail_message_id, (countByMessage.get(item.gmail_message_id) ?? 0) + 1);
    }
  }

  const entries: AttentionEntry[] = [];
  const emittedGroups = new Set<string>();

  for (const item of items) {
    const messageId = item.gmail_message_id;
    const isGroupable =
      item.source_type === "gmail" && messageId && (countByMessage.get(messageId) ?? 0) > 1;

    if (isGroupable && messageId) {
      if (emittedGroups.has(messageId)) continue;
      emittedGroups.add(messageId);
      const groupItems = items.filter((i) => i.gmail_message_id === messageId);
      const label = subjectByMessageId.get(messageId) ?? groupItems[0].provenance_label;
      entries.push({ kind: "group", group: { label, items: groupItems } });
    } else {
      entries.push({ kind: "single", item });
    }
  }

  return entries;
}
