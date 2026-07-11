import { supabaseAdmin } from "./supabase";
import type { TodoList, TodoItem } from "./types";

export interface TodoListWithItems {
  list: TodoList;
  items: TodoItem[];
}

export async function getTodoLists(): Promise<TodoListWithItems[]> {
  const db = supabaseAdmin();
  const [{ data: lists }, { data: items }] = await Promise.all([
    db.from("todo_lists").select("*").order("sort_order", { ascending: true }),
    db.from("todo_items").select("*").order("created_at", { ascending: true }),
  ]);

  return ((lists ?? []) as TodoList[]).map((list) => ({
    list,
    items: ((items ?? []) as TodoItem[]).filter((i) => i.list_id === list.id),
  }));
}
