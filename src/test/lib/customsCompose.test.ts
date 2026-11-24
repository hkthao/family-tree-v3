import { describe, expect, it } from "vitest";

import { buildMarkdownFile, EMPTY_DRAFT, slugOf } from "@/lib/customs/compose";

describe("soạn bài Sổ tay", () => {
  it("slug không dấu, bỏ phần trong ngoặc", () => {
    expect(slugOf("Lễ nhập trạch (về nhà mới)")).toBe("le-nhap-trach");
    expect(slugOf("Đền Hùng: Giỗ Tổ")).toBe("den-hung-gio-to");
  });

  it("xuất tệp .md đúng khuôn frontmatter, an toàn với dấu hai chấm/nháy", () => {
    const md = buildMarkdownFile(
      { ...EMPTY_DRAFT, title: 'Lễ "Vu Lan": báo hiếu', description: "Mô tả đủ dài để qua kiểm tra.", tags: "Miền Bắc, Hà Nội", category: "le_tet", body: "## Ý nghĩa\n\nNội dung" },
      "2026-11-25",
    );
    expect(md.startsWith("---\nstatus: needs_review\n")).toBe(true);
    expect(md).toContain('title: "Lễ \\"Vu Lan\\": báo hiếu"');
    expect(md).toContain('tags: ["Miền Bắc", "Hà Nội"]');
    expect(md).toContain("category: le_tet");
    expect(md).toContain("updated: 2026-11-25");
    expect(md.trim().endsWith("Nội dung")).toBe(true);
  });
});
