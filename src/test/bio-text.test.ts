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
