import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

/** Khoá cấu hình dòng họ demo (hiện nút "Xem thử" ở trang Đăng nhập). */
export const DEMO_CLAN_KEY = "demo_clan_id";

/** Đọc 1 giá trị cấu hình nền tảng (công khai). */
export async function getPlatformSetting(
  key: string,
  client: Client = defaultClient,
): Promise<string | null> {
  const { data, error } = await client
    .from("platform_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.value ?? null;
}

/** Ghi (upsert) 1 giá trị cấu hình — chỉ platform admin (theo RLS). */
export async function setPlatformSetting(
  key: string,
  value: string | null,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("platform_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export function getDemoClanId(client: Client = defaultClient) {
  return getPlatformSetting(DEMO_CLAN_KEY, client);
}

export function setDemoClanId(clanId: string | null, client: Client = defaultClient) {
  return setPlatformSetting(DEMO_CLAN_KEY, clanId, client);
}
