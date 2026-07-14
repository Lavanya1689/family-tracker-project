import { supabaseAdmin } from "./supabase";

export interface ItemComment {
  id: string;
  item_id: string;
  author_email: string;
  body: string;
  created_at: string;
}

export async function getCommentsByItemIds(itemIds: string[]): Promise<Map<string, ItemComment[]>> {
  const byItem = new Map<string, ItemComment[]>();
  if (itemIds.length === 0) return byItem;

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("item_comments")
    .select("*")
    .in("item_id", itemIds)
    .order("created_at", { ascending: true });
  if (error) throw error;

  for (const comment of (data ?? []) as ItemComment[]) {
    const list = byItem.get(comment.item_id) ?? [];
    list.push(comment);
    byItem.set(comment.item_id, list);
  }
  return byItem;
}
