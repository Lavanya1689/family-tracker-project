export type ItemKind = "event" | "deadline" | "action_item";
export type ItemStatus = "needs_attention" | "scheduled" | "handled";
export type SourceType = "gmail" | "ics" | "manual";

export interface Kid {
  id: string;
  name: string;
  color_key: "a" | "b";
  context: string | null;
}

export interface Item {
  id: string;
  kind: ItemKind;
  title: string;
  description: string | null;
  category: string | null;
  kid_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean;
  due_at: string | null;
  status: ItemStatus;
  source_type: SourceType;
  gmail_message_id: string | null;
  ics_feed_id: string | null;
  ics_uid: string | null;
  provenance_label: string;
  created_at: string;
  updated_at: string;
}

// Shape Gemini returns for each item it extracts from one email.
export interface ExtractedItem {
  kind: ItemKind;
  title: string;
  description?: string;
  category?: string;
  kid_name?: string;
  starts_at?: string; // ISO datetime, if the item is a timed event
  ends_at?: string;
  all_day?: boolean;
  due_at?: string; // ISO datetime, if the item is a deadline
}
