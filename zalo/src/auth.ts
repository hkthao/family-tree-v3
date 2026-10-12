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
  // Rỗng = đang chạy NGOÀI ứng dụng Zalo (giả lập trên trình duyệt máy
  // tính): ở đó không có người dùng Zalo nào để cấp mã.
  if (!accessToken) throw new NotInZaloError();

  const body = await callFunction<{ tokenHash: string; isNew?: boolean }>(
    "zalo-auth",
    { accessToken },
  );
  await adoptSession(body.tokenHash);
  return { isNew: !!body.isNew };
}

/** Ném ra khi Mini App chạy ngoài Zalo — không có ai để Zalo cấp mã. */
export class NotInZaloError extends Error {
  constructor() {
    super(
      "Zalo không cấp mã truy cập. Đăng nhập chỉ chạy khi mở trong ứng dụng Zalo trên điện thoại.",
    );
  }
}

/**
 * Đang chạy `npm start` trên máy lập trình (giả lập ở localhost)?
 *
 * Kiểm CẢ cờ DEV lẫn tên máy: bản đưa lên Zalo không bao giờ ở localhost,
 * nên dù có sơ sẩy dựng nhầm chế độ thì form đăng nhập dev cũng không lộ
 * ra cho người dùng thật.
 */
export const isLocalDev =
  import.meta.env.DEV &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);

/**
 * Đăng nhập bằng email + mật khẩu — CHỈ để lập trình trên giả lập máy
 * tính, nơi không có Zalo để đăng nhập. Nhờ nó sửa giao diện là thấy ngay
 * (tự nạp lại), không phải đưa bản dựng lên Zalo rồi quét mã mỗi lần.
 */
export async function devSignIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

/** Gọi một edge function của Zalo; lỗi thì ném ra câu tiếng Việt từ máy chủ. */
async function callFunction<T>(name: string, payload: object): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!res.ok || !body) {
    throw new Error(body?.error ?? "Không kết nối được máy chủ. Thử lại sau.");
  }
  return body;
}

/** Đổi `token_hash` do máy chủ cấp lấy phiên đăng nhập. */
async function adoptSession(tokenHash: string): Promise<void> {
  // Bản GoTrue mới nhận type "email" cho token_hash của magic link, bản cũ
  // đòi "magiclink". Máy chủ là self-host nên thử cả hai thay vì đoán.
  let { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });
  if (error) {
    ({ error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "magiclink",
    }));
  }
  if (error) throw new Error(error.message);
}

/** Email giả của tài khoản tạo từ Zalo — tức CHƯA liên kết tài khoản web. */
export const isZaloOnlyAccount = (email: string | undefined | null) =>
  !!email && email.endsWith("@zalo.giapha.thaohk.com");

/** Bước 1 liên kết: gửi mã 6 số tới email của tài khoản đã có trên web. */
export async function requestAccountLink(email: string): Promise<void> {
  const accessToken = await getAccessToken();
  await callFunction("zalo-link", { action: "request", accessToken, email });
}

/** Bước 2: đúng mã thì Zalo này trỏ sang tài khoản cũ, phiên đổi theo. */
export async function confirmAccountLink(code: string): Promise<void> {
  const accessToken = await getAccessToken();
  const { tokenHash } = await callFunction<{ tokenHash: string }>("zalo-link", {
    action: "confirm",
    accessToken,
    code,
  });
  await supabase.auth.signOut({ scope: "local" });
  await adoptSession(tokenHash);
}

/**
 * Gọi ngay SAU khi xoá tài khoản: nhờ máy chủ dọn tài khoản Zalo tạm còn
 * sót (nếu có). Lỗi thì bỏ qua — tài khoản chính đã xoá xong, đây chỉ là
 * dọn nốt, không nên báo đỏ cho người dùng vì nó.
 */
export async function forgetZaloLeftovers(): Promise<void> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    await callFunction("zalo-link", { action: "forget", accessToken });
  } catch {
    /* dọn dẹp không thành — không ảnh hưởng việc xoá tài khoản */
  }
}
