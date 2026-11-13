import type { MessageDescriptor } from "@lingui/core";

import { i18n } from "./index";

/**
 * Dịch TRÌ HOÃN cho dữ liệu khai báo ở MỨC MODULE (bảng nhãn, danh sách lựa chọn…).
 *
 * Vì sao cần: `t\`…\`` chạy ngay lúc nạp module, lúc đó ngôn ngữ đang là tiếng Việt nên nhãn bị đóng
 * băng, đổi ngôn ngữ không có tác dụng. Ở đây ta khai báo bằng `msg\`…\`` (chỉ là mô tả, chưa dịch)
 * rồi bọc `lazyMessages(...)`: mỗi lần ĐỌC thuộc tính mới dịch theo ngôn ngữ đang dùng.
 * Nơi dùng giữ nguyên (`LABEL[kind]`, `Object.entries(LABEL)`, `OPTIONS.map(o => o.label)`).
 */
export type Localized<T> = T extends MessageDescriptor
  ? string
  : T extends readonly (infer U)[]
    ? Localized<U>[]
    : T extends Record<string, unknown>
      ? { -readonly [K in keyof T]: Localized<T[K]> }
      : T;

function isDescriptor(v: unknown): v is MessageDescriptor {
  return !!v && typeof v === "object" && "id" in v && ("message" in v || "id" in v) && Object.keys(v).every((k) => ["id", "message", "comment", "context", "values"].includes(k));
}

export function lazyMessages<T>(value: T): Localized<T> {
  if (Array.isArray(value)) return value.map((x) => lazyMessages(x)) as Localized<T>;
  if (isDescriptor(value)) return i18n._(value) as Localized<T>;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isDescriptor(v)) {
        Object.defineProperty(out, k, { enumerable: true, get: () => i18n._(v) });
      } else if (Array.isArray(v) || (v && typeof v === "object")) {
        const inner = lazyMessages(v);
        Object.defineProperty(out, k, { enumerable: true, get: () => inner });
      } else {
        out[k] = v;
      }
    }
    return out as Localized<T>;
  }
  return value as Localized<T>;
}

/** Như `lazyMessages`, nhưng gán kiểu tường minh (dùng với biến đã khai báo kiểu). */
export function lazyAs<T>(value: unknown): T {
  return lazyMessages(value) as unknown as T;
}
