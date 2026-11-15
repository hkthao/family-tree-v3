/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  EMPTY_PREFS,
  orderQuick,
  readHomePrefs,
  writeHomePrefs,
} from "@/lib/homePrefs";

const item = (key: string, core = false) => ({ key, core });
const all = [
  item("tree", true),
  item("people", true),
  item("add"),
  item("todo"),
  item("graves"),
  item("board"),
];

describe("orderQuick", () => {
  it("chưa ghim: ô lõi đứng đầu, còn lại giữ thứ tự mặc định khi chưa bấm gì", () => {
    expect(orderQuick(all, EMPTY_PREFS, 12).map((x) => x.key)).toEqual([
      "tree", "people", "add", "todo", "graves", "board",
    ]);
  });

  it("chưa ghim: ô nào bấm nhiều hơn thì lên trước (tự học), ô lõi vẫn đứng đầu", () => {
    const keys = orderQuick(all, { pins: null, counts: { board: 5, graves: 2, tree: 99 } }, 12).map((x) => x.key);
    expect(keys.slice(0, 2)).toEqual(["tree", "people"]);
    expect(keys.slice(2)).toEqual(["board", "graves", "add", "todo"]);
  });

  it("bằng lượt bấm thì giữ thứ tự ưu tiên mặc định", () => {
    const keys = orderQuick(all, { pins: null, counts: { graves: 3, todo: 3 } }, 12).map((x) => x.key);
    expect(keys.indexOf("todo")).toBeLessThan(keys.indexOf("graves"));
  });

  it("đã ghim: đúng các ô đã ghim theo thứ tự ghim, không tự thêm ô khác", () => {
    expect(
      orderQuick(all, { pins: ["board", "tree", "todo"], counts: { add: 99 } }, 12).map((x) => x.key),
    ).toEqual(["board", "tree", "todo"]);
  });

  it("đã ghim: bỏ ô không còn khả dụng (mất quyền / tính năng tắt) và ô trùng", () => {
    expect(
      orderQuick(all, { pins: ["gone", "tree", "tree", "todo"], counts: {} }, 12).map((x) => x.key),
    ).toEqual(["tree", "todo"]);
  });

  it("luôn cắt ở tối đa max ô", () => {
    expect(orderQuick(all, EMPTY_PREFS, 3)).toHaveLength(3);
    expect(orderQuick(all, { pins: all.map((a) => a.key), counts: {} }, 4)).toHaveLength(4);
  });
});

describe("đọc/ghi tuỳ chọn", () => {
  beforeEach(() => localStorage.clear());

  it("ghi rồi đọc lại đúng", () => {
    writeHomePrefs({ pins: ["a", "b"], hidden: ["map"], counts: { a: 2 } });
    expect(readHomePrefs()).toEqual({ pins: ["a", "b"], hidden: ["map"], counts: { a: 2 } });
  });

  it("dữ liệu hỏng hoặc sai kiểu thì rơi về mặc định, không văng lỗi", () => {
    localStorage.setItem("family-tree:home-prefs-v1", "{xx");
    expect(readHomePrefs()).toEqual(EMPTY_PREFS);
    localStorage.setItem(
      "family-tree:home-prefs-v1",
      JSON.stringify({ pins: "tree", hidden: [1, "map"], counts: { a: "x", b: 2 } }),
    );
    expect(readHomePrefs()).toEqual({ pins: null, hidden: ["map"], counts: { b: 2 } });
  });
});
