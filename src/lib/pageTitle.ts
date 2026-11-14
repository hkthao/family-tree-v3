/**
 * Per-route document titles.
 *
 * The app shipped with a single static <title> in index.html, so every
 * one of the ~70 routes reported the same name — Google had nothing to
 * distinguish the public pages by, and the analytics "pages" report
 * collapsed into one row. Organic search is now the largest acquisition
 * channel, which makes this worth fixing properly.
 *
 * Two layers:
 *   - this table, matched against the pathname by <DocumentTitle/>,
 *     gives every route a sensible static title;
 *   - `usePageTitle()` lets a page override once its data has loaded,
 *     so `/xem/clans/:id` becomes "Gia phả họ Nguyễn — Dòng Họ Việt"
 *     rather than the generic fallback.
 *
 * Entries are matched in order, so list specific paths before the
 * patterns that would also match them.
 */
import { msg } from "@lingui/core/macro";
import { matchPath } from "react-router-dom";

import { lazyMessages } from "@/lib/i18n/lazy";

export const SITE_NAME = "Dòng Họ Việt";

export const DEFAULT_TITLE = "Dòng Họ Việt — Quản lý gia phả dòng họ";

export const DEFAULT_DESCRIPTION =
  "Ứng dụng quản lý gia phả dòng họ — lưu phả hệ, cây gia phả nhiều đời, ngày giỗ âm lịch, sự kiện và thông báo.";

export interface RouteMeta {
  /** Route pattern, react-router syntax. */
  pattern: string;
  /** Title without the site suffix — `format()` appends it. */
  title: string;
  /** Only worth setting on pages a search engine should rank. */
  description?: string;
  /**
   * Pages reachable only through a capability token. They must never
   * be indexed: the URL itself is the credential.
   */
  noindex?: boolean;
}

