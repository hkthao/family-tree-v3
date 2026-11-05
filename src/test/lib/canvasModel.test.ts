import { describe, expect, it } from "vitest";

import type { FamilyForTree, PersonForTree } from "@/lib/queries/tree";
import {
  autoLayout,
  buildEdges,
  contentBounds,
  edgePoints,
  NODE_H,
  NODE_W,
  paperSizeMm,
  parseLayout,
} from "@/lib/tree/canvasModel";

const P = (id: string, gen: number, fam: string | null = null, o: Partial<PersonForTree> = {}): PersonForTree => ({
  id, full_name: id, gender: "M", is_living: true, is_root: false, birth_date: null,
  death_date: null, generation: gen, birth_family_id: fam, branch_id: null, photo_path: null, ...o,
});
const F = (id: string, h: string | null, w: string | null): FamilyForTree => ({
  id, husband_id: h, wife_id: w, spouse_order: null, created_at: null,
});

const persons = [P("a", 1), P("b", 1), P("c", 2, "f1"), P("d", 2, "f1")];
const families = [F("f1", "a", "b")];

describe("canvasModel", () => {
  it("buildEdges: vợ chồng + con nối về cha", () => {
    const e = buildEdges(persons, families);
    expect(e).toContainEqual({ kind: "spouse", from: "a", to: "b" });
    expect(e.filter((x) => x.kind === "parent").map((x) => x.to).sort()).toEqual(["c", "d"]);
  });

  it("autoLayout: mỗi đời một hàng, con dưới cha mẹ, không chồng thẻ", () => {
    const pos = autoLayout(persons, families);
    expect(Object.keys(pos).sort()).toEqual(["a", "b", "c", "d"]);
    expect(pos.a.y).toBe(pos.b.y);
    expect(pos.c.y).toBeGreaterThan(pos.a.y + NODE_H);
    expect(pos.c.y).toBe(pos.d.y);
    expect(Math.abs(pos.c.x - pos.d.x)).toBeGreaterThanOrEqual(NODE_W);
    expect(Math.abs(pos.a.x - pos.b.x)).toBeGreaterThanOrEqual(NODE_W);
  });

  it("autoLayout: người không có quan hệ vẫn được đặt", () => {
    const pos = autoLayout([...persons, P("z", 3)], families);
    expect(pos.z).toBeDefined();
  });

  it("edgePoints: step có 4 điểm, bezier đánh dấu bezier", () => {
    const step = edgePoints("step", { x: 0, y: 0 }, { x: 100, y: 100 });
    expect(step.points).toHaveLength(8);
    expect(step.bezier).toBe(false);
    expect(edgePoints("bezier", { x: 0, y: 0 }, { x: 100, y: 100 }).bezier).toBe(true);
    expect(edgePoints("straight", { x: 0, y: 0 }, { x: 1, y: 1 }).points).toEqual([0, 0, 1, 1]);
  });

  it("contentBounds bao trọn các thẻ", () => {
    const b = contentBounds({ a: { x: 0, y: 0 }, b: { x: 300, y: 400 } }, 10);
    expect(b).toEqual({ x: -10, y: -10, w: 300 + NODE_W + 20, h: 400 + NODE_H + 20 });
  });

  it("paperSizeMm: preset, hướng ngang, tuỳ chỉnh có kẹp", () => {
    expect(paperSizeMm("A3", false)).toEqual({ w: 297, h: 420 });
    expect(paperSizeMm("A3", true)).toEqual({ w: 420, h: 297 });
    expect(paperSizeMm("custom", false, { w: 100, h: 70 })).toEqual({ w: 1000, h: 700 });
    expect(paperSizeMm("custom", false, { w: 9999, h: 0.1 })).toEqual({ w: 5000, h: 50 });
  });

  it("parseLayout: bỏ rác, về mặc định", () => {
    const l = parseLayout({ positions: { a: { x: 1, y: 2 }, b: { x: "q" } }, edgeStyle: "zzz", frame: "jade" });
    expect(l.positions).toEqual({ a: { x: 1, y: 2 } });
    expect(l.edgeStyle).toBe("step");
    expect(l.frame).toBe("jade");
    expect(parseLayout(null).background).toBe("paper");
  });
});

import { coverCrop, linkAnchors, tidyPositions } from "@/lib/tree/canvasModel";

describe("canvasModel (canvas tuỳ biến)", () => {
  it("tidyPositions: cùng hàng cùng y, không đè nhau, bám lưới", () => {
    const out = tidyPositions({
      a: { x: 3, y: 10 }, b: { x: 20, y: 31 }, c: { x: 0, y: 500 },
    });
    expect(out.a.y).toBe(out.b.y);
    expect(out.c.y).toBeGreaterThan(out.a.y);
    expect(out.b.x - out.a.x).toBeGreaterThanOrEqual(NODE_W);
    expect(out.a.x % 20).toBe(0);
  });

  it("linkAnchors: chọn cạnh theo hướng", () => {
    const a = { x: 0, y: 0, w: 100, h: 100 };
    expect(linkAnchors(a, { x: 0, y: 300, w: 100, h: 100 }).vertical).toBe(true);
    const side = linkAnchors(a, { x: 500, y: 0, w: 100, h: 100 });
    expect(side.vertical).toBe(false);
    expect(side.from.x).toBe(100);
    expect(side.to.x).toBe(500);
  });

  it("coverCrop: lấp đầy khung", () => {
    const c = coverCrop(200, 100, 100, 100);
    expect(c).toEqual({ x: 50, y: 0, width: 100, height: 100 });
  });

  it("parseLayout: giữ liên kết/kiểu thẻ hợp lệ, bỏ màu hỏng", () => {
    const l = parseLayout({
      links: [{ id: "l1", from: "a", to: "b", color: "red", width: 99 }],
      nodeStyles: { a: { color: "#112233", font: "zzz", size: 5 } },
      bgImage: "javascript:alert(1)",
    });
    expect(l.links[0].color).toBe("#8B1E2D");
    expect(l.links[0].width).toBe(12);
    expect(l.nodeStyles.a).toEqual({ color: "#112233" });
    expect(l.bgImage).toBeNull();
  });
});
