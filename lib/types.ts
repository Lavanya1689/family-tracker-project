export type ItemKind = "event" | "deadline" | "action_item";
export type ItemStatus = "needs_attention" | "scheduled" | "handled";
export type DismissalReason = "ignored" | "done";
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
  dismissal_reason: DismissalReason | null;
  source_type: SourceType;
  gmail_message_id: string | null;
  ics_feed_id: string | null;
  ics_uid: string | null;
  provenance_label: string;
  created_at: string;
  updated_at: string;
}

export interface TodoList {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface TodoItem {
  id: string;
  list_id: string;
  name: string;
  notes: string | null;
  done: boolean;
  added_by: string | null;
  created_at: string;
}

export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  owner_name: string;
  done: boolean;
  due_date: string | null;
  priority: TaskPriority | null;
  created_at: string;
}

export interface Reminder {
  id: string;
  title: string;
  subtitle: string | null;
  remind_at: string;
  notified_at: string | null;
  created_at: string;
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
