/**
 * Danh sách ngôn ngữ giao diện. Thêm ngôn ngữ mới: khai ở đây + thêm vào `lingui.config.ts`
 * + tạo `src/locales/<mã>/messages.po` + thêm một dòng nạp trong `index.ts`.
 *
 * `label` luôn viết bằng CHÍNH ngôn ngữ đó (người đọc không hiểu giao diện hiện tại vẫn tìm ra
 * ngôn ngữ của mình). `intl` là mã BCP-47 dùng cho `Intl` (ngày, số).
 */
export const LOCALES = [
  { id: "vi", label: "Tiếng Việt", intl: "vi-VN" },
  { id: "en", label: "English", intl: "en-US" },
] as const;

export type Locale = (typeof LOCALES)[number]["id"];

/** Tiếng Việt là ngôn ngữ nguồn và mặc định. */
export const DEFAULT_LOCALE: Locale = "vi";

export function isLocale(v: unknown): v is Locale {
  return LOCALES.some((l) => l.id === v);
}

export function intlTagOf(locale: Locale): string {
  return LOCALES.find((l) => l.id === locale)?.intl ?? "vi-VN";
}
