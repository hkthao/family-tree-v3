import { describe, expect, it } from "vitest";

import { inferGenderFromName } from "@/lib/nameGender";

describe("inferGenderFromName", () => {
  describe("personal-name (last token) signals", () => {
    it("identifies strongly-male names", () => {
      expect(inferGenderFromName("Nguyễn Văn Hùng")).toBe("M");
      expect(inferGenderFromName("Trần Tuấn")).toBe("M");
      expect(inferGenderFromName("Lê Đức")).toBe("M");
      expect(inferGenderFromName("Phạm Quang Vinh")).toBe("M");
      expect(inferGenderFromName("Đỗ Hoàng")).toBe("M");
    });

    it("identifies strongly-female names", () => {
      expect(inferGenderFromName("Nguyễn Thị Hương")).toBe("F");
      expect(inferGenderFromName("Trần Mai")).toBe("F");
      expect(inferGenderFromName("Lê Lan")).toBe("F");
      expect(inferGenderFromName("Phạm Thu Trang")).toBe("F");
      expect(inferGenderFromName("Đỗ Hằng")).toBe("F");
    });

    it("personal-name wins over đệm (Văn Hương → F)", () => {
      // Compound names with feminine personal syllable do exist —
      // the syllable carries the gender, not the đệm slot.
      expect(inferGenderFromName("Nguyễn Văn Hương")).toBe("F");
      expect(inferGenderFromName("Trần Thị Hùng")).toBe("M");
    });
  });

  describe("đệm fallback", () => {
    it('"Văn" without a personal-name signal → M', () => {
      // "Khôi" is in MALE_NAMES but for this test we need a tail
      // token that's NOT in either name list. "Bình" is intentionally
      // ambiguous so the đệm decides.
      expect(inferGenderFromName("Nguyễn Văn Bình")).toBe("M");
    });

    it('"Thị" without a personal-name signal → F', () => {
      expect(inferGenderFromName("Trần Thị Bình")).toBe("F");
    });
  });

  describe("ambiguous → null", () => {
    it("returns null for unisex names so caller keeps current gender", () => {
      expect(inferGenderFromName("Nguyễn Minh Anh")).toBeNull();
      expect(inferGenderFromName("Trần Ngọc")).toBeNull();
      expect(inferGenderFromName("Lê Thanh")).toBeNull();
      expect(inferGenderFromName("Phạm Phương")).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("returns null for empty / surname-only", () => {
      expect(inferGenderFromName("")).toBeNull();
      expect(inferGenderFromName("   ")).toBeNull();
      expect(inferGenderFromName("Nguyễn")).toBeNull();
    });

    it("is case-insensitive", () => {
      expect(inferGenderFromName("nguyễn văn hùng")).toBe("M");
      expect(inferGenderFromName("NGUYỄN THỊ HƯƠNG")).toBe("F");
    });

    it("collapses extra whitespace", () => {
      expect(inferGenderFromName("  Nguyễn   Văn   Hùng  ")).toBe("M");
    });
  });
});
