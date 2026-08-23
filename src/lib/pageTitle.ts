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
import { matchPath } from "react-router-dom";

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

export const ROUTE_META: RouteMeta[] = [
  // ── Công khai / SEO ──────────────────────────────────────────────
  {
    pattern: "/so-tay",
    title: "Sổ tay Văn hoá",
    description:
      "Phong tục, nghi lễ và tín ngưỡng Việt Nam: giỗ chạp, tang lễ, cưới hỏi, thờ cúng tổ tiên — giải thích ngắn gọn, dễ tra cứu.",
  },
  { pattern: "/so-tay/new", title: "Thêm bài Sổ tay" },
  { pattern: "/so-tay/import", title: "Nhập bài Sổ tay" },
  { pattern: "/so-tay/:entryId/edit", title: "Sửa bài Sổ tay" },
  {
    pattern: "/so-tay/:entryId",
    title: "Sổ tay Văn hoá",
    description:
      "Phong tục, nghi lễ và tín ngưỡng Việt Nam — giải thích ngắn gọn, dễ tra cứu.",
  },
  {
    pattern: "/xem/so-tay/:entryId",
    title: "Sổ tay Văn hoá",
    description:
      "Phong tục, nghi lễ và tín ngưỡng Việt Nam — giải thích ngắn gọn, dễ tra cứu.",
  },
  {
    pattern: "/xem/clans/:clanId",
    title: "Gia phả dòng họ",
    description:
      "Xem cây gia phả công khai của dòng họ: các đời, ngày giỗ và thông tin thành viên.",
  },
  {
    pattern: "/docs/:slug",
    title: "Hướng dẫn sử dụng",
    description:
      "Hướng dẫn dùng Dòng Họ Việt: tạo dòng họ, thêm người, vẽ cây gia phả, mời người thân cùng bổ sung.",
  },
  {
    pattern: "/docs",
    title: "Hướng dẫn sử dụng",
    description:
      "Hướng dẫn dùng Dòng Họ Việt: tạo dòng họ, thêm người, vẽ cây gia phả, mời người thân cùng bổ sung.",
  },
  {
    pattern: "/huong-dan-video",
    title: "Video hướng dẫn",
    description:
      "Video hướng dẫn từng bước cách lập gia phả dòng họ trên Dòng Họ Việt.",
  },
  { pattern: "/lien-he", title: "Liên hệ" },
  { pattern: "/changelog", title: "Có gì mới" },

  // ── Link chia sẻ / lời mời: URL chính là mật khẩu → noindex ──────
  { pattern: "/share/:token", title: "Cây gia phả được chia sẻ", noindex: true },
  { pattern: "/join/:token", title: "Lời mời vào dòng họ", noindex: true },
  { pattern: "/khoe/:token", title: "Thiệp gia phả", noindex: true },
  { pattern: "/inlaws/confirm/:token", title: "Xác nhận thông gia", noindex: true },

  // ── Đăng nhập ────────────────────────────────────────────────────
  {
    pattern: "/login",
    title: "Đăng nhập",
    description:
      "Đăng nhập Dòng Họ Việt để quản lý gia phả dòng họ của bạn.",
  },
  {
    pattern: "/signup",
    title: "Tạo tài khoản",
    description:
      "Tạo tài khoản miễn phí để lập gia phả dòng họ, vẽ cây nhiều đời và mời người thân cùng bổ sung.",
  },
  { pattern: "/forgot-password", title: "Quên mật khẩu" },
  { pattern: "/reset-password", title: "Đặt lại mật khẩu" },

  // ── Trong ứng dụng ───────────────────────────────────────────────
  { pattern: "/clans/new", title: "Tạo dòng họ mới" },
  { pattern: "/clans/:clanId/people/new", title: "Thêm người" },
  { pattern: "/clans/:clanId/people/:personId/edit", title: "Sửa thông tin" },
  { pattern: "/clans/:clanId/people/:personId/add-spouse", title: "Thêm vợ/chồng" },
  { pattern: "/clans/:clanId/people/:personId/add-child", title: "Thêm con" },
  { pattern: "/clans/:clanId/people/:personId/add-parent", title: "Thêm cha/mẹ" },
  { pattern: "/clans/:clanId/people/:personId", title: "Hồ sơ thành viên" },
  { pattern: "/clans/:clanId/people", title: "Danh sách thành viên" },
  { pattern: "/clans/:clanId/tree", title: "Cây gia phả" },
  { pattern: "/clans/:clanId/members", title: "Thành viên tài khoản" },
  { pattern: "/clans/:clanId/memory-room/:roomId", title: "Phòng tưởng niệm" },
  { pattern: "/clans/:clanId/memory-room", title: "Phòng tưởng niệm" },
  { pattern: "/clans/:clanId/graves/cemeteries", title: "Nghĩa trang" },
  { pattern: "/clans/:clanId/graves/new", title: "Thêm mộ phần" },
  { pattern: "/clans/:clanId/graves/:graveId/edit", title: "Sửa mộ phần" },
  { pattern: "/clans/:clanId/graves/:graveId", title: "Mộ phần" },
  { pattern: "/clans/:clanId/graves", title: "Mộ phần & tro cốt" },
  { pattern: "/clans/:clanId/events", title: "Sự kiện" },
  { pattern: "/clans/:clanId/honor", title: "Sổ vàng" },
  { pattern: "/clans/:clanId/fund", title: "Quỹ dòng họ" },
  { pattern: "/clans/:clanId/heritage/new", title: "Thêm di sản" },
  { pattern: "/clans/:clanId/heritage/:itemId/edit", title: "Sửa di sản" },
  { pattern: "/clans/:clanId/heritage/:itemId", title: "Di sản dòng họ" },
  { pattern: "/clans/:clanId/heritage", title: "Di sản dòng họ" },
  { pattern: "/clans/:clanId/settings", title: "Cài đặt dòng họ" },
  { pattern: "/clans/:clanId/import", title: "Nhập dữ liệu" },
  { pattern: "/clans/:clanId/ai-generate", title: "Tạo gia phả bằng AI" },
  { pattern: "/clans/:clanId/tro-ly", title: "Trợ lý dòng họ" },
  { pattern: "/clans/:clanId/merge", title: "Gộp trùng" },
  { pattern: "/clans/:clanId/audit", title: "Nhật ký thay đổi" },
  { pattern: "/clans/:clanId/qr-export", title: "Xuất mã QR" },
  { pattern: "/clans/:clanId/my-lineage", title: "Dòng dõi của tôi" },
  { pattern: "/clans/:clanId/today", title: "Hôm nay" },
  { pattern: "/clans/:clanId/xem-ngay", title: "Xem ngày tốt" },
  { pattern: "/clans/:clanId/todo", title: "Việc cần làm" },
  { pattern: "/clans/:clanId/tools", title: "Công cụ" },
  { pattern: "/clans/:clanId/kinship", title: "Cách xưng hô" },
  { pattern: "/clans/:clanId/contributions/:contribId", title: "Đóng góp" },
  { pattern: "/clans/:clanId/contributions", title: "Đóng góp chờ duyệt" },
  { pattern: "/clans/:clanId/inlaws/new", title: "Thêm thông gia" },
  { pattern: "/clans/:clanId/inlaws", title: "Thông gia" },
  { pattern: "/clans/:clanId/board/moderation", title: "Kiểm duyệt bài" },
  { pattern: "/clans/:clanId/board/new", title: "Viết bài" },
  { pattern: "/clans/:clanId/board/:postId/edit", title: "Sửa bài" },
  { pattern: "/clans/:clanId/board/:postId", title: "Bài viết" },
  { pattern: "/clans/:clanId/board", title: "Bảng tin dòng họ" },
  { pattern: "/clans/:clanId", title: "Tổng quan dòng họ" },
  {
    pattern: "/clans",
    title: "Dòng họ của tôi",
    description:
      "Danh sách dòng họ bạn đang quản lý hoặc tham gia trên Dòng Họ Việt.",
  },
  { pattern: "/announcements/:id", title: "Thông báo" },
  { pattern: "/announcements", title: "Thông báo" },
  { pattern: "/account", title: "Tài khoản" },
  { pattern: "/admin", title: "Quản trị hệ thống" },
];

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
