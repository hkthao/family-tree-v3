import { getAccessToken } from "zmp-sdk";

import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase";

/**
 * Đăng nhập bằng Zalo: đổi mã truy cập của Mini App lấy phiên Supabase
 * qua edge function `zalo-auth` (xem file đó để biết vì sao phải đi vòng
 * qua máy chủ chứ không tin ID do client gửi).
 *
 * Gọi lại mỗi lần mở app cũng được: đã có phiên thì trả luôn, không hỏi
 * Zalo nữa. Cần thế vì khung web của Zalo trên iOS có lúc xoá bộ nhớ
 * trình duyệt, phiên cũ mất mà người dùng không làm gì cả.
 */
export async function signInWithZalo(): Promise<{ isNew: boolean }> {
  const { data: existing } = await supabase.auth.getSession();
  if (existing.session) return { isNew: false };

  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error("Zalo không cấp mã truy cập.");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/zalo-auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ accessToken }),
  });
  const body = (await res.json().catch(() => null)) as
    | { tokenHash?: string; isNew?: boolean; error?: string }
    | null;
  if (!res.ok || !body?.tokenHash) {
    throw new Error(body?.error ?? "Không đăng nhập được. Thử lại sau.");
  }

  // Bản GoTrue mới nhận type "email" cho token_hash của magic link, bản cũ
  // đòi "magiclink". Máy chủ là self-host nên thử cả hai thay vì đoán.
  let { error } = await supabase.auth.verifyOtp({
    token_hash: body.tokenHash,
    type: "email",
  });
  if (error) {
    ({ error } = await supabase.auth.verifyOtp({
      token_hash: body.tokenHash,
      type: "magiclink",
    }));
  }
  if (error) throw new Error(error.message);
  return { isNew: !!body.isNew };
}
