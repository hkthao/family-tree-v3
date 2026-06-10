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

export interface ClanCompletion {
  /** Total non-deleted persons that aren't `todo_excluded`. */
  total: number;
  /** Subset of `total` that have at least one open gap. */
  withGaps: number;
  /** `total - withGaps`. Pre-computed for UI convenience. */
  complete: number;
  /** Integer percentage (0-100). `null` when `total === 0`. */
  percent: number | null;
}

/**
 * Aggregate progress for the clan-level "Họ ta đã hoàn thành X%"
 * widget. `withGaps` comes from `count_clan_completion_gaps` — a
 * DISTINCT-person count across the two load-bearing categories
 * (parents + dates). We deliberately skip the soft categories
 * (dead_end heuristic, missing photo / lunar) because they would
 * always drag a real gia phả's percentage to 0 — almost no clan
 * has photos of pre-1900 ancestors.
 *
 * Don't substitute `count_clan_todo` here: it SUMS category counts,
 * so a person in both `missing_parents` AND `missing_dates` is
 * double-counted and the headline drops below zero (clamped to 0%).
 *
 * Both numerator and denominator skip `todo_excluded` so the
 * explicit "we accept this gap" opt-out doesn't drag the score down
 * forever.
 */
export async function getClanCompletion(
  clanId: string,
  client: Client = defaultClient,
): Promise<ClanCompletion> {
  const [totalRes, gapsRes] = await Promise.all([
    client
      .from("persons")
      .select("id", { count: "exact", head: true })
      .eq("clan_id", clanId)
      .is("deleted_at", null)
      .eq("todo_excluded", false),
    client.rpc("count_clan_completion_gaps", { p_clan_id: clanId }),
  ]);
  if (totalRes.error) throw new Error(totalRes.error.message);
  if (gapsRes.error) throw new Error(gapsRes.error.message);
  const total = totalRes.count ?? 0;
  const withGaps = Number(gapsRes.data ?? 0);
  const complete = Math.max(0, total - withGaps);
  const percent = total > 0 ? Math.round((complete / total) * 100) : null;
  return { total, withGaps, complete, percent };
}

/**
 * Flip the todo_excluded flag for a single person. When true the
 * person stops appearing on /todo across every category and is no
 * longer counted in the drawer badge.
 *
 * Reason use cases:
 *   - Thuỷ tổ legitimately has no parents (already auto-skipped for
 *     missing_parents, but may still appear in other categories).
 *   - A relative whose dates are genuinely lost and never recoverable.
 *   - Anything admin decides "we accept the gap, stop nagging".
 */
export async function setPersonTodoExcluded(
  personId: string,
  excluded: boolean,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.rpc("set_person_todo_excluded", {
    p_person_id: personId,
    p_excluded: excluded,
  });
  if (error) throw new Error(error.message);
}
