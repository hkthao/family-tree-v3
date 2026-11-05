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

import { nearestSide, sideAnchor, sidePath } from "@/lib/tree/canvasModel";

describe("canvasModel (nối kiểu PowerPoint)", () => {
  const r = { x: 0, y: 0, w: 100, h: 50 };
  it("sideAnchor / nearestSide", () => {
    expect(sideAnchor(r, "right")).toEqual({ x: 100, y: 25 });
    expect(nearestSide(r, { x: 98, y: 20 })).toBe("right");
    expect(nearestSide(r, { x: 50, y: 2 })).toBe("top");
  });
  it("sidePath: step L-shape khi lệch hướng, bezier có 8 số", () => {
    const l = sidePath("step", { x: 0, y: 0 }, "bottom", { x: 100, y: 100 }, "left");
    expect(l.points).toEqual([0, 0, 0, 100, 100, 100]);
    const b = sidePath("bezier", { x: 0, y: 0 }, "right", { x: 200, y: 0 }, "left");
    expect(b.points).toHaveLength(8);
    expect(b.points[2]).toBeGreaterThan(0);
    expect(b.points[4]).toBeLessThan(200);
  });
  it("parseLayout giữ fromSide hợp lệ", () => {
    const l = parseLayout({ links: [{ id: "a", from: "x", to: "y", fromSide: "left", toSide: "zzz" }] });
    expect(l.links[0].fromSide).toBe("left");
    expect(l.links[0].toSide).toBeUndefined();
  });
});

import { flattenPath, linkGeometry, nearestOnPolylines, orthogonalize } from "@/lib/tree/canvasModel";

describe("canvasModel (đường nối tự do)", () => {
  it("orthogonalize: chỉ ra nét ngang/dọc", () => {
    const pts = orthogonalize([{ x: 0, y: 0 }, { x: 100, y: 40 }, { x: 100, y: 200 }]);
    for (let i = 2; i < pts.length; i += 2) {
      expect(pts[i] === pts[i - 2] || pts[i + 1] === pts[i - 1]).toBe(true);
    }
  });
  it("linkGeometry: có điểm uốn → đi qua điểm; bezier → tension", () => {
    const g = linkGeometry("bezier", { x: 0, y: 0 }, undefined, { x: 100, y: 0 }, undefined, [{ x: 50, y: 80 }]);
    expect(g.points).toEqual([0, 0, 50, 80, 100, 0]);
    expect(g.tension).toBe(0.5);
    expect(linkGeometry("straight", { x: 0, y: 0 }, undefined, { x: 9, y: 9 }, undefined).points).toEqual([0, 0, 9, 9]);
  });
  it("nearestOnPolylines bắt dính trong ngưỡng, bỏ khi xa", () => {
    const poly = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    const hit = nearestOnPolylines([poly], { x: 40, y: 6 }, 10);
    expect(hit && Math.round(hit.x)).toBe(40);
    expect(hit?.y).toBe(0);
    expect(nearestOnPolylines([poly], { x: 40, y: 30 }, 10)).toBeNull();
  });
  it("flattenPath lấy mẫu bezier", () => {
    const g = linkGeometry("bezier", { x: 0, y: 0 }, "right", { x: 200, y: 100 }, "left");
    const f = flattenPath(g, 8);
    expect(f).toHaveLength(9);
    expect(f[0]).toEqual({ x: 0, y: 0 });
    expect(Math.round(f[8].x)).toBe(200);
  });
  it("parseLayout: đầu tự do + điểm uốn; bỏ đường không có đầu nào", () => {
    const l = parseLayout({ links: [
      { id: "a", from: "", to: "n", fromPt: { x: 1, y: 2 }, points: [{ x: 3, y: 4 }, "x"] },
      { id: "b", from: "", to: "n" },
    ] });
    expect(l.links).toHaveLength(1);
    expect(l.links[0].fromPt).toEqual({ x: 1, y: 2 });
    expect(l.links[0].points).toEqual([{ x: 3, y: 4 }]);
  });
});

import { arrowHead, LINK_PRESETS, zigzagPoints } from "@/lib/tree/canvasModel";

