/**
 * Mã hoá khoá API trước khi lưu DB — AES-256-GCM qua WebCrypto.
 *
 * ⚠️ HÃY THÀNH THẬT VỀ THỨ NÀY BẢO VỆ ĐƯỢC GÌ.
 *
 * Khoá mã hoá (KEK) nằm ở biến môi trường `AI_KEY_ENCRYPTION_KEY`, tức
 * vẫn có MỘT bí mật trong env. Đổi lại:
 *
 *   CHỐNG ĐƯỢC — và đây đều là rủi ro thật:
 *     · Bản dump / backup DB bị lộ (kịch bản hay xảy ra nhất)
 *     · Một `select *` vô ý, hoặc một policy RLS viết sai
 *     · Người có quyền đọc DB nhưng không có quyền lên máy chủ ứng dụng
 *     · Khoá lọt vào log truy vấn
 *
 *   KHÔNG CHỐNG ĐƯỢC:
 *     · Ai đã đọc được env của edge function — họ có KEK
 *     · Ai có cả service role LẪN KEK
 *
 * Nói cách khác: đây là envelope encryption tiêu chuẩn, đổi N bí mật lấy
 * 1 bí mật và bịt được đường rò qua dữ liệu. Không phải bùa hộ mệnh.
 *
 * NẾU ĐỔI `AI_KEY_ENCRYPTION_KEY`: mọi khoá đã lưu thành rác không giải
 * được. Không có đường khôi phục — phải nhập lại từ màn hình quản trị.
 */

import { env } from "./env.ts";

const ALG = "AES-GCM";
const IV_BYTES = 12;

function kekBytes(): Uint8Array {
  const raw = env("AI_KEY_ENCRYPTION_KEY");
  if (!raw) {
    throw new Error(
      "Thiếu AI_KEY_ENCRYPTION_KEY — chưa đặt thì không lưu được khoá API.",
    );
  }
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  } catch {
    throw new Error("AI_KEY_ENCRYPTION_KEY phải là base64 của 32 byte.");
  }
  if (bytes.length !== 32) {
    throw new Error(
      `AI_KEY_ENCRYPTION_KEY phải là 32 byte (hiện ${bytes.length}). Sinh bằng: openssl rand -base64 32`,
    );
  }
  return bytes;
}

async function kek(): Promise<CryptoKey> {
  return await crypto.subtle.importKey("raw", kekBytes(), ALG, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Trả về base64 của `iv || ciphertext` (GCM đã gộp tag vào ciphertext). */
export async function encryptSecret(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const data = new TextEncoder().encode(plain);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: ALG, iv }, await kek(), data),
  );
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv, 0);
  out.set(cipher, iv.length);
  return btoa(String.fromCharCode(...out));
}

export async function decryptSecret(stored: string): Promise<string> {
  let raw: Uint8Array;
  try {
    raw = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
  } catch {
    throw new Error("Bản mã hỏng — nhập lại khoá ở màn hình quản trị.");
  }
  if (raw.length <= IV_BYTES) throw new Error("Bản mã quá ngắn.");
  const iv = raw.slice(0, IV_BYTES);
  const body = raw.slice(IV_BYTES);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: ALG, iv },
      await kek(),
      body,
    );
    return new TextDecoder().decode(plain);
  } catch {
    // GCM fail = sai KEK hoặc dữ liệu bị sửa. Không phân biệt được, và
    // cũng không nên phân biệt.
    throw new Error(
      "Không giải mã được khoá API. Có thể AI_KEY_ENCRYPTION_KEY đã đổi — nhập lại khoá ở màn hình quản trị.",
    );
  }
}

/**
 * 4 ký tự cuối để admin nhận ra mình đã cắm khoá nào. Không bao giờ hiện
 * nhiều hơn — 4 ký tự cuối không đủ để dựng lại khoá.
 */
export function hintOf(secret: string): string {
  return secret.length <= 4 ? "••••" : `••••${secret.slice(-4)}`;
}