export const ROUTE_META: RouteMeta[] = lazyMessages([
  // ── Công khai / SEO ──────────────────────────────────────────────
  {
    pattern: "/so-tay",
    title: msg`Sổ tay Văn hoá`,
    description: msg`Phong tục, nghi lễ và tín ngưỡng Việt Nam: giỗ chạp, tang lễ, cưới hỏi, thờ cúng tổ tiên — giải thích ngắn gọn, dễ tra cứu.`,
  },
  { pattern: "/so-tay/new", title: msg`Thêm bài Sổ tay` },
  { pattern: "/so-tay/import", title: msg`Nhập bài Sổ tay` },
  { pattern: "/so-tay/:entryId/edit", title: msg`Sửa bài Sổ tay` },
  {
    pattern: "/so-tay/:entryId",
    title: msg`Sổ tay Văn hoá`,
    description: msg`Phong tục, nghi lễ và tín ngưỡng Việt Nam — giải thích ngắn gọn, dễ tra cứu.`,
  },
  {
    pattern: "/xem/so-tay/:entryId",
    title: msg`Sổ tay Văn hoá`,
    description: msg`Phong tục, nghi lễ và tín ngưỡng Việt Nam — giải thích ngắn gọn, dễ tra cứu.`,
  },
  { pattern: "/xem/demo", title: msg`Xem thử gia phả mẫu` },
  {
    pattern: "/xem/clans/:clanId",
    title: msg`Gia phả dòng họ`,
    description: msg`Xem cây gia phả công khai của dòng họ: các đời, ngày giỗ và thông tin thành viên.`,
  },
  {
    pattern: "/docs/:slug",
    title: msg`Hướng dẫn sử dụng`,
    description: msg`Hướng dẫn dùng Dòng Họ Việt: tạo dòng họ, thêm người, vẽ cây gia phả, mời người thân cùng bổ sung.`,
  },
  {
    pattern: "/docs",
    title: msg`Hướng dẫn sử dụng`,
    description: msg`Hướng dẫn dùng Dòng Họ Việt: tạo dòng họ, thêm người, vẽ cây gia phả, mời người thân cùng bổ sung.`,
  },
  {
    pattern: "/huong-dan-video",
    title: msg`Video hướng dẫn`,
    description: msg`Video hướng dẫn từng bước cách lập gia phả dòng họ trên Dòng Họ Việt.`,
  },
  { pattern: "/lien-he", title: msg`Liên hệ` },
  { pattern: "/changelog", title: msg`Có gì mới` },

  // ── Link chia sẻ / lời mời: URL chính là mật khẩu → noindex ──────
  {
    pattern: "/share/:token",
    title: msg`Cây gia phả được chia sẻ`,
    noindex: true,
  },
  { pattern: "/join/:token", title: msg`Lời mời vào dòng họ`, noindex: true },
  { pattern: "/khoe/:token", title: msg`Thiệp gia phả`, noindex: true },
  {
    pattern: "/inlaws/confirm/:token",
    title: msg`Xác nhận liên kết dòng họ`,
    noindex: true,
  },

  // ── Đăng nhập ────────────────────────────────────────────────────
  {
    pattern: "/login",
    title: msg`Đăng nhập`,
    description: msg`Đăng nhập Dòng Họ Việt để quản lý gia phả dòng họ của bạn.`,
  },
  {
    pattern: "/signup",
    title: msg`Tạo tài khoản`,
    description: msg`Tạo tài khoản miễn phí để lập gia phả dòng họ, vẽ cây nhiều đời và mời người thân cùng bổ sung.`,
  },
  { pattern: "/forgot-password", title: msg`Quên mật khẩu` },
  { pattern: "/reset-password", title: msg`Đặt lại mật khẩu` },

  // ── Trong ứng dụng ───────────────────────────────────────────────
  { pattern: "/clans/new", title: msg`Tạo dòng họ mới` },
  { pattern: "/clans/:clanId/people/new", title: msg`Thêm người` },
  {
    pattern: "/clans/:clanId/people/:personId/edit",
    title: msg`Sửa thông tin`,
  },
  {
    pattern: "/clans/:clanId/people/:personId/add-spouse",
    title: msg`Thêm vợ/chồng`,
  },
  {
    pattern: "/clans/:clanId/people/:personId/add-child",
    title: msg`Thêm con`,
  },
  {
    pattern: "/clans/:clanId/people/:personId/add-parent",
    title: msg`Thêm cha/mẹ`,
  },
  { pattern: "/clans/:clanId/people/:personId", title: msg`Hồ sơ thành viên` },
  { pattern: "/clans/:clanId/people", title: msg`Danh sách thành viên` },
  { pattern: "/clans/:clanId/tree", title: msg`Cây gia phả` },
  { pattern: "/clans/:clanId/members", title: msg`Thành viên tài khoản` },
  { pattern: "/clans/:clanId/map", title: msg`Bản đồ dòng họ` },
  {
    pattern: "/clans/:clanId/memory-room/:roomId",
    title: msg`Phòng tưởng niệm`,
  },
  { pattern: "/clans/:clanId/memory-room", title: msg`Phòng tưởng niệm` },
  { pattern: "/clans/:clanId/graves/cemeteries", title: msg`Nghĩa trang` },
  { pattern: "/clans/:clanId/graves/new", title: msg`Thêm mộ phần` },
  { pattern: "/clans/:clanId/graves/:graveId/edit", title: msg`Sửa mộ phần` },
  { pattern: "/clans/:clanId/graves/:graveId", title: msg`Mộ phần` },
  { pattern: "/clans/:clanId/graves", title: msg`Mộ phần & tro cốt` },
  { pattern: "/clans/:clanId/events", title: msg`Sự kiện` },
  { pattern: "/clans/:clanId/honor", title: msg`Sổ vàng` },
  { pattern: "/clans/:clanId/fund", title: msg`Quỹ dòng họ` },
  { pattern: "/clans/:clanId/heritage/new", title: msg`Thêm di sản` },
  { pattern: "/clans/:clanId/heritage/:itemId/edit", title: msg`Sửa di sản` },
  { pattern: "/clans/:clanId/heritage/:itemId", title: msg`Di sản dòng họ` },
  { pattern: "/clans/:clanId/heritage", title: msg`Di sản dòng họ` },
  { pattern: "/clans/:clanId/settings", title: msg`Cài đặt dòng họ` },
  { pattern: "/clans/:clanId/import", title: msg`Nhập dữ liệu` },
  { pattern: "/clans/:clanId/ai-generate", title: msg`Tạo gia phả bằng AI` },
  { pattern: "/clans/:clanId/tro-ly", title: msg`Trợ lý dòng họ` },
  { pattern: "/clans/:clanId/merge", title: msg`Gộp trùng` },
  { pattern: "/clans/:clanId/audit", title: msg`Nhật ký thay đổi` },
  { pattern: "/clans/:clanId/qr-export", title: msg`Xuất mã QR` },
  { pattern: "/clans/:clanId/my-lineage", title: msg`Dòng dõi của tôi` },
  { pattern: "/clans/:clanId/today", title: msg`Hôm nay` },
  { pattern: "/clans/:clanId/xem-ngay", title: msg`Xem ngày tốt` },
  { pattern: "/clans/:clanId/todo", title: msg`Việc cần làm` },
  { pattern: "/clans/:clanId/tools", title: msg`Công cụ` },
  { pattern: "/clans/:clanId/menu", title: msg`Tất cả tính năng` },
  { pattern: "/clans/:clanId/kinship", title: msg`Cách xưng hô` },
  { pattern: "/clans/:clanId/contributions/:contribId", title: msg`Đóng góp` },
  { pattern: "/clans/:clanId/contributions", title: msg`Đóng góp chờ duyệt` },
  {
    pattern: "/clans/:clanId/inlaws/new",
    title: msg`Đề nghị liên kết dòng họ`,
  },
  { pattern: "/clans/:clanId/inlaws", title: msg`Liên kết dòng họ` },
  { pattern: "/clans/:clanId/board/moderation", title: msg`Kiểm duyệt bài` },
  { pattern: "/clans/:clanId/board/new", title: msg`Viết bài` },
  { pattern: "/clans/:clanId/board/:postId/edit", title: msg`Sửa bài` },
  { pattern: "/clans/:clanId/board/:postId", title: msg`Bài viết` },
  { pattern: "/clans/:clanId/board", title: msg`Bảng tin dòng họ` },
  { pattern: "/clans/:clanId", title: msg`Tổng quan dòng họ` },
  {
    pattern: "/clans",
    title: msg`Dòng họ của tôi`,
    description: msg`Danh sách dòng họ bạn đang quản lý hoặc tham gia trên Dòng Họ Việt.`,
  },
  { pattern: "/announcements/:id", title: msg`Thông báo` },
  { pattern: "/announcements", title: msg`Thông báo` },
  { pattern: "/account", title: msg`Tài khoản` },
  { pattern: "/admin/cai-dat", title: msg`Cài đặt nền tảng` },
  { pattern: "/admin", title: msg`Báo cáo nền tảng` },
]) as RouteMeta[];

