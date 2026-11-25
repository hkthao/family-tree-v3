import { describe, expect, it } from "vitest";

import { ogTagline, shortPlace } from "@/lib/queries/clan-og";

describe("ảnh chia sẻ dòng họ: chữ ngắn gọn", () => {
  it("tagline: bỏ markdown, cắt có dấu …; trống → null", () => {
    expect(
      ogTagline("**Gia phả** [họ](http://x) ![a](http://i.png)\n\n# Tiêu đề"),
    ).toBe("Gia phả họ Tiêu đề");
    expect(ogTagline("a".repeat(300), 20)?.length).toBe(20);
    expect(ogTagline("  ")).toBeNull();
    expect(ogTagline(null)).toBeNull();
  });
  it("quê gốc: bỏ ngoặc; dài thì lấy địa danh cuối", () => {
    expect(shortPlace("Tức Mặc, Thiên Trường (nay thuộc Nam Định)")).toBe(
      "Tức Mặc, Thiên Trường",
    );
    expect(shortPlace("Hoài Nhơn, Hoài Mỹ, Bình Định")).toBe("Bình Định");
    expect(shortPlace(" ")).toBeNull();
  });
});
