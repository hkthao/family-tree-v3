/**
 * @vitest-environment jsdom
 */
import { render, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScrollManager } from "@/components/ScrollManager";

const STORE_KEY = "family-tree:scroll-positions-v1";

/**
 * Vuốt quay lại trên điện thoại có thể NẠP LẠI cả trang (iOS giải phóng trang nền). Khi đó bộ nhớ mất hết,
 * nhưng khoá mục lịch sử vẫn còn trong history.state → vị trí phải đọc lại được từ sessionStorage.
 */
describe("ScrollManager — khôi phục vị trí cuộn", () => {
  let scrollTo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    scrollTo = vi.fn();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    // Trang đủ cao để cuộn tới 500.
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 3000,
    });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const mount = (key: string) =>
    render(
      <MemoryRouter initialEntries={[{ pathname: "/clans/c1", key }]}>
        <ScrollManager />
      </MemoryRouter>,
    );

  it("nạp lại trang ở một mục lịch sử đã có vị trí lưu → cuộn về đúng vị trí đó", () => {
    sessionStorage.setItem(STORE_KEY, JSON.stringify({ k1: 500 }));
    mount("k1");
    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ top: 500 }),
    );
  });

  it("mục chưa có vị trí lưu thì lên đầu trang, không cuộn tới đâu khác", () => {
    sessionStorage.setItem(STORE_KEY, JSON.stringify({ other: 900 }));
    mount("k2");
    const tops = scrollTo.mock.calls.map((c) => (c[0] as { top: number }).top);
    expect(tops.every((y) => y === 0)).toBe(true);
  });

  it("khoá 'default' (lần mở đầu tiên của tab) không khôi phục vị trí của mục khác", () => {
    sessionStorage.setItem(STORE_KEY, JSON.stringify({ default: 700 }));
    mount("default");
    const tops = scrollTo.mock.calls.map((c) => (c[0] as { top: number }).top);
    expect(tops).not.toContain(700);
  });

  it("sessionStorage hỏng thì bỏ qua êm, không văng lỗi", () => {
    sessionStorage.setItem(STORE_KEY, "{not json");
    expect(() => mount("k1")).not.toThrow();
  });
});
