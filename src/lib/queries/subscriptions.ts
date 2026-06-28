import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export type SubScope = "clan" | "branch" | "person";
export type SubChannel = "email" | "sms";
export type SubEventType =
  | "birthday"
  | "death_anniversary"
  | "custom"
  | "tomb_visit";

export interface SubscriptionRow {
  id: string;
  clan_id: string;
  user_id: string;
  scope: SubScope;
  target_id: string | null;
  event_types: SubEventType[];
  channels: SubChannel[];
  lead_days: number[];
  is_enabled: boolean;
  created_at: string;
}

export const DEFAULT_CHANNELS: SubChannel[] = ["email"];
export const DEFAULT_LEAD_DAYS = [7, 1];
export const DEFAULT_EVENT_TYPES: SubEventType[] = [
  "birthday",
  "death_anniversary",
  "tomb_visit",
];

/** All subscriptions the current user has in a given clan. */
export async function listMySubscriptions(
  clanId: string,
  userId: string,
  client: Client = defaultClient,
): Promise<SubscriptionRow[]> {
  const { data, error } = await client
    .from("event_subscriptions")
    .select(
      "id, clan_id, user_id, scope, target_id, event_types, channels, lead_days, is_enabled, created_at",
    )
    .eq("clan_id", clanId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SubscriptionRow[];
}

export interface UpsertSubscriptionInput {
  clan_id: string;
  user_id: string;
  scope: SubScope;
  target_id?: string | null;
  event_types?: SubEventType[];
  channels?: SubChannel[];
  lead_days?: number[];
  is_enabled?: boolean;
}

/**
 * Insert a new subscription, or update its config if one already exists at
 * the same (user, clan, scope, target). The partial unique index guarantees
 * at most one row per scope+target — we look up and UPDATE rather than rely
 * on PostgREST upsert because partial indexes don't satisfy ON CONFLICT.
 */
export async function upsertSubscription(
  input: UpsertSubscriptionInput,
  client: Client = defaultClient,
): Promise<SubscriptionRow> {
  const targetId = input.scope === "clan" ? null : (input.target_id ?? null);
  if (input.scope !== "clan" && !targetId) {
    throw new Error("target_id required for branch/person scope");
  }

  // Find existing row
  let existingQuery = client
    .from("event_subscriptions")
    .select("id")
    .eq("clan_id", input.clan_id)
    .eq("user_id", input.user_id)
    .eq("scope", input.scope);
  if (targetId === null) {
    existingQuery = existingQuery.is("target_id", null);
  } else {
    existingQuery = existingQuery.eq("target_id", targetId);
  }
  const { data: existing, error: findErr } = await existingQuery.maybeSingle();
  if (findErr) throw new Error(findErr.message);

  const payload = {
    clan_id: input.clan_id,
    user_id: input.user_id,
    scope: input.scope,
    target_id: targetId,
    event_types: input.event_types ?? DEFAULT_EVENT_TYPES,
    channels: input.channels ?? DEFAULT_CHANNELS,
    lead_days: input.lead_days ?? DEFAULT_LEAD_DAYS,
    is_enabled: input.is_enabled ?? true,
  };

  if (existing) {
    const { data, error } = await client
      .from("event_subscriptions")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as SubscriptionRow;
  }

  const { data, error } = await client
    .from("event_subscriptions")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as SubscriptionRow;
}

export async function deleteSubscription(
  id: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("event_subscriptions")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setSubscriptionEnabled(
  id: string,
  enabled: boolean,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("event_subscriptions")
    .update({ is_enabled: enabled })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Một dòng họ user đang theo dõi sự kiện (gộp mọi subscription của họ đó). */
export interface FollowedClan {
  clan_id: string;
  clan_name: string;
  /** Số subscription (clan/chi/người) user có trong dòng họ này. */
  subscription_count: number;
  scopes: SubScope[];
  /** true nếu có ít nhất 1 subscription đang bật. */
  any_enabled: boolean;
}

/**
 * Mọi dòng họ user đang theo dõi sự kiện — gộp theo dòng họ, kèm tên.
 * Dùng cho trang Tài khoản để liệt kê + cho phép huỷ theo dõi.
 */
export async function listMyFollowedClans(
  userId: string,
  client: Client = defaultClient,
): Promise<FollowedClan[]> {
  const { data, error } = await client
    .from("event_subscriptions")
    .select("clan_id, scope, is_enabled, clan:clans(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const byClan = new Map<string, FollowedClan>();
  for (const r of data ?? []) {
    const cid = r.clan_id as string;
    const name = (r.clan as { name: string } | null)?.name ?? "(dòng họ đã xoá)";
    const cur =
      byClan.get(cid) ??
      ({
        clan_id: cid,
        clan_name: name,
        subscription_count: 0,
        scopes: [],
        any_enabled: false,
      } as FollowedClan);
    cur.subscription_count += 1;
    const scope = r.scope as SubScope;
    if (!cur.scopes.includes(scope)) cur.scopes.push(scope);
    if (r.is_enabled) cur.any_enabled = true;
    byClan.set(cid, cur);
  }
  return [...byClan.values()];
}

/** Huỷ theo dõi một dòng họ — xoá MỌI subscription của user trong họ đó. */
export async function unfollowClan(
  clanId: string,
  userId: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("event_subscriptions")
    .delete()
    .eq("clan_id", clanId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}
