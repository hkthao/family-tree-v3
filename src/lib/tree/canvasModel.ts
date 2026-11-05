import type { FamilyForTree, PersonForTree } from "@/lib/queries/tree";

/** Kích thước một thẻ người trên canvas (đơn vị canvas, chưa zoom). */
export const NODE_W = 150;
export const NODE_H = 190;
const GAP_X = 40;
const GAP_Y = 90;
const SPOUSE_GAP = 16;

export type EdgeStyle = "bezier" | "step" | "straight";
export type CanvasBackground = "paper" | "lattice" | "plain" | "dark";
export type NodeFrame = "gold" | "wine" | "jade" | "none";

export interface CanvasLayout {
  positions: Record<string, { x: number; y: number }>;
  edgeStyle: EdgeStyle;
  background: CanvasBackground;
  frame: NodeFrame;
}

export const DEFAULT_LAYOUT: CanvasLayout = {
  positions: {},
  edgeStyle: "step",
  background: "paper",
  frame: "gold",
};

export interface CanvasEdge {
  kind: "parent" | "spouse";
  from: string;
  to: string;
}

type Pt = { x: number; y: number };

/** Chuẩn hoá JSON đọc từ DB (có thể thiếu/rác) về CanvasLayout hợp lệ. */
export function parseLayout(raw: unknown): CanvasLayout {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const positions: CanvasLayout["positions"] = {};
  const p = r.positions;
  if (p && typeof p === "object") {
    for (const [id, v] of Object.entries(p as Record<string, unknown>)) {
      const o = v as { x?: unknown; y?: unknown } | null;
      if (o && Number.isFinite(o.x) && Number.isFinite(o.y)) {
        positions[id] = { x: o.x as number, y: o.y as number };
      }
    }
  }
  const pick = <T extends string>(v: unknown, ok: readonly T[], d: T): T =>
    ok.includes(v as T) ? (v as T) : d;
  return {
    positions,
    edgeStyle: pick(r.edgeStyle, ["bezier", "step", "straight"], DEFAULT_LAYOUT.edgeStyle),
    background: pick(r.background, ["paper", "lattice", "plain", "dark"], DEFAULT_LAYOUT.background),
    frame: pick(r.frame, ["gold", "wine", "jade", "none"], DEFAULT_LAYOUT.frame),
  };
}

/**
 * Cạnh nối: con → cha/mẹ (một cạnh về điểm giữa cặp vợ chồng nếu có đủ hai
 * người) và vợ–chồng. Chỉ giữ cạnh có cả hai đầu nằm trong `ids`.
 */
export function buildEdges(
  persons: PersonForTree[],
  families: FamilyForTree[],
): CanvasEdge[] {
  const ids = new Set(persons.map((p) => p.id));
  const famById = new Map(families.map((f) => [f.id, f]));
  const edges: CanvasEdge[] = [];
  for (const f of families) {
    if (f.husband_id && f.wife_id && ids.has(f.husband_id) && ids.has(f.wife_id)) {
      edges.push({ kind: "spouse", from: f.husband_id, to: f.wife_id });
    }
  }
  for (const c of persons) {
    const fam = c.birth_family_id ? famById.get(c.birth_family_id) : undefined;
    if (!fam) continue;
    const parent = [fam.husband_id, fam.wife_id].find((x) => x && ids.has(x));
    if (parent) edges.push({ kind: "parent", from: parent, to: c.id });
  }
  return edges;
}

/**
 * Tự bố trí: mỗi đời một hàng, con xếp dưới cha mẹ, vợ/chồng cạnh nhau.
 * Dùng khi canvas chưa có vị trí lưu — người dùng kéo thả tinh chỉnh sau đó.
 * Thuật toán "tidy" đơn giản: lá chiếm một ô, cha mẹ căn giữa các con.
 */
