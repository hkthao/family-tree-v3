/**
 * Trang dòng họ (docs/plan-trang-dong-ho.md): trang nào hiện, menu dựng thế nào.
 *
 * Nguồn duy nhất là `clans.share_sections` (cùng hệ cờ với ShareSectionsCard). Cây gia phả luôn có; Cùng góp
 * phụ thuộc quyền đóng góp của link chứ không phải một khoá. `events` là khoá mới sẽ thêm ở bước migration.
 */

export type SiteSectionKey = "info" | "board" | "map" | "heritage" | "graves" | "honor" | "mosaic" | "events" | "profiles";

export type SitePageKey =
  | "home"
  | "board"
  | "tree"
  | "events"
  | "heritage"
  | "graves"
  | "honor"
  | "contribute"
  /** Hồ sơ một người (`nguoi/:id`): không có trong menu, đi tới từ cây / tìm kiếm. */
  | "person"
  /** Thiệp khoe `/khoe/:token`: trang một mục trong khung dòng họ, không nằm trong menu đầy đủ. */
  | "card";

/** Mục menu thả xuống "Di sản" gồm các trang nào, theo thứ tự hiển thị. */
export const SITE_GROUP_PAGES: SitePageKey[] = ["heritage", "graves", "honor"];

/** Trang → khoá bắt buộc bật (null = luôn có). `contribute` xử lý riêng theo quyền của link. */
const PAGE_SECTION: Record<SitePageKey, SiteSectionKey | null> = {
  home: null,
  board: "board",
  tree: null,
  events: "events",
  heritage: "heritage",
  graves: "graves",
  honor: "honor",
  contribute: null,
  person: null,
  card: null,
};

export function isPageVisible(
  page: SitePageKey,
  sections: readonly string[],
  opts: { canContribute?: boolean } = {},
): boolean {
  if (page === "contribute") return !!opts.canContribute;
  const need = PAGE_SECTION[page];
  return need === null || sections.includes(need);
}

export type SiteMenuEntry =
  | { kind: "page"; page: SitePageKey }
  | { kind: "group"; pages: SitePageKey[] };

/**
 * Menu: Trang chủ · Bảng tin · Cây · Sự kiện · [Di sản ▾] · Cùng góp.
 * Trang tắt thì bỏ; nhóm còn 1 trang thì hiện thẳng trang đó, hết trang thì bỏ nhóm.
 */
export function buildSiteMenu(
  sections: readonly string[],
  opts: { canContribute?: boolean } = {},
): SiteMenuEntry[] {
  const vis = (p: SitePageKey) => isPageVisible(p, sections, opts);
  const out: SiteMenuEntry[] = [];
  for (const p of ["home", "board", "tree", "events"] as const) if (vis(p)) out.push({ kind: "page", page: p });
  const group = SITE_GROUP_PAGES.filter(vis);
  if (group.length === 1) out.push({ kind: "page", page: group[0] });
  else if (group.length > 1) out.push({ kind: "group", pages: group });
  if (vis("contribute")) out.push({ kind: "page", page: "contribute" });
  return out;
}

/** Scope của link/payload mà trang dòng họ dùng được (link xem cây và link mời góp); QR mộ / di sản / một người thì không. */
export const SITE_SCOPES = ["tree_view", "contribute"] as const;
export const isSiteScope = (scope: string | undefined): boolean => !!scope && (SITE_SCOPES as readonly string[]).includes(scope);

/**
 * Link "tập trung" (QR người / mộ / di sản): cũng mở trong khung trang dòng họ nhưng chỉ có MỘT mục — chính thứ được chia sẻ — để
 * mọi link chia sẻ đều vào đúng menu mà không lộ phần còn lại của dòng họ. Giá trị: mục menu tương ứng.
 */
export const FOCUS_SCOPE_PAGE: Record<string, SitePageKey> = { single_person: "person", resting_place: "graves", heritage_item: "heritage" };
export const focusPageOf = (scope: string | undefined): SitePageKey | null => (scope && FOCUS_SCOPE_PAGE[scope]) || null;
/** Scope mở trong khung trang dòng họ (đầy đủ hoặc tập trung). */
export const isShellScope = (scope: string | undefined): boolean => isSiteScope(scope) || focusPageOf(scope) !== null;

/** Đoạn đường dẫn của từng trang, tính từ gốc (`/share/:token` hoặc `/xem/clans/:id`). Trang chủ = rỗng. */
export const SITE_PAGE_PATH: Record<SitePageKey, string> = {
  home: "",
  board: "bang-tin",
  tree: "cay",
  events: "su-kien",
  heritage: "di-san",
  graves: "mo-phan",
  honor: "bang-vang",
  contribute: "cung-gop",
  person: "nguoi",
  card: "thiep",
};

export function sitePagePath(base: string, page: SitePageKey, id?: string): string {
  const seg = SITE_PAGE_PATH[page];
  const tail = [seg, id].filter(Boolean).join("/");
  return tail ? `${base}/${tail}` : base;
}

/** Trang ứng với một đường dẫn con (sau `base`), hoặc null nếu không khớp trang nào. */
export function sitePageFromSub(sub: string): SitePageKey | null {
  const first = sub.replace(/^\/+/, "").split("/")[0] ?? "";
  const hit = (Object.keys(SITE_PAGE_PATH) as SitePageKey[]).find((k) => SITE_PAGE_PATH[k] === first);
  return hit ?? null;
}

/**
 * Bật giao diện website: biến môi trường VITE_CLAN_SITE=1, hoặc `?site=1` (nhớ trong phiên); `?site=0` tắt.
 * Trong lúc làm dở, mặc định vẫn là trang Share cũ.
 */
export function resolveSiteFlag(search: string, stored: string | null, env: string | undefined): boolean {
  const q = new URLSearchParams(search).get("site");
  if (q === "1") return true;
  if (q === "0") return false;
  if (stored === "1") return true;
  if (stored === "0") return false;
  return env === "1";
}