describe("canvasModel (kiểu đường nối dựng sẵn)", () => {
  it("LINK_PRESETS có id duy nhất", () => {
    expect(new Set(LINK_PRESETS.map((p) => p.id)).size).toBe(LINK_PRESETS.length);
  });
  it("zigzagPoints: so le hai phía, bỏ khi quá ngắn", () => {
    const z = zigzagPoints({ x: 0, y: 0 }, { x: 200, y: 0 });
    expect(z).toHaveLength(3);
    expect(z[0].y).toBeGreaterThan(0);
    expect(z[1].y).toBeLessThan(0);
    expect(zigzagPoints({ x: 0, y: 0 }, { x: 10, y: 0 })).toEqual([]);
  });
  it("arrowHead: tip trùng điểm cuối, quay theo hướng", () => {
    const h = arrowHead([{ x: 0, y: 0 }, { x: 100, y: 0 }], true, 10)!;
    expect(h.x).toBeCloseTo(90);
    expect(h.rotation).toBeCloseTo(90);
    const s = arrowHead([{ x: 0, y: 0 }, { x: 100, y: 0 }], false, 10)!;
    expect(s.x).toBeCloseTo(10);
    expect(s.rotation).toBeCloseTo(270);
  });
  it("parseLayout giữ arrow hợp lệ", () => {
    expect(parseLayout({ links: [{ id: "a", from: "x", to: "y", arrow: "both" }] }).links[0].arrow).toBe("both");
    expect(parseLayout({ links: [{ id: "a", from: "x", to: "y", arrow: "zz" }] }).links[0].arrow).toBeUndefined();
  });
});

import { layoutByLinks } from "@/lib/tree/canvasModel";

describe("layoutByLinks (cây tự do theo đường nối)", () => {
  const sz = (ids: string[]) => Object.fromEntries(ids.map((i) => [i, { w: 150, h: 190 }]));
  it("con dưới cha, cha căn giữa các con, thẻ rời tách riêng", () => {
    const { positions: p, loose } = layoutByLinks(sz(["r", "a", "b", "z"]), [
      { from: "r", to: "a" }, { from: "r", to: "b" },
    ]);
    expect(loose).toEqual(["z"]);
    expect(p.a.y).toBe(p.b.y);
    expect(p.a.y).toBeGreaterThan(p.r.y);
    expect(p.r.x + 75).toBeCloseTo((p.a.x + p.b.x + 150) / 2);
  });
  it("vòng nối không treo", () => {
    const { positions: p } = layoutByLinks(sz(["a", "b"]), [{ from: "a", to: "b" }, { from: "b", to: "a" }]);
    expect(Object.keys(p).sort()).toEqual(["a", "b"]);
  });
});

import { nearestOnLines, pointOnPoly } from "@/lib/tree/canvasModel";

describe("đầu đường nối gắn vào đường khác", () => {
  const poly = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
  it("pointOnPoly theo chiều dài", () => {
    expect(pointOnPoly(poly, 0.5)).toEqual({ x: 100, y: 0 });
    expect(pointOnPoly(poly, 0.25)).toEqual({ x: 50, y: 0 });
    expect(pointOnPoly(poly, 1)).toEqual({ x: 100, y: 100 });
  });
  it("nearestOnLines trả ref + t, khớp pointOnPoly", () => {
    const n = nearestOnLines([{ ref: "l:x", poly }], { x: 100, y: 52 }, 10)!;
    expect(n.at.ref).toBe("l:x");
    expect(n.at.t).toBeCloseTo(0.76);
    expect(pointOnPoly(poly, n.at.t).y).toBeCloseTo(52);
    expect(nearestOnLines([{ ref: "l:x", poly }], { x: 50, y: 40 }, 10)).toBeNull();
  });
  it("parseLayout giữ fromAt/toAt hợp lệ, kẹp t", () => {
    const l = parseLayout({ links: [{ id: "a", from: "", to: "n", fromPt: { x: 1, y: 2 }, fromAt: { ref: "s:a:b", t: 7 }, toAt: { ref: 5, t: 0 } }] });
    expect(l.links[0].fromAt).toEqual({ ref: "s:a:b", t: 1 });
    expect(l.links[0].toAt).toBeUndefined();
  });
});
