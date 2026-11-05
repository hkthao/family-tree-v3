import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import { parseLayout, type CanvasLayout } from "@/lib/tree/canvasModel";

type Client = SupabaseClient<Database>;

export interface TreeCanvas {
  id: string;
  clan_id: string;
  name: string;
  layout: CanvasLayout;
  updated_at: string;
}

// Bảng mới chưa có trong database.types.ts (sinh từ DB) → ép kiểu hẹp ở đây.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (c: Client) => (c as any).from("tree_canvases");

function row(r: Record<string, unknown>): TreeCanvas {
  return {
    id: r.id as string,
    clan_id: r.clan_id as string,
    name: r.name as string,
    layout: parseLayout(r.layout),
    updated_at: r.updated_at as string,
  };
}

export async function listTreeCanvases(
  clanId: string,
  client: Client = defaultClient,
): Promise<TreeCanvas[]> {
  const { data, error } = await table(client)
    .select("id, clan_id, name, layout, updated_at")
    .eq("clan_id", clanId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(row);
}

export async function createTreeCanvas(
  clanId: string,
  name: string,
  layout: CanvasLayout,
  client: Client = defaultClient,
): Promise<TreeCanvas> {
  const { data, error } = await table(client)
    .insert({ clan_id: clanId, name, layout })
    .select("id, clan_id, name, layout, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return row(data);
}

export async function updateTreeCanvas(
  id: string,
  patch: { name?: string; layout?: CanvasLayout },
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await table(client).update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTreeCanvas(
  id: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await table(client).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
