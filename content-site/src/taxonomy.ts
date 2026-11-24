/** 6 danh mục gốc của Sổ tay (khớp nhãn trong app: src/lib/queries/customs.ts). Thẻ (tag) là phân loại tự do. */
export const CATEGORIES = [
  { slug: "tho_cung", name: "Thờ cúng & tín ngưỡng" },
  { slug: "vong_doi", name: "Nghi lễ vòng đời" },
  { slug: "le_tet", name: "Lễ Tết theo mùa" },
  { slug: "le_hoi", name: "Lễ hội cộng đồng" },
  { slug: "sinh_hoat", name: "Phong tục sinh hoạt" },
  { slug: "van_khan", name: "Văn khấn & văn tế" },
] as const;

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as [string, ...string[]];

export const categoryName = (slug: string) => CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
/** Danh mục dùng trong URL: tho_cung → tho-cung. */
export const categoryUrl = (slug: string) => slug.replace(/_/g, "-");
export const categoryFromUrl = (u: string) => u.replace(/-/g, "_");

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
