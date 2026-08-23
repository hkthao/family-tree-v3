/**
 * Lấy khoá API cho một nhà cung cấp.
 *
 * Thứ tự: **DB trước, env dự phòng.**
 *
 * Vì sao DB thắng: khi một khoá bị lộ, admin phải thay được ngay từ màn
 * hình quản trị mà không cần ssh vào VPS rồi restart container. Nếu env
 * thắng thì khoá cũ trong env sẽ âm thầm che khoá mới vừa nhập — đúng
 * kiểu lỗi khiến người ta tưởng đã xoay khoá xong mà thật ra chưa.
 *
 * Env vẫn giữ làm dự phòng cho hai việc: khởi động lần đầu khi DB chưa
 * có gì, và đường lui khi DB có sự cố.
 */

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

import { decryptSecret } from "./crypto.ts";
import { env } from "./env.ts";
import { LlmError, type ModelEntry } from "./types.ts";

/** Cache trong một lần chạy — tránh đọc + giải mã lại ở mỗi vòng tool. */
const cache = new Map<string, string>();

export function clearKeyCache(): void {
  cache.clear();
}

/**
 * @param sbAdmin client service role (bảng khoá không có RLS policy nào,
 *                nên chỉ service role đọc nổi).
 */
export async function resolveApiKey(
  sbAdmin: SupabaseClient,
  model: ModelEntry,
): Promise<string> {
  const cached = cache.get(model.credential);
  if (cached) return cached;

  const { data, error } = await sbAdmin
    .from("ai_provider_keys")
    .select("ciphertext")
    .eq("provider", model.credential)
    .maybeSingle();

  if (!error && data?.ciphertext) {
    try {
      const key = await decryptSecret(data.ciphertext);
      cache.set(model.credential, key);
      return key;
    } catch (e) {
      // Giải mã hỏng thường là do AI_KEY_ENCRYPTION_KEY đã đổi. KHÔNG
      // âm thầm rơi về env: người vận hành cần biết khoá trong DB đang
      // vô dụng, chứ không phải để hệ thống chạy bằng khoá cũ trong env
      // rồi tưởng mọi thứ vẫn ổn.
      throw new LlmError((e as Error).message, "auth");
    }
  }

  const fromEnv = env(model.apiKeyEnv);
  if (fromEnv) {
    cache.set(model.credential, fromEnv);
    return fromEnv;
  }

  throw new LlmError(
    `Chưa cấu hình khoá cho ${model.credential}. Vào Quản trị › Trợ lý AI để nhập.`,
    "auth",
  );
}
