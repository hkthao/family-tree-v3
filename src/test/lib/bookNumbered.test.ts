import { describe, expect, it } from "vitest";

import { parseNumbered } from "@/lib/pdf/bookSections";

describe("parseNumbered: chỉ mục 1. 2. 3. luôn đậm", () => {
  it("đề mục ngắn đậm cả dòng, kể cả khi kết thúc bằng dấu câu", () => {
    for (const t of ["1. Tổ phụ và tổ quán", "2) Nhà thờ họ", "III. Phụ khảo", "4. Nhà thờ họ.", "5. Lễ cúng:"]) {
      expect(parseNumbered(t)?.heading).toBe(true);
    }
    expect(parseNumbered("PHẦN MỘT – GIA PHẢ CỔ")?.heading).toBe(true);
  });

  it("dòng dài mở đầu bằng số: chỉ đậm phần số", () => {
    const long = "1. " + "Rất dài ".repeat(30);
    const n = parseNumbered(long);
    expect(n).not.toBeNull();
    expect(n?.heading).toBe(false);
    expect(n?.prefix).toBe("1.");
  });

  it("đoạn văn thường không phải chỉ mục", () => {
    expect(parseNumbered("Họ Trần sinh cơ lập nghiệp ở đây.")).toBeNull();
    expect(parseNumbered("1900 người đã về dự.")).toBeNull();
  });
});
