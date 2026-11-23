/**
 * Hình riêng của một mốc (cột `image_url`): hoặc một cảnh trong THƯ VIỆN hình dựng sẵn của app (`lib:<id>`),
 * hoặc một link ảnh ngoài (`https://…`). Cả hai lưu chung một cột; DB chặn mọi dạng khác (http, javascript:…).
 */
export const LIB_PREFIX = "lib:";
export const MAX_IMAGE_URL = 500;

export type ImageRef =
  | { kind: "lib"; id: string }
  | { kind: "url"; url: string };

export function libRef(id: string): string {
  return `${LIB_PREFIX}${id}`;
}

/** Đọc giá trị đã lưu; giá trị lạ/hỏng → null (poster quay về ảnh người / biểu tượng). */
export function parseImageRef(v: string | null | undefined): ImageRef | null {
  if (!v) return null;
  if (v.startsWith(LIB_PREFIX)) {
    const id = v.slice(LIB_PREFIX.length);
    return /^[a-z0-9-]+$/.test(id) ? { kind: "lib", id } : null;
  }
  return normalizeImageUrl(v).ok ? { kind: "url", url: v } : null;
}

/** Kiểm tra link người dùng dán: chỉ https, không dấu cách, tối đa 500 ký tự. */
export function normalizeImageUrl(
  raw: string,
): { ok: true; url: string } | { ok: false } {
  const url = raw.trim();
  if (!url || url.length > MAX_IMAGE_URL || /\s/.test(url)) return { ok: false };
  if (!url.startsWith("https://")) return { ok: false };
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !u.hostname.includes(".")) return { ok: false };
  } catch {
    return { ok: false };
  }
  return { ok: true, url };
}
