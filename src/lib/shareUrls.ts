import { sitePagePath, type SitePageKey } from "@/lib/siteSections";

/**
 * NƠI DUY NHẤT dựng địa chỉ chia sẻ (`/share/:token…`). Mọi chức năng chia sẻ trong app (QR người / mộ / di sản, link cây,
 * link mời góp, link câu hỏi, QR trên PDF…) phải đi qua đây để luôn dẫn vào trang dòng họ ĐÚNG mục menu — không tự ghép
 * chuỗi ở chỗ khác (test `shareUrlsGuard` chặn). Muốn đổi cấu trúc địa chỉ thì chỉ sửa ở file này và `siteSections.ts`.
 */

export interface ShareLinkRef {
  token: string;
  scope: string;
  root_person_id?: string | null;
  root_resting_place_id?: string | null;
  root_heritage_item_id?: string | null;
}

/** Gốc đường dẫn của một link: `/share/<token>`. */
export const shareBase = (token: string): string => `/share/${token}`;

/** Đường dẫn tới một mục menu của trang dòng họ qua link token, tuỳ chọn id và query. */
export function shareTokenPath(token: string, page: SitePageKey, id?: string, query?: Record<string, string | null | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v) qs.set(k, v);
  const s = qs.toString();
  return `${sitePagePath(shareBase(token), page, id)}${s ? `?${s}` : ""}`;
}

/**
 * Đường dẫn "đích" của một link theo loại: QR người → hồ sơ người đó, QR mộ → mục Mộ phần, QR di sản → mục Di sản,
 * link mời góp → Cùng góp, link cây → trang chủ.
 */
export function shareLinkPath(l: ShareLinkRef): string {
  switch (l.scope) {
    case "single_person":
      return l.root_person_id ? shareTokenPath(l.token, "person", l.root_person_id) : shareBase(l.token);
    case "resting_place":
      return l.root_resting_place_id ? shareTokenPath(l.token, "graves", l.root_resting_place_id) : shareBase(l.token);
    case "heritage_item":
      return l.root_heritage_item_id ? shareTokenPath(l.token, "heritage", l.root_heritage_item_id) : shareBase(l.token);
    case "contribute":
      return shareTokenPath(l.token, "contribute");
    default:
      return shareBase(l.token);
  }
}

export const shareLinkUrl = (origin: string, l: ShareLinkRef): string => `${origin.replace(/\/+$/, "")}${shareLinkPath(l)}`;

/** Link mời góp (có thể kèm người cần hỏi) — mở thẳng mục Cùng góp. `tab=gop` giữ cho màn Share cũ (khi chưa bật trang dòng họ). */
export const contributeUrl = (origin: string, token: string, personId?: string | null): string =>
  `${origin.replace(/\/+$/, "")}${shareTokenPath(token, "contribute", undefined, { tab: "gop", p: personId })}`;

/** Link trả lời một câu hỏi — mục Cùng góp, mở sẵn câu hỏi đó. */
export const questionUrl = (origin: string, token: string, questionId: string): string =>
  `${origin.replace(/\/+$/, "")}${shareTokenPath(token, "contribute", undefined, { tab: "gop", q: questionId })}`;
