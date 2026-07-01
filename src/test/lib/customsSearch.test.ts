import { describe, expect, it } from "vitest";

import { expandNeedles } from "@/lib/queries/customs";
import { unaccent } from "@/lib/unaccent";

describe("expandNeedles — tìm theo tình huống (synonym)", () => {
  it("gõ tình huống 'nhà mới' → mở rộng tới 'nhập trạch'", () => {
    const needles = expandNeedles("nhà mới");
    expect(needles).toContain(unaccent("nhập trạch"));
  });

  it("gõ 'đám hỏi' → mở rộng tới 'ăn hỏi'/'cưới hỏi'", () => {
    const needles = expandNeedles("đám hỏi");
    expect(needles).toContain(unaccent("ăn hỏi"));
  });

  it("gõ 'tảo mộ' → mở rộng tới 'thanh minh'", () => {
    const needles = expandNeedles("tảo mộ");
    expect(needles).toContain(unaccent("thanh minh"));
  });

  it("bỏ dấu: 'nha moi' cũng khớp như 'nhà mới'", () => {
    expect(expandNeedles("nha moi")).toContain(unaccent("nhập trạch"));
  });

  it("chuỗi rỗng → không có needle", () => {
    expect(expandNeedles("   ")).toEqual([]);
  });

  it("từ khoá lạ → chỉ chính nó (không nổ synonym)", () => {
    const needles = expandNeedles("xyzkhongtontai");
    expect(needles).toEqual(["xyzkhongtontai"]);
  });
});
