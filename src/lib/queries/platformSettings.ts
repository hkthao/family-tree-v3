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

/** Parse giá trị demo → mảng clan id. Chấp nhận: JSON array, id đơn, hoặc
 *  danh sách phân tách bởi dấu phẩy (tương thích ngược giá trị cũ). */
function parseDemoIds(value: string | null): string[] {
  if (!value) return [];
  const v = value.trim();
  if (v.startsWith("[")) {
    try {
      const arr = JSON.parse(v);
      return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  }
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Danh sách dòng họ demo (0, 1 hoặc nhiều). */
export async function getDemoClanIds(
  client: Client = defaultClient,
): Promise<string[]> {
  return parseDemoIds(await getPlatformSetting(DEMO_CLAN_KEY, client));
}

export function setDemoClanIds(
  ids: string[],
  client: Client = defaultClient,
) {
  return setPlatformSetting(
    DEMO_CLAN_KEY,
    ids.length ? JSON.stringify(ids) : null,
    client,
  );
}

// ─── Linh vật ────────────────────────────────────────────────────────

const MASCOT_KEY = "ui.mascot_enabled";

/**
 * Linh vật có hiện hay không.
 *
 * Mặc định BẬT: chưa áp migration hay chưa ai đụng vào thì giữ nguyên
 * hành vi cũ, chứ không phải tự nhiên biến mất.
 */
export async function isMascotEnabled(client: Client = defaultClient): Promise<boolean> {
  return (await getPlatformSetting(MASCOT_KEY, client)) !== "false";
}

export async function setMascotEnabled(
  on: boolean,
  client: Client = defaultClient,
): Promise<void> {
  await setPlatformSetting(MASCOT_KEY, on ? "true" : "false", client);
}
