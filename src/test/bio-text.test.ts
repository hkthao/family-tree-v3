import { describe, expect, it } from "vitest";

import { parseBio } from "@/components/BioText";

describe("parseBio", () => {
  it("ẩn mục không có nội dung", () => {
    const blocks = parseBio("## Tóm lược\nA\n\n## Xuất thân\n\n## Lên ngôi\nB\n\n## Gia quyến\n");
    expect(blocks.filter((b) => b.kind === "h").map((b) => (b as { text: string }).text)).toEqual([
      "Tóm lược",
      "Lên ngôi",
    ]);
  });
});

describe("bioToPlainText", () => {
  it("bỏ ## và mục trống cho PDF", async () => {
    const { bioToPlainText } = await import("@/lib/bio");
    const out = bioToPlainText("## Tóm lược\nA\n\n## Xuất thân\n\n## Lên ngôi\nB\n\n## Sự nghiệp theo năm\n- Năm X: C\n\nTheo: Nguồn");
    expect(out).not.toMatch(/##/);
    expect(out).toContain("A");
    expect(out).toContain("Lên ngôi: B");
    expect(out).toContain("• Năm X: C");
    expect(out).not.toContain("Xuất thân");
    expect(bioToPlainText("Tiểu sử thường")).toBe("Tiểu sử thường");
  });
});
