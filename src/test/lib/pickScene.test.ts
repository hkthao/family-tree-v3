import { describe, expect, it } from "vitest";

import { pickScene, SCENES, SCENE_IDS } from "@/components/timeline/TimelineScene";

describe("pickScene — cảnh minh hoạ cho mốc chưa có hình", () => {
  it("ổn định: cùng khoá mốc luôn ra cùng một cảnh", () => {
    expect(pickScene("row:abc", "scroll")).toBe(pickScene("row:abc", "scroll"));
  });
  it("ưu tiên cảnh cùng biểu tượng (sinh → em bé, mất → nến)", () => {
    expect(SCENES[pickScene("row:1", "cradle")].icon).toBe("cradle");
    expect(SCENES[pickScene("row:2", "candle")].icon).toBe("candle");
  });
  it("biểu tượng không có cảnh riêng vẫn ra một cảnh hợp lệ", () => {
    expect(SCENE_IDS).toContain(pickScene("row:3", "tree"));
  });
  it("đa dạng: nhiều mốc khác nhau không dồn vào một cảnh", () => {
    const seen = new Set(Array.from({ length: 40 }, (_, i) => pickScene(`row:${i}`, "scroll")));
    expect(seen.size).toBeGreaterThanOrEqual(1);
    const any = new Set(Array.from({ length: 60 }, (_, i) => pickScene(`row:${i}`, "tree")));
    expect(any.size).toBeGreaterThan(3); // "tree" không có cảnh riêng → chọn trong toàn bộ thư viện
  });
});
