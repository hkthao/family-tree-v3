import { describe, expect, it } from "vitest";

import {
  buildFolderPdfRows,
  FOLDER_ROW_H,
  paginateFolderRows,
  PDF_MAX_SIDE,
  type FolderPdfInput,
  type FolderPdfPerson,
} from "@/lib/pdf/folderTreeRows";

/**
 * Trang "Cây thư mục" trong sổ: phần dàn dòng và tính khổ giấy.
 */

const person = (id: string, gender: "M" | "F" = "M"): FolderPdfPerson => ({
  id,
  name: id,
  gender,
  generation: 1,
  years: "",
  photo: "",
});

function input(
  people: FolderPdfPerson[],
  kids: Record<string, string[]>,
  spouses: Record<string, string[]> = {},
  mother: Record<string, string> = {},
  roots = ["to"],
): FolderPdfInput {
  const byId = new Map(people.map((p) => [p.id, p]));
  return {
    roots,
    person: (id) => byId.get(id),
    childrenOf: (id) => kids[id] ?? [],
    spousesOf: (id) => spouses[id] ?? [],
    otherParentOf: (c) => mother[c] ?? null,
  };
}

describe("buildFolderPdfRows", () => {
  it("một vợ: ghi chung dòng, con nằm thẳng dưới, con út là nét └", () => {
    const rows = buildFolderPdfRows(
      input(
        [person("to"), person("ba", "F"), person("a"), person("b")],
        { to: ["a", "b"] },
        { to: ["ba"] },
      ),
    );
    expect(rows.map((r) => [r.key, r.depth, r.isLast])).toEqual([
      ["to", 0, true],
      ["a", 1, false],
      ["b", 1, true],
    ]);
    expect(rows[0].spouses.map((s) => s.id)).toEqual(["ba"]);
  });

  it("nét dọc chạy xuyên qua cháu khi cha còn em phía dưới", () => {
    const rows = buildFolderPdfRows(
      input([person("to"), person("a"), person("a1"), person("b")], {
        to: ["a", "b"],
        a: ["a1"],
      }),
    );
    const a1 = rows.find((r) => r.key === "a1")!;
    expect(a1.depth).toBe(2);
    expect(a1.rails).toEqual([true]);
    // …còn cháu của người con út thì không có nét nào chạy qua.
    const rows2 = buildFolderPdfRows(
      input([person("to"), person("a"), person("a1")], { to: ["a"], a: ["a1"] }),
    );
    expect(rows2.find((r) => r.key === "a1")!.rails).toEqual([false]);
  });

  it("hai vợ: mỗi bà một dòng ⚭, con treo dưới đúng mẹ", () => {
    const rows = buildFolderPdfRows(
      input(
        [
          person("to"),
          person("v1", "F"),
          person("v2", "F"),
          person("a"),
          person("b"),
          person("c"),
        ],
        { to: ["a", "b", "c"] },
        { to: ["v1", "v2"] },
        { a: "v1", b: "v2", c: "v1" },
      ),
    );
    expect(rows.map((r) => `${r.kind}:${r.key}:${r.depth}`)).toEqual([
      "person:to:0",
      "marriage:to:v1:1",
      "person:a:2",
      "person:c:2",
      "marriage:to:v2:1",
      "person:b:2",
    ]);
    expect(rows[0].spouses).toEqual([]);
    expect(rows[1].childCount).toBe(2);
  });

  it("con không rõ mẹ ở nhà nhiều vợ vào nhóm 'chưa ghi vợ'", () => {
    const rows = buildFolderPdfRows(
      input(
        [person("to"), person("v1", "F"), person("v2", "F"), person("a")],
        { to: ["a"] },
        { to: ["v1", "v2"] },
      ),
    );
    const last = rows.find((r) => r.kind === "marriage" && r.person === null)!;
    expect(last.label).toBe("chưa ghi vợ");
    expect(last.isLast).toBe(true);
  });

  it("dữ liệu vòng (A con B, B con A) không làm treo", () => {
    const rows = buildFolderPdfRows(
      input([person("to"), person("a")], { to: ["a"], a: ["to"] }),
    );
    expect(rows.map((r) => r.key)).toEqual(["to", "a"]);
  });
});

describe("paginateFolderRows", () => {
  const chrome = { padX: 56, padTop: 60, padBottom: 60, header: 78 };
  const many = (n: number) =>
    buildFolderPdfRows(
      input(
        [person("to"), ...Array.from({ length: n }, (_, i) => person(`c${i}`))],
        { to: Array.from({ length: n }, (_, i) => `c${i}`) },
      ),
    );

  it("cây nhỏ: đúng một trang A4 nằm ngang", () => {
    const [pg, ...rest] = paginateFolderRows(many(9), chrome);
    expect(rest).toEqual([]);
    expect([pg.width, pg.height]).toEqual([842, 595]);
    expect(pg.rows).toHaveLength(10);
  });

  it("cây lớn: vẫn MỘT cột, trang dài ra vừa đủ số dòng", () => {
    const rows = many(300);
    const [pg, ...rest] = paginateFolderRows(rows, chrome);
    expect(rest).toEqual([]);
    expect(pg.rows).toHaveLength(301);
    expect(pg.height).toBe(60 + 60 + 78 + 301 * FOLDER_ROW_H);
  });

  it("tên dài thì trang nới rộng hơn A4 ngang", () => {
    const long = person("x".repeat(200));
    const [pg] = paginateFolderRows(
      buildFolderPdfRows(input([long], {}, {}, {}, [long.id])),
      chrome,
    );
    expect(pg.width).toBeGreaterThan(842);
  });

  it("cây quá dài thì ngắt trang, không trang nào vượt trần PDF", () => {
    const rows = many(2000);
    const pages = paginateFolderRows(rows, chrome);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.every((p) => p.height <= PDF_MAX_SIDE)).toBe(true);
    expect(pages.reduce((n, p) => n + p.rows.length, 0)).toBe(rows.length);
  });
});
