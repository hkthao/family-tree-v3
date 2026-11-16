import { supabase } from "@/lib/supabase";
import type { ApiToken } from "@/lib/queries/api-tokens";

export interface AdminApiToken extends ApiToken {
  user_id: string;
  clan_name: string;
  user_name: string;
}

/** Mọi token của nền tảng (RLS chỉ cho quản trị nền tảng). Không có bản băm. */
export async function listAllApiTokens(): Promise<AdminApiToken[]> {
  const { data, error } = await supabase
    .from("api_tokens" as never)
    .select(
      "id, clan_id, user_id, name, token_prefix, scope, expires_at, last_used_at, revoked_at, created_at, api_token_clans(clan_id)",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Array<
    ApiToken & { user_id: string; api_token_clans?: Array<{ clan_id: string }> }
  >;
  const clanIds = [
    ...new Set(rows.map((r) => r.clan_id).filter((x): x is string => !!x)),
  ];
  const userIds = [
    ...new Set(rows.map((r) => (r as unknown as { user_id: string }).user_id)),
  ];
  const [clans, profiles] = await Promise.all([
    clanIds.length
      ? supabase.from("clans").select("id, name").in("id", clanIds)
      : { data: [] },
    userIds.length
      ? supabase.from("profiles").select("id, display_name").in("id", userIds)
      : { data: [] },
  ]);
  const clanName = new Map((clans.data ?? []).map((c) => [c.id, c.name]));
  const userName = new Map(
    (profiles.data ?? []).map((p) => [p.id, p.display_name]),
  );
  return rows.map((r) => {
    const uid = (r as unknown as { user_id: string }).user_id;
    const extra =
      (r.api_token_clans?.length ?? 0) > 1
        ? r.api_token_clans!.length
        : undefined;
    return {
      ...r,
      clan_count: extra,
      user_id: uid,
      clan_name: r.clan_id
        ? `${clanName.get(r.clan_id) ?? "—"}${extra ? ` +${extra - 1}` : ""}`
        : "Toàn nền tảng",
      user_name: userName.get(uid) ?? "—",
    };
  });
}