export function autoLayout(
  persons: PersonForTree[],
  families: FamilyForTree[],
): Record<string, Pt> {
  const byId = new Map(persons.map((p) => [p.id, p]));
  const famById = new Map(families.map((f) => [f.id, f]));
  const spouseOf = new Map<string, string>();
  for (const f of families) {
    if (f.husband_id && f.wife_id && byId.has(f.husband_id) && byId.has(f.wife_id)) {
      if (!spouseOf.has(f.husband_id)) spouseOf.set(f.husband_id, f.wife_id);
      if (!spouseOf.has(f.wife_id)) spouseOf.set(f.wife_id, f.husband_id);
    }
  }
  // Con theo "đơn vị gia đình" (người đứng đầu = cha, hoặc mẹ nếu không có cha).
  const childrenOf = new Map<string, PersonForTree[]>();
  const hasParent = new Set<string>();
  for (const c of persons) {
    const fam = c.birth_family_id ? famById.get(c.birth_family_id) : undefined;
    const head = fam && [fam.husband_id, fam.wife_id].find((x) => x && byId.has(x));
    if (!head) continue;
    hasParent.add(c.id);
    const arr = childrenOf.get(head) ?? [];
    arr.push(c);
    childrenOf.set(head, arr);
  }
  const rank = (p: PersonForTree) =>
    (p.birth_order ?? 1e6) * 1e6 + (p.birth_date ? Date.parse(p.birth_date) / 1e6 || 0 : 0);
  for (const arr of childrenOf.values()) arr.sort((a, b) => rank(a) - rank(b));

  const unitW = (id: string) => (spouseOf.has(id) ? NODE_W * 2 + SPOUSE_GAP : NODE_W);
  const out: Record<string, Pt> = {};
  const placed = new Set<string>();
  let cursor = 0;

  const place = (id: string, depth: number): { left: number; right: number } => {
    placed.add(id);
    const sp = spouseOf.get(id);
    if (sp) placed.add(sp);
    const kids = (childrenOf.get(id) ?? []).concat(
      sp ? (childrenOf.get(sp) ?? []) : [],
    ).filter((k) => !placed.has(k.id));
    const y = depth * (NODE_H + GAP_Y);
    const w = unitW(id);
    let left: number;
    if (kids.length === 0) {
      left = cursor;
      cursor += w + GAP_X;
    } else {
      const first = cursor;
      let lastRight = cursor;
      for (const k of kids) {
        if (placed.has(k.id)) continue;
        lastRight = place(k.id, depth + 1).right;
      }
      left = (first + lastRight) / 2 - w / 2;
      if (left < first && kids.length === 1) left = first;
      cursor = Math.max(cursor, left + w + GAP_X);
    }
    out[id] = { x: left, y };
    if (sp) out[sp] = { x: left + NODE_W + SPOUSE_GAP, y };
    return { left, right: left + w };
  };

  const roots = persons
    .filter((p) => !hasParent.has(p.id))
    // vợ/chồng nhập gia: để thuộc về đơn vị của người kia, không làm gốc riêng
    .sort((a, b) => (a.generation ?? 99) - (b.generation ?? 99) || rank(a) - rank(b));
  for (const r of roots) {
    if (placed.has(r.id)) continue;
    place(r.id, Math.max(0, (r.generation ?? 1) - 1));
  }
  for (const p of persons) {
    if (!placed.has(p.id)) place(p.id, Math.max(0, (p.generation ?? 1) - 1));
  }
  return out;
}

/**
 * Điểm đi của đường nối `parent` (đáy thẻ cha/mẹ, hoặc giữa cặp vợ chồng) và
 * điểm đến (đỉnh thẻ con) → mảng toạ độ phẳng cho Konva.Line.
 * - straight: thẳng
 * - step: vuông góc (xuống – ngang – xuống)
 * - bezier: cong; với Konva dùng `tension` trên các điểm kiểm soát (xem edgePath)
 */
export function edgePoints(
  style: EdgeStyle,
  a: Pt,
  b: Pt,
): { points: number[]; bezier: boolean } {
  if (style === "straight") return { points: [a.x, a.y, b.x, b.y], bezier: false };
  if (style === "step") {
    const my = a.y + (b.y - a.y) / 2;
    return { points: [a.x, a.y, a.x, my, b.x, my, b.x, b.y], bezier: false };
  }
  const my = a.y + (b.y - a.y) / 2;
  // Bezier bậc 3: 2 điểm kiểm soát cùng độ cao giữa → đường cong chữ S.
  return { points: [a.x, a.y, a.x, my, b.x, my, b.x, b.y], bezier: true };
}

/** Điểm neo trên thẻ: đáy (cha mẹ) hoặc đỉnh (con). */
export function anchor(pos: Pt, side: "top" | "bottom" | "left" | "right"): Pt {
  switch (side) {
    case "top": return { x: pos.x + NODE_W / 2, y: pos.y };
    case "bottom": return { x: pos.x + NODE_W / 2, y: pos.y + NODE_H };
    case "left": return { x: pos.x, y: pos.y + NODE_H / 2 };
    case "right": return { x: pos.x + NODE_W, y: pos.y + NODE_H / 2 };
  }
}

/** Hộp bao toàn bộ thẻ — dùng cho "vừa khung" và vùng xuất PDF. */
export function contentBounds(
  positions: Record<string, Pt>,
  pad = 60,
): { x: number; y: number; w: number; h: number } {
  const pts = Object.values(positions);
  if (pts.length === 0) return { x: 0, y: 0, w: 800, h: 600 };
  const minX = Math.min(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxX = Math.max(...pts.map((p) => p.x)) + NODE_W;
  const maxY = Math.max(...pts.map((p) => p.y)) + NODE_H;
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}

/** Cỡ giấy (mm). */
export const PAPER_PRESETS = {
  A0: [841, 1189],
  A1: [594, 841],
  A2: [420, 594],
  A3: [297, 420],
  A4: [210, 297],
} as const;
export type PaperPreset = keyof typeof PAPER_PRESETS;

/** Giấy theo hướng; `custom` nhập cm. Trả mm, kẹp 50–5000mm (giới hạn PDF 14400pt). */
export function paperSizeMm(
  preset: PaperPreset | "custom",
  landscape: boolean,
  customCm?: { w: number; h: number },
): { w: number; h: number } {
  let [w, h]: number[] =
    preset === "custom"
      ? [(customCm?.w ?? 21) * 10, (customCm?.h ?? 29.7) * 10]
      : [...PAPER_PRESETS[preset]];
  w = Math.min(5000, Math.max(50, w));
  h = Math.min(5000, Math.max(50, h));
  if (preset !== "custom" && landscape) [w, h] = [Math.max(w, h), Math.min(w, h)];
  return { w, h };
}
