/**
 * Phân loại Blog 2 tầng: CHUYÊN MỤC (channel, hiện ở menu/trang chủ blog, có địa chỉ riêng) → DANH MỤC (category, nhóm
 * trong chuyên mục). Mỗi danh mục thuộc đúng một chuyên mục nên bài chỉ cần khai `category`; chuyên mục suy ra từ đó.
 * Thẻ (tag) là phân loại tự do, dùng xuyên chuyên mục.
 *
 * `base` là tiền tố địa chỉ bài: /so-tay/<bài>.html … Riêng "Kiến thức gia phả" giữ /huong-dan để không đổi địa chỉ
 * các bài đã có trên Google.
 */
export const CHANNELS = [
  { slug: "so-tay", base: "/so-tay", name: "Sổ tay văn hoá", blurb: "Phong tục thờ cúng, nghi lễ vòng đời, văn khấn: làm thế nào cho đúng, cho đủ." },
  { slug: "le-hoi", base: "/le-hoi", name: "Lễ hội & Phong tục", blurb: "Lễ hội truyền thống, lễ Tết theo mùa: thời gian âm lịch, nghi lễ, kinh nghiệm đi hội." },
  { slug: "di-san", base: "/di-san", name: "Di sản Việt", blurb: "Di tích, di sản văn hoá vật thể và phi vật thể gắn với cội nguồn dân tộc." },
  { slug: "phan-mem", base: "/phan-mem", name: "Hướng dẫn sử dụng", blurb: "Cách dùng phần mềm Dòng Họ Việt từng bước, dễ làm theo." },
  { slug: "kien-thuc", base: "/huong-dan", name: "Kiến thức gia phả", blurb: "Lập gia phả, tính ngày giỗ âm lịch, xưng hô họ hàng, thuật ngữ và mẫu sổ gia phả." },
] as const;

export type ChannelSlug = (typeof CHANNELS)[number]["slug"];

export const CATEGORIES = [
  // Sổ tay văn hoá (khớp nhãn trong app: src/lib/queries/customs.ts)
  { slug: "tho_cung", channel: "so-tay", name: "Thờ cúng & tín ngưỡng" },
  { slug: "vong_doi", channel: "so-tay", name: "Nghi lễ vòng đời" },
  { slug: "sinh_hoat", channel: "so-tay", name: "Phong tục sinh hoạt" },
  { slug: "van_khan", channel: "so-tay", name: "Văn khấn & văn tế" },
  // Lễ hội & Phong tục
  { slug: "le_tet", channel: "le-hoi", name: "Lễ Tết theo mùa" },
  { slug: "le_hoi", channel: "le-hoi", name: "Lễ hội cộng đồng" },
  // Di sản Việt
  { slug: "di_san_vat_the", channel: "di-san", name: "Di tích & di sản vật thể" },
  { slug: "di_san_phi_vat_the", channel: "di-san", name: "Di sản phi vật thể" },
  // Hướng dẫn sử dụng phần mềm
  { slug: "bat_dau", channel: "phan-mem", name: "Bắt đầu" },
  { slug: "tinh_nang", channel: "phan-mem", name: "Tính năng" },
  // Kiến thức gia phả
  { slug: "lap_gia_pha", channel: "kien-thuc", name: "Lập gia phả" },
  { slug: "dong_ho_hoc", channel: "kien-thuc", name: "Họ hàng & dòng họ" },
] as const;

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as [string, ...string[]];

/** Chuyên mục có trong app (mục Sổ tay): các bài thuộc hai chuyên mục này mới xuất sang app. */
export const APP_CHANNELS: readonly string[] = ["so-tay", "le-hoi"];

export const categoryName = (slug: string) => CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
/** Danh mục dùng trong URL: tho_cung → tho-cung. */
export const categoryUrl = (slug: string) => slug.replace(/_/g, "-");
export const categoryFromUrl = (u: string) => u.replace(/-/g, "_");

export const channelOfCategory = (slug: string) => CHANNELS.find((ch) => ch.slug === CATEGORIES.find((c) => c.slug === slug)?.channel) ?? CHANNELS[0];
export const channelBySlug = (slug: string) => CHANNELS.find((c) => c.slug === slug);

/** Địa chỉ trang chuyên mục (trang 1) và trang danh mục (trang 1), không kèm .html. */
export const channelBase = (slug: string) => channelBySlug(slug)?.base ?? "/blog";
export const categoryBase = (slug: string) => `${channelOfCategory(slug).base}/danh-muc/${categoryUrl(slug)}`;
export const TAG_BASE = "/blog/the";

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
