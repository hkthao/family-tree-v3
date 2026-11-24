import { unaccent } from "@/lib/unaccent";

/** Danh mục Blog (phải khớp content-site/src/taxonomy.ts và supabase/functions/publish-so-tay/core.ts). Nhãn có tên chuyên mục. */
export const BLOG_CATEGORIES: { value: string; label: string }[] = [
  { value: "tho_cung", label: "Sổ tay văn hoá · Thờ cúng & tín ngưỡng" },
  { value: "vong_doi", label: "Sổ tay văn hoá · Nghi lễ vòng đời" },
  { value: "sinh_hoat", label: "Sổ tay văn hoá · Phong tục sinh hoạt" },
  { value: "van_khan", label: "Sổ tay văn hoá · Văn khấn & văn tế" },
  { value: "le_tet", label: "Lễ hội & Phong tục · Lễ Tết theo mùa" },
  { value: "le_hoi", label: "Lễ hội & Phong tục · Lễ hội cộng đồng" },
  { value: "di_san_vat_the", label: "Di sản Việt · Di tích & di sản vật thể" },
  { value: "di_san_phi_vat_the", label: "Di sản Việt · Di sản phi vật thể" },
  { value: "bat_dau", label: "Hướng dẫn sử dụng · Bắt đầu" },
  { value: "tinh_nang", label: "Hướng dẫn sử dụng · Tính năng" },
  { value: "lap_gia_pha", label: "Kiến thức gia phả · Lập gia phả" },
  { value: "dong_ho_hoc", label: "Kiến thức gia phả · Họ hàng & dòng họ" },
];

export interface Draft {
  title: string;
  description: string;
  category: string;
  tags: string;
  aliases: string;
  regions: string;
  timing: string;
  body: string;
}

export const EMPTY_DRAFT: Draft = {
  title: "",
  description: "",
  category: "le_hoi",
  tags: "",
  aliases: "",
  regions: "",
  timing: "",
  body: "## Ý nghĩa\n\n\n## Chuẩn bị / lễ vật\n\n\n## Trình tự thực hiện\n\n\n## Biến thể vùng miền\n\n",
};

const list = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

/** Chuỗi JSON cũng là chuỗi YAML hợp lệ → đủ an toàn cho tiêu đề có dấu hai chấm, nháy… */
const y = (s: string) => JSON.stringify(s);

export function slugOf(title: string): string {
  return unaccent(title)
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Dựng tệp .md đúng khuôn content-site/content/so-tay (frontmatter + thân), status mặc định needs_review. */
export function buildMarkdownFile(d: Draft, today = new Date().toISOString().slice(0, 10)): string {
  const arr = (a: string[]) => `[${a.map(y).join(", ")}]`;
  const lines = [
    "---",
    "status: needs_review",
    `title: ${y(d.title.trim())}`,
    `description: ${y(d.description.trim())}`,
    `updated: ${today}`,
    `category: ${d.category}`,
    `tags: ${arr(list(d.tags))}`,
    `aliases: ${arr(list(d.aliases))}`,
    `regions: ${arr(list(d.regions))}`,
    ...(d.timing.trim() ? [`timing: ${y(d.timing.trim())}`] : []),
    "---",
    "",
    d.body.trim(),
    "",
  ];
  return lines.join("\n");
}

