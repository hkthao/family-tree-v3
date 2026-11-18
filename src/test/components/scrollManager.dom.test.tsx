/**
 * @vitest-environment jsdom
 */
import { render, cleanup } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScrollManager, isOverlayOnlyChange } from "@/components/ScrollManager";

const STORE_KEY = "family-tree:scroll-positions-v2";

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

  it("mục lịch sử ĐẦU TIÊN (location.key 'default') vẫn khôi phục được — khoá theo history.state.idx", () => {
    // Trên iPhone: mở app vào danh sách, bấm vào một mục, vuốt quay lại. Trước đây mục đầu tiên không bao giờ
    // khôi phục vì khoá 'default' bị bỏ qua.
    window.history.replaceState({ idx: 0 }, "");
    sessionStorage.setItem(STORE_KEY, JSON.stringify({ i0: 700 }));
    try {
      mount("default");
      expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 700 }));
    } finally {
      window.history.replaceState(null, "");
    }
  });

  it("sessionStorage hỏng thì bỏ qua êm, không văng lỗi", () => {
    sessionStorage.setItem(STORE_KEY, "{not json");
    expect(() => mount("k1")).not.toThrow();
  });
});

describe("isOverlayOnlyChange", () => {
  const loc = (pathname: string, search = "") => ({ pathname, search });

  it("chỉ khác tham số ngăn kéo (panel/pid/prel/pfrom) → true", () => {
    expect(isOverlayOnlyChange(loc("/clans/c1/people"), loc("/clans/c1/people", "?panel=person-view&pid=p1"))).toBe(true);
    expect(isOverlayOnlyChange(loc("/a", "?panel=x&pid=1"), loc("/a"))).toBe(true);
  });

  it("khác đường dẫn → false", () => {
    expect(isOverlayOnlyChange(loc("/a"), loc("/b", "?panel=x"))).toBe(false);
  });

  it("khác cả bộ lọc (q, chi…) → false: đó là đổi nội dung trang, không chỉ mở ngăn kéo", () => {
    expect(isOverlayOnlyChange(loc("/a", "?q=an"), loc("/a", "?q=binh&panel=x"))).toBe(false);
    expect(isOverlayOnlyChange(loc("/a", "?q=an"), loc("/a", "?panel=x&q=an"))).toBe(true);
  });
});

describe("ScrollManager — ngăn kéo (?panel=) không làm trang giật lên đầu", () => {
  let scrollTo: ReturnType<typeof vi.fn>;
  let nav: ReturnType<typeof useNavigate>;

  function Grab() {
    nav = useNavigate();
    return null;
  }

  beforeEach(() => {
    sessionStorage.clear();
    scrollTo = vi.fn();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 3000 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  });
  afterEach(cleanup);

  const mount = () =>
    render(
      <MemoryRouter initialEntries={[{ pathname: "/clans/c1/people", key: "k1" }]}>
        <ScrollManager />
        <Grab />
      </MemoryRouter>,
    );

  it("mở ngăn kéo (PUSH chỉ đổi ?panel=) → KHÔNG cuộn về đầu", () => {
    mount();
    scrollTo.mockClear();
    act(() => nav("/clans/c1/people?panel=person-view&pid=p1"));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("đóng ngăn kéo bằng Back → không cuộn lên đầu và không giật tới vị trí khác", () => {
    mount();
    act(() => nav("/clans/c1/people?panel=person-view&pid=p1"));
    scrollTo.mockClear();
    act(() => nav(-1));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("sang một TRANG khác vẫn cuộn về đầu như cũ", () => {
    mount();
    scrollTo.mockClear();
    act(() => nav("/clans/c1/tree"));
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
  });
});
