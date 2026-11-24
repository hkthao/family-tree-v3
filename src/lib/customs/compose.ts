import { unaccent } from "@/lib/unaccent";
import type { CustomCategory } from "@/lib/queries/customs";

export interface Draft {
  title: string;
  description: string;
  category: CustomCategory;
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

