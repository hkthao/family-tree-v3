import { i18n, type Messages } from "@lingui/core";
import { compileMessage } from "@lingui/message-utils/compileMessage";

import { DEFAULT_LOCALE, intlTagOf, isLocale, type Locale } from "./locales";

export { LOCALES, DEFAULT_LOCALE, isLocale, type Locale } from "./locales";
export { i18n };

const STORAGE_KEY = "family-tree:locale";

/** Mỗi ngôn ngữ một catalog nạp LƯỜI — mở bằng tiếng Việt thì không tải gói tiếng Anh. */
const loaders: Partial<Record<Locale, () => Promise<{ messages: Messages }>>> = {
  // Tiếng Việt là ngôn ngữ nguồn: câu gốc nằm sẵn trong mã nên không cần catalog.
  en: () => import("@/locales/en/messages.po"),
};

// Bản build production của Lingui KHÔNG kèm bộ biên dịch ICU: câu rơi về `message` gốc trong mã (mọi câu
// tiếng Việt, và câu EN chưa dịch) sẽ in nguyên `{0}` thay vì giá trị. Nạp bộ biên dịch để các câu này
// vẫn thay biến đúng. (Câu đã có trong catalog EN được biên dịch sẵn lúc build nên không cần.)
i18n.setMessagesCompiler(compileMessage);

// Kích hoạt tiếng Việt NGAY khi module được nạp: mã ngoài React (menu, thông báo lỗi, PDF…) gọi
// `t` trước khi có Provider; chưa kích hoạt thì Lingui cảnh báo / trả về khoá.
i18n.load(DEFAULT_LOCALE, {});
i18n.activate(DEFAULT_LOCALE);

export function getStoredLocale(): Locale | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isLocale(v) ? v : null;
  } catch {
    return null;
  }
}

function storeLocale(locale: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* private mode — ignore */
  }
}

/**
 * Chọn ngôn ngữ lúc khởi động: `?lang=` (link chia sẻ) → lựa chọn đã lưu → **tiếng Việt**.
 *
 * CỐ TÌNH không đoán theo ngôn ngữ trình duyệt: rất nhiều người Việt dùng máy cài giao diện tiếng
 * Anh, đoán theo trình duyệt sẽ tự chuyển họ sang tiếng Anh ngoài ý muốn. Tiếng Anh chỉ bật khi
 * người dùng chủ động chọn (hoặc người gửi link thêm `?lang=en`). Người đã đăng nhập còn được đồng bộ
 * theo `profiles.locale` (xem LocaleSync).
 */
export function detectLocale(): Locale {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("lang");
    if (isLocale(fromUrl)) return fromUrl;
  } catch {
    /* không có window (test / SSR) */
  }
  return getStoredLocale() ?? DEFAULT_LOCALE;
}

/** Nạp catalog (nếu cần) rồi bật ngôn ngữ; cập nhật `<html lang>`. `persist=false` cho `?lang=` tạm thời. */
export async function activateLocale(locale: Locale, persist = true): Promise<void> {
  const load = loaders[locale];
  if (load) {
    const { messages } = await load();
    i18n.load(locale, messages);
  } else {
    i18n.load(locale, {});
  }
  i18n.activate(locale);
  if (typeof document !== "undefined") document.documentElement.lang = locale;
  if (persist) storeLocale(locale);
}

export function currentLocale(): Locale {
  return isLocale(i18n.locale) ? i18n.locale : DEFAULT_LOCALE;
}

/** Mã BCP-47 cho `Intl` theo ngôn ngữ đang dùng (vd `en-US`). */
export function currentIntlTag(): string {
  return intlTagOf(currentLocale());
}
