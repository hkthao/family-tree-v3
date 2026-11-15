/**
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { HomeCustomizeDrawer } from "@/components/HomeCustomizeDrawer";
import { __resetHomePrefsStore, useHomePrefs } from "@/hooks/useHomePrefs";
import type { QuickEntry } from "@/lib/quickCatalog";

const entry = (key: string, label: string, core = false): QuickEntry => ({
  key,
  label,
  short: label,
  icon: null,
  to: `/clans/c1/${key}`,
  core,
});
const catalog = [
  entry("tree", "Cây gia phả", true),
  entry("people", "Danh bạ", true),
  entry("todo", "Việc cần làm"),
  entry("graves", "Mộ phần"),
  entry("board", "Bảng tin"),
];

describe("tuỳ chỉnh trang chủ", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetHomePrefsStore();
  });
  afterEach(cleanup);

  const open = (shown: QuickEntry[], pinned: boolean) =>
    render(
      <HomeCustomizeDrawer open onClose={() => {}} catalog={catalog} shown={shown} pinned={pinned} />,
    );

  it("chọn một ô chưa hiện → chuyển sang chế độ ghim, đúng các ô đang hiện + ô mới", () => {
    open(catalog.slice(0, 3), false);
    fireEvent.click(screen.getByLabelText("Mộ phần"));
    const { result } = renderHook(() => useHomePrefs());
    expect(result.current.prefs.pins).toEqual(["tree", "people", "todo", "graves"]);
  });

  it("bỏ chọn một ô đang hiện → ô đó rời danh sách ghim", () => {
    open(catalog.slice(0, 3), false);
    fireEvent.click(screen.getByLabelText("Danh bạ"));
    const { result } = renderHook(() => useHomePrefs());
    expect(result.current.prefs.pins).toEqual(["tree", "todo"]);
  });

  it("chế độ ghim: có nút chuyển lên/xuống và 'Quay về tự động'", () => {
    open(catalog.slice(0, 3), true);
    fireEvent.click(screen.getAllByLabelText("Chuyển xuống")[0]); // tree xuống dưới people
    const { result } = renderHook(() => useHomePrefs());
    expect(result.current.prefs.pins).toEqual(["people", "tree", "todo"]);
    fireEvent.click(screen.getByText("Quay về tự động"));
    expect(result.current.prefs.pins).toBeNull();
  });

  it("chế độ tự động không hiện nút chuyển lên/xuống", () => {
    open(catalog.slice(0, 3), false);
    expect(screen.queryAllByLabelText("Chuyển xuống")).toHaveLength(0);
  });

  it("ẩn/hiện thẻ ở trang chủ", () => {
    open(catalog.slice(0, 2), false);
    fireEvent.click(screen.getByLabelText("Bản đồ dòng họ"));
    const { result } = renderHook(() => useHomePrefs());
    expect(result.current.show("map")).toBe(false);
    expect(result.current.show("stats")).toBe(true);
    act(() => result.current.toggleHidden("map"));
    expect(result.current.show("map")).toBe(true);
  });

  it("khi đã đủ số ô tối đa thì các ô chưa chọn bị khoá, không ghim thêm được", () => {
    const many = Array.from({ length: 11 }, (_, i) => entry(`k${i}`, `Ô ${i}`));
    render(
      <HomeCustomizeDrawer
        open
        onClose={() => {}}
        catalog={[...many, entry("extra", "Ô thừa")]}
        shown={many}
        pinned
      />,
    );
    expect((screen.getByLabelText("Ô thừa") as HTMLInputElement).disabled).toBe(true);
  });

  it("nút Đặt lại xoá ghim và thẻ đã ẩn", () => {
    const { result } = renderHook(() => useHomePrefs());
    act(() => {
      result.current.setPins(["tree"]);
      result.current.toggleHidden("map");
      result.current.bump("todo");
    });
    expect(result.current.prefs.pins).toEqual(["tree"]);
    act(() => result.current.reset());
    expect(result.current.prefs).toEqual({ pins: null, hidden: [], counts: {} });
  });
});
