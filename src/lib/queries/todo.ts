import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export type TodoCategory =
  | "missing_parents"
  | "missing_dates"
  | "dead_end"
  | "missing_media";

export const TODO_CATEGORIES: TodoCategory[] = [
  "missing_parents",
  "missing_dates",
  "dead_end",
  "missing_media",
];

export interface TodoSummaryRow {
  category: TodoCategory;
  count: number;
}

export interface TodoItemRow {
  person_id: string;
  full_name: string;
  gender: "M" | "F";
  is_living: boolean;
  birth_year: number | null;
  death_year: number | null;
  generation: number | null;
  photo_path: string | null;
  /** Specific gaps for this row, drawn from a category-specific set:
   *  parents | birth_year | death_year | dead_end | photo | birth_lunar | death_lunar. */
  missing: string[];
}

export async function getClanTodoSummary(
  clanId: string,
  client: Client = defaultClient,
): Promise<TodoSummaryRow[]> {
  const { data, error } = await client.rpc("get_clan_todo_summary", {
    p_clan_id: clanId,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { category: string; count: number }[]).map((r) => ({
    category: r.category as TodoCategory,
    count: Number(r.count),
  }));
}

export async function getClanTodoItems(
  clanId: string,
  category: TodoCategory,
  limit: number,
  offset: number,
  client: Client = defaultClient,
): Promise<TodoItemRow[]> {
  const { data, error } = await client.rpc("get_clan_todo_items", {
    p_clan_id: clanId,
    p_category: category,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as TodoItemRow[];
}

export async function countClanTodo(
  clanId: string,
  client: Client = defaultClient,
): Promise<number> {
  const { data, error } = await client.rpc("count_clan_todo", {
    p_clan_id: clanId,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}