/** Append the site name, unless the title already is the site name. */
export function formatTitle(title: string | null | undefined): string {
  const t = title?.trim();
  if (!t) return DEFAULT_TITLE;
  return t === SITE_NAME ? DEFAULT_TITLE : `${t} — ${SITE_NAME}`;
}

/** Resolve the static metadata for a pathname. */
export function metaForPath(pathname: string): RouteMeta | null {
  for (const meta of ROUTE_META) {
    if (matchPath({ path: meta.pattern, end: true }, pathname)) return meta;
  }
  return null;
}

/**
 * Write title + description + robots into the document head. Called on
 * every navigation, so it also has to *undo* what the previous route
 * set — hence the explicit reset to the defaults.
 */
export function applyDocumentMeta(meta: {
  title?: string | null;
  description?: string | null;
  noindex?: boolean;
}): void {
  if (typeof document === "undefined") return;

  document.title = formatTitle(meta.title);
  setMetaTag("name", "description", meta.description || DEFAULT_DESCRIPTION);
  setMetaTag("property", "og:title", document.title);
  setMetaTag(
    "property",
    "og:description",
    meta.description || DEFAULT_DESCRIPTION,
  );

  const robots = document.querySelector('meta[name="robots"]');
  if (meta.noindex) {
    if (robots) robots.setAttribute("content", "noindex, nofollow");
    else setMetaTag("name", "robots", "noindex, nofollow");
  } else if (robots) {
    robots.remove();
  }
}

function setMetaTag(attr: "name" | "property", key: string, value: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}
