import { describe, expect, it } from "vitest";

import {
  DEFAULT_THEME_ID,
  getPosterTheme,
  getPosterThemes,
} from "@/lib/timeline/themes";

describe("mẫu nền poster dòng thời gian", () => {
  it("id không trùng, mẫu mặc định có mặt", () => {
    const ids = getPosterThemes().map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(DEFAULT_THEME_ID);
  });
  it("mỗi mẫu đủ màu: chấm và giấy ghi chú ≥5 màu, có tên + mô tả", () => {
    for (const th of getPosterThemes()) {
      expect(th.label.length).toBeGreaterThan(0);
      expect(th.hint.length).toBeGreaterThan(0);
      expect(th.dots.length).toBeGreaterThanOrEqual(5);
      expect(th.notes.length).toBeGreaterThanOrEqual(5);
      expect(th.bg).toBeTruthy();
      expect(th.solid).toMatch(/^#/);
      expect(th.seal).toMatch(/^#[0-9a-fA-F]{6}$/); // màu mực con triện
    }
  });
  it("id lạ / rỗng thì quay về mẫu mặc định", () => {
    expect(getPosterTheme("khong-co").id).toBe(DEFAULT_THEME_ID);
    expect(getPosterTheme(null).id).toBe(DEFAULT_THEME_ID);
  });
});
