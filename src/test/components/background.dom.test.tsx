/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  DIM_MAX,
  DIM_MIN,
  backgroundUrl,
  getBackground,
  initBackground,
  setBackground,
} from "@/lib/background";

describe("background store", () => {
  beforeEach(() => {
    localStorage.clear();
    initBackground();
    setBackground({ id: null });
  });

  it("mặc định tắt", () => {
    expect(getBackground().id).toBeNull();
    expect(document.documentElement.dataset.bg).toBeUndefined();
  });

  it("chọn tranh thì ghi cờ lên <html> và nhớ qua lần mở sau", () => {
    setBackground({ id: "truc" });
    expect(document.documentElement.dataset.bg).toBe("on");
    initBackground();
    expect(getBackground().id).toBe("truc");
  });

  it("kẹp độ phủ trong [DIM_MIN, DIM_MAX] — không bao giờ tắt hẳn lớp phủ", () => {
    setBackground({ id: "sen", dim: 0 });
    expect(getBackground().dim).toBe(DIM_MIN);
    setBackground({ dim: 5 });
    expect(getBackground().dim).toBe(DIM_MAX);
  });

  it("id lạ trong localStorage bị bỏ qua", () => {
    localStorage.setItem("family-tree:bg", JSON.stringify({ id: "khong-co", dim: 0.7 }));
    initBackground();
    expect(getBackground().id).toBeNull();
  });

  it("đường dẫn tranh theo sáng/tối và ngang/dọc", () => {
    expect(backgroundUrl("mai", true, true)).toBe("/backgrounds/mai-dark-lg.webp");
    expect(backgroundUrl("mai", false, false)).toBe("/backgrounds/mai-light-sm.webp");
  });
});
