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

export type CardDesign = "classic" | "royal" | "minimal" | "plaque";

export const CARD_DESIGNS: Array<{ id: CardDesign; label: string }> = [
  { id: "classic", label: "Cổ điển" },
  { id: "royal", label: "Hoàng gia" },
  { id: "minimal", label: "Tối giản" },
  { id: "plaque", label: "Bài vị" },
];

export const CANVAS_FONTS: Array<{ id: string; label: string; family: string }> = [
  { id: "be", label: "Be Vietnam Pro", family: '"Be Vietnam Pro", system-ui, sans-serif' },
  { id: "playfair", label: "Playfair Display", family: '"Playfair Display", Georgia, serif' },
  { id: "dancing", label: "Dancing Script", family: '"Dancing Script", cursive' },
  { id: "times", label: "Times New Roman", family: '"Times New Roman", Georgia, serif' },
];

/** Tuỳ chỉnh riêng từng thẻ / ô chữ (chỉ trên canvas, không ghi vào hồ sơ). */
export interface NodeStyle {
  design?: CardDesign;
  font?: string;
  color?: string;
  size?: number;
  name?: string;
  sub?: string;
  hidden?: boolean;
}

/** Thẻ trống hoặc ô chữ thả tự do (vị trí nằm trong `positions`). */
export interface ExtraItem {
  id: string;
  kind: "card" | "text";
  gender?: "M" | "F";
}

export type Side = "top" | "bottom" | "left" | "right";

/** Điểm gắn trên một đường: `s:<a>:<b>` (vợ–chồng), `p:<con>` (cha–con), `l:<id>` (đường tuỳ chỉnh). */
export interface LineAt {
  ref: string;
  t: number;
}

export interface CustomLink {
  id: string;
  /** Cạnh thẻ nơi đường bắt đầu/kết thúc (kéo từ chấm nối). Thiếu → tự chọn. */
  fromSide?: Side;
  toSide?: Side;
  /** Đầu tự do (toạ độ canvas) thay cho thẻ — khi có, `from`/`to` tương ứng là "". */
  fromPt?: { x: number; y: number };
  toPt?: { x: number; y: number };
  /** Đầu gắn vào một đường khác (ref + vị trí 0..1 theo chiều dài) — đi theo đường đó khi nó dời; `fromPt`/`toPt` là chỗ dự phòng. */
  fromAt?: LineAt;
  toAt?: LineAt;
  /** Mũi tên ở cuối / hai đầu. */
  arrow?: "none" | "end" | "both";
  /** Điểm uốn do người dùng kéo: đường đi qua lần lượt các điểm này. */
  points?: Array<{ x: number; y: number }>;
  from: string;
  to: string;
  color: string;
  width: number;
  dash: boolean;
  style: EdgeStyle;
}

export interface CanvasLayout {
  positions: Record<string, { x: number; y: number }>;
  edgeStyle: EdgeStyle;
  background: CanvasBackground;
  frame: NodeFrame;
  nodeStyles: Record<string, NodeStyle>;
  extras: ExtraItem[];
  links: CustomLink[];
  autoEdges: boolean;
  /** Ảnh nền (data URL JPEG đã thu nhỏ) phủ vùng nội dung. */
  bgImage: string | null;
}

export const DEFAULT_LAYOUT: CanvasLayout = {
  positions: {},
  edgeStyle: "step",
  background: "paper",
  frame: "gold",
  nodeStyles: {},
  extras: [],
  links: [],
  autoEdges: true,
  bgImage: null,
};

const isPt = (v: unknown): v is { x: number; y: number } =>
  !!v && typeof v === "object" && Number.isFinite((v as { x?: unknown }).x) && Number.isFinite((v as { y?: unknown }).y);

const SIDES: Side[] = ["top", "bottom", "left", "right"];

export const TEXT_W = 220;
export const TEXT_H = 44;

type Rect = { x: number; y: number; w: number; h: number };

/** Hình chữ nhật của một nút (thẻ hoặc ô chữ) — để nối đường tuỳ chỉnh. */
export function nodeRect(
  pos: { x: number; y: number },
  extra?: ExtraItem,
): Rect {
  return extra?.kind === "text"
    ? { x: pos.x, y: pos.y, w: TEXT_W, h: TEXT_H }
    : { x: pos.x, y: pos.y, w: NODE_W, h: NODE_H };
}

/**
 * Điểm đầu/cuối đường nối tuỳ chỉnh: nếu hai nút chênh dọc rõ hơn ngang thì
 * nối đáy trên → đỉnh dưới, ngược lại nối cạnh bên.
 */
export function linkAnchors(a: Rect, b: Rect): { from: Pt; to: Pt; vertical: boolean } {
  const ca = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const cb = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;
  if (Math.abs(dy) * (a.w + b.w) >= Math.abs(dx) * (a.h + b.h)) {
    return dy >= 0
      ? { from: { x: ca.x, y: a.y + a.h }, to: { x: cb.x, y: b.y }, vertical: true }
      : { from: { x: ca.x, y: a.y }, to: { x: cb.x, y: b.y + b.h }, vertical: true };
  }
  return dx >= 0
    ? { from: { x: a.x + a.w, y: ca.y }, to: { x: b.x, y: cb.y }, vertical: false }
    : { from: { x: a.x, y: ca.y }, to: { x: b.x + b.w, y: cb.y }, vertical: false };
}

/** Cắt ảnh kiểu object-cover để phủ kín khung w×h. */
export function coverCrop(iw: number, ih: number, w: number, h: number) {
  const s = Math.max(w / iw, h / ih);
  const cw = w / s;
  const ch = h / s;
  return { x: (iw - cw) / 2, y: (ih - ch) / 2, width: cw, height: ch };
}

export interface CanvasEdge {
  kind: "parent" | "spouse";
  from: string;
  to: string;
}

type Pt = { x: number; y: number };

/** Chuẩn hoá JSON đọc từ DB (có thể thiếu/rác) về CanvasLayout hợp lệ. */
function parseAt(v: unknown): LineAt | undefined {
  const o = v as { ref?: unknown; t?: unknown } | null;
  if (!o || typeof o.ref !== "string" || o.ref.length > 120 || typeof o.t !== "number" || !Number.isFinite(o.t)) return undefined;
  return { ref: o.ref, t: Math.min(1, Math.max(0, o.t)) };
}

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
  const str = (v: unknown, max: number) =>
    typeof v === "string" ? v.slice(0, max) : undefined;
  const nodeStyles: CanvasLayout["nodeStyles"] = {};
  if (r.nodeStyles && typeof r.nodeStyles === "object") {
    for (const [id, v] of Object.entries(r.nodeStyles as Record<string, unknown>)) {
      const o = (v ?? {}) as Record<string, unknown>;
      const ns: NodeStyle = {};
      if (CARD_DESIGNS.some((d) => d.id === o.design)) ns.design = o.design as CardDesign;
      if (typeof o.font === "string" && CANVAS_FONTS.some((f) => f.id === o.font)) ns.font = o.font;
      if (typeof o.color === "string" && /^#[0-9a-fA-F]{6}$/.test(o.color)) ns.color = o.color;
      if (typeof o.size === "number" && o.size >= 8 && o.size <= 48) ns.size = o.size;
      const n = str(o.name, 120);
      if (n !== undefined) ns.name = n;
      const sb = str(o.sub, 120);
      if (sb !== undefined) ns.sub = sb;
      if (o.hidden === true) ns.hidden = true;
      nodeStyles[id] = ns;
    }
  }
  const extras: ExtraItem[] = Array.isArray(r.extras)
    ? (r.extras as Array<Record<string, unknown>>)
        .filter((e) => e && typeof e.id === "string" && (e.kind === "card" || e.kind === "text"))
        .slice(0, 500)
        .map((e) => ({
          id: e.id as string,
          kind: e.kind as "card" | "text",
          gender: e.gender === "F" ? ("F" as const) : e.gender === "M" ? ("M" as const) : undefined,
        }))
    : [];
  const links: CustomLink[] = Array.isArray(r.links)
    ? (r.links as Array<Record<string, unknown>>)
        .filter((l) => l && typeof l.id === "string" && typeof l.from === "string" && typeof l.to === "string")
        .filter((l) => (l.from !== "" || isPt(l.fromPt)) && (l.to !== "" || isPt(l.toPt)))
        .slice(0, 2000)
        .map((l) => ({
          id: l.id as string,
          from: l.from as string,
          to: l.to as string,
          color: typeof l.color === "string" && /^#[0-9a-fA-F]{6}$/.test(l.color) ? l.color : "#8B1E2D",
          fromPt: isPt(l.fromPt) ? { x: l.fromPt.x, y: l.fromPt.y } : undefined,
          toPt: isPt(l.toPt) ? { x: l.toPt.x, y: l.toPt.y } : undefined,
          fromAt: parseAt(l.fromAt),
          toAt: parseAt(l.toAt),
          arrow: l.arrow === "end" || l.arrow === "both" ? (l.arrow as "end" | "both") : undefined,
          points: Array.isArray(l.points)
            ? (l.points as unknown[]).filter(isPt).slice(0, 40).map((q) => ({ x: q.x, y: q.y }))
            : undefined,
          fromSide: SIDES.includes(l.fromSide as Side) ? (l.fromSide as Side) : undefined,
          toSide: SIDES.includes(l.toSide as Side) ? (l.toSide as Side) : undefined,
          width: typeof l.width === "number" ? Math.min(12, Math.max(1, l.width)) : 3,
          dash: l.dash === true,
          style: pick(l.style, ["bezier", "step", "straight"], "bezier"),
        }))
    : [];
  const bgImage =
    typeof r.bgImage === "string" && r.bgImage.startsWith("data:image/") ? r.bgImage : null;
  return {
    positions,
    nodeStyles,
    extras,
    links,
    autoEdges: r.autoEdges !== false,
    bgImage,
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
  horizontal = false,
): { points: number[]; bezier: boolean } {
  if (style === "straight") return { points: [a.x, a.y, b.x, b.y], bezier: false };
  // horizontal: đường đi ngang (nối cạnh bên) → trục giữa là x thay vì y.
  const pts = horizontal
    ? (() => {
        const mx = a.x + (b.x - a.x) / 2;
        return [a.x, a.y, mx, a.y, mx, b.y, b.x, b.y];
      })()
    : (() => {
        const my = a.y + (b.y - a.y) / 2;
        return [a.x, a.y, a.x, my, b.x, my, b.x, b.y];
      })();
  // Bezier bậc 3: 2 điểm kiểm soát ở giữa → đường cong chữ S.
  return { points: pts, bezier: style === "bezier" };
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

export const SNAP = 20;

/**
 * Căn chỉnh tự động: gom các thẻ có độ cao gần nhau thành một hàng (cùng y),
 * dồn lại cho không đè nhau (cách ≥ `gap`), rồi bám lưới `SNAP`.
 * Giữ nguyên thứ tự trái → phải đang có trong mỗi hàng.
 */
export function tidyPositions(
  positions: Record<string, { x: number; y: number }>,
  widths: Record<string, number> = {},
  gap = GAP_X,
): Record<string, { x: number; y: number }> {
  const snap = (v: number) => Math.round(v / SNAP) * SNAP;
  const items = Object.entries(positions)
    .map(([id, p]) => ({ id, x: p.x, y: p.y, w: widths[id] ?? NODE_W }))
    .sort((a, b) => a.y - b.y);
  const rows: (typeof items)[] = [];
  for (const it of items) {
    const row = rows[rows.length - 1];
    if (row && it.y - row[0].y < NODE_H / 2) row.push(it);
    else rows.push([it]);
  }
  const out: Record<string, { x: number; y: number }> = {};
  for (const row of rows) {
    const y = snap(row.reduce((s, r) => s + r.y, 0) / row.length);
    row.sort((a, b) => a.x - b.x);
    let minX = -Infinity;
    for (const it of row) {
      const x = Math.max(snap(it.x), minX);
      out[it.id] = { x, y };
      minX = x + it.w + gap;
      minX = Math.ceil(minX / SNAP) * SNAP;
    }
  }
  return out;
}

/** Điểm giữa một cạnh của hình chữ nhật. */
export function sideAnchor(r: Rect, side: Side): Pt {
  switch (side) {
    case "top": return { x: r.x + r.w / 2, y: r.y };
    case "bottom": return { x: r.x + r.w / 2, y: r.y + r.h };
    case "left": return { x: r.x, y: r.y + r.h / 2 };
    case "right": return { x: r.x + r.w, y: r.y + r.h / 2 };
  }
}

/** Cạnh của `r` gần điểm `p` nhất (dùng khi thả đầu đường nối lên thẻ). */
export function nearestSide(r: Rect, p: Pt): Side {
  const d: Array<[Side, number]> = [
    ["top", Math.abs(p.y - r.y)],
    ["bottom", Math.abs(p.y - (r.y + r.h))],
    ["left", Math.abs(p.x - r.x)],
    ["right", Math.abs(p.x - (r.x + r.w))],
  ];
  return d.sort((a, b) => a[1] - b[1])[0][0];
}

const DIR: Record<Side, Pt> = {
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const isVert = (s: Side) => s === "top" || s === "bottom";

/**
 * Đường nối giữa hai cạnh đã chọn (kiểu PowerPoint/Word): cong theo hướng
 * thoát ra khỏi cạnh, vuông góc (gấp khúc 1–3 đoạn), hoặc thẳng.
 */
export function sidePath(
  style: EdgeStyle,
  a: Pt,
  aSide: Side,
  b: Pt,
  bSide: Side,
): { points: number[]; bezier: boolean } {
  if (style === "straight") return { points: [a.x, a.y, b.x, b.y], bezier: false };
  if (style === "bezier") {
    const d = Math.max(40, Math.hypot(b.x - a.x, b.y - a.y) / 2.5);
    return {
      points: [
        a.x, a.y,
        a.x + DIR[aSide].x * d, a.y + DIR[aSide].y * d,
        b.x + DIR[bSide].x * d, b.y + DIR[bSide].y * d,
        b.x, b.y,
      ],
      bezier: true,
    };
  }
  const av = isVert(aSide);
  const bv = isVert(bSide);
  if (av && bv) {
    const my = a.y + (b.y - a.y) / 2;
    return { points: [a.x, a.y, a.x, my, b.x, my, b.x, b.y], bezier: false };
  }
  if (!av && !bv) {
    const mx = a.x + (b.x - a.x) / 2;
    return { points: [a.x, a.y, mx, a.y, mx, b.y, b.x, b.y], bezier: false };
  }
  return av
    ? { points: [a.x, a.y, a.x, b.y, b.x, b.y], bezier: false }
    : { points: [a.x, a.y, b.x, a.y, b.x, b.y], bezier: false };
}

// ─── Đường nối tự do: đầu tự do, điểm uốn, bám vào đường khác ───

/** Cạnh "thoát ra" hợp lý nhất từ `a` hướng tới `b` (khi đầu nối không gắn cạnh thẻ). */
export function dominantSide(a: Pt, b: Pt): Side {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.abs(dy) >= Math.abs(dx) ? (dy >= 0 ? "bottom" : "top") : dx >= 0 ? "right" : "left";
}
const OPP: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };

/** Ép từng đoạn của chuỗi điểm thành các nét ngang/dọc (khuỷu ở giữa mỗi đoạn lệch). */
export function orthogonalize(chain: Pt[]): number[] {
  if (chain.length === 0) return [];
  const out: number[] = [chain[0].x, chain[0].y];
  for (let i = 1; i < chain.length; i++) {
    const p = chain[i - 1];
    const q = chain[i];
    if (p.x !== q.x && p.y !== q.y) {
      if (Math.abs(q.x - p.x) >= Math.abs(q.y - p.y)) out.push(q.x, p.y);
      else out.push(p.x, q.y);
    }
    out.push(q.x, q.y);
  }
  return out;
}

export interface LinkGeometry {
  points: number[];
  bezier: boolean;
  /** >0: Konva làm mượt đường đi qua các điểm (kiểu "cong" khi có điểm uốn). */
  tension: number;
}

/**
 * Hình học một đường nối từ đầu `a` tới `b` (đã giải ra toạ độ), qua các điểm uốn
 * `via`. `aSide`/`bSide` chỉ có khi đầu gắn vào cạnh thẻ.
 */
export function linkGeometry(
  style: EdgeStyle,
  a: Pt,
  aSide: Side | undefined,
  b: Pt,
  bSide: Side | undefined,
  via: Pt[] = [],
): LinkGeometry {
  if (via.length === 0) {
    if (style === "straight") return { points: [a.x, a.y, b.x, b.y], bezier: false, tension: 0 };
    const as = aSide ?? dominantSide(a, b);
    const bs = bSide ?? OPP[dominantSide(a, b)];
    const r = sidePath(style, a, as, b, bs);
    return { ...r, tension: 0 };
  }
  const chain = [a, ...via, b];
  if (style === "step") return { points: orthogonalize(chain), bezier: false, tension: 0 };
  const flat = chain.flatMap((p) => [p.x, p.y]);
  return { points: flat, bezier: false, tension: style === "bezier" ? 0.5 : 0 };
}

/** Xấp xỉ đường bằng đa tuyến (để bắt dính / tìm điểm gần nhất). */
export function flattenPath(g: LinkGeometry, samples = 16): Pt[] {
  const p = g.points;
  if (g.bezier && p.length === 8) {
    const out: Pt[] = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const u = 1 - t;
      out.push({
        x: u * u * u * p[0] + 3 * u * u * t * p[2] + 3 * u * t * t * p[4] + t * t * t * p[6],
        y: u * u * u * p[1] + 3 * u * u * t * p[3] + 3 * u * t * t * p[5] + t * t * t * p[7],
      });
    }
    return out;
  }
  const out: Pt[] = [];
  for (let i = 0; i + 1 < p.length; i += 2) out.push({ x: p[i], y: p[i + 1] });
  return out;
}

/** Điểm gần `pt` nhất trên các đa tuyến; null nếu xa hơn `maxDist`. */
export function nearestOnPolylines(
  polys: Pt[][],
  pt: Pt,
  maxDist: number,
): { x: number; y: number; dist: number } | null {
  let best: { x: number; y: number; dist: number } | null = null;
  for (const poly of polys) {
    for (let i = 0; i + 1 < poly.length; i++) {
      const a = poly[i];
      const b = poly[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2));
      const x = a.x + t * dx;
      const y = a.y + t * dy;
      const dist = Math.hypot(pt.x - x, pt.y - y);
      if (dist <= maxDist && (!best || dist < best.dist)) best = { x, y, dist };
    }
  }
  return best;
}

// ─── Thư viện kiểu đường nối dựng sẵn ───

export interface LinkPreset {
  id: string;
  label: string;
  style: EdgeStyle;
  dash: boolean;
  arrow: "none" | "end" | "both";
  /** Tự thêm các điểm uốn so le để thành đường gấp khúc (zigzag). */
  zigzag?: boolean;
}

export const LINK_PRESETS: LinkPreset[] = [
  { id: "straight", label: "Thẳng", style: "straight", dash: false, arrow: "none" },
  { id: "straight-arrow", label: "Thẳng có mũi tên", style: "straight", dash: false, arrow: "end" },
  { id: "step", label: "Vuông góc", style: "step", dash: false, arrow: "none" },
  { id: "step-arrow", label: "Vuông góc có mũi tên", style: "step", dash: false, arrow: "end" },
  { id: "curve", label: "Cong", style: "bezier", dash: false, arrow: "none" },
  { id: "curve-arrow", label: "Cong có mũi tên", style: "bezier", dash: false, arrow: "end" },
  { id: "zigzag", label: "Gấp khúc", style: "straight", dash: false, arrow: "none", zigzag: true },
  { id: "dashed", label: "Nét đứt", style: "straight", dash: true, arrow: "none" },
  { id: "dashed-curve", label: "Cong nét đứt", style: "bezier", dash: true, arrow: "both" },
];

/** Các điểm uốn so le (±amp, vuông góc với đoạn a→b) chia đoạn thành `segments` phần. */
export function zigzagPoints(a: Pt, b: Pt, amp = 22, segments = 4): Pt[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < amp * 2) return [];
  const nx = -dy / len;
  const ny = dx / len;
  const out: Pt[] = [];
  for (let k = 1; k < segments; k++) {
    const t = k / segments;
    const sgn = k % 2 === 1 ? 1 : -1;
    out.push({ x: a.x + dx * t + nx * amp * sgn, y: a.y + dy * t + ny * amp * sgn });
  }
  return out;
}

/** Đầu mũi tên tại cuối (hoặc đầu) của đa tuyến: tâm tam giác + góc quay (độ) cho RegularPolygon. */
export function arrowHead(
  poly: Pt[],
  atEnd: boolean,
  r: number,
): { x: number; y: number; rotation: number } | null {
  if (poly.length < 2) return null;
  const tip = atEnd ? poly[poly.length - 1] : poly[0];
  let prev = atEnd ? poly[poly.length - 2] : poly[1];
  for (let i = 2; i <= poly.length && Math.hypot(tip.x - prev.x, tip.y - prev.y) < 1; i++) {
    prev = atEnd ? poly[poly.length - 1 - i] ?? prev : poly[i] ?? prev;
  }
  const ang = Math.atan2(tip.y - prev.y, tip.x - prev.x);
  return {
    x: tip.x - Math.cos(ang) * r,
    y: tip.y - Math.sin(ang) * r,
    rotation: (ang * 180) / Math.PI + 90,
  };
}

/**
 * Xếp thẻ tự do thành cây theo các đường nối (from → to), không cần "đời".
 * Gốc = thẻ không có đường đi vào; con đặt dưới cha, cha căn giữa các con.
 * Mỗi thẻ chỉ thuộc một cha đầu tiên tìm thấy (chống vòng). Thẻ không nối với ai
 * được đưa vào `loose` để người gọi tự xếp lưới.
 */
export function layoutByLinks(
  sizes: Record<string, { w: number; h: number }>,
  links: Array<{ from: string; to: string }>,
  gapX = GAP_X,
  gapY = GAP_Y,
): { positions: Record<string, Pt>; loose: string[] } {
  const ids = Object.keys(sizes);
  const kids: Record<string, string[]> = {};
  const hasIn = new Set<string>();
  const linked = new Set<string>();
  for (const l of links) {
    if (!sizes[l.from] || !sizes[l.to] || l.from === l.to) continue;
    (kids[l.from] ??= []).push(l.to);
    hasIn.add(l.to);
    linked.add(l.from);
    linked.add(l.to);
  }
  const loose = ids.filter((i) => !linked.has(i));
  const order = ids.filter((i) => linked.has(i));
  const roots = order.filter((i) => !hasIn.has(i));
  const seen = new Set<string>();
  const tree: Record<string, string[]> = {};
  const build = (id: string) => {
    seen.add(id);
    tree[id] = [];
    for (const c of kids[id] ?? []) {
      if (seen.has(c)) continue;
      tree[id].push(c);
      build(c);
    }
  };
  for (const r of roots) if (!seen.has(r)) build(r);
  for (const i of order) if (!seen.has(i)) { roots.push(i); build(i); }

  const rowH = Math.max(0, ...order.map((i) => sizes[i].h));
  const positions: Record<string, Pt> = {};
  const span: Record<string, number> = {};
  const measure = (id: string): number => {
    const kw = tree[id].map(measure);
    const kids_w = kw.reduce((a, b) => a + b, 0) + Math.max(0, kw.length - 1) * gapX;
    return (span[id] = Math.max(sizes[id].w, kids_w));
  };
  const place = (id: string, left: number, depth: number) => {
    const w = span[id];
    positions[id] = { x: left + (w - sizes[id].w) / 2, y: depth * (rowH + gapY) };
    let x = left;
    for (const c of tree[id]) { place(c, x, depth + 1); x += span[c] + gapX; }
  };
  let cursor = 0;
  for (const r of roots) {
    if (!tree[r]) continue;
    measure(r);
    place(r, cursor, 0);
    cursor += span[r] + gapX * 2;
  }
  return { positions, loose };
}

/** Điểm ở vị trí `t` (0..1 theo chiều dài) trên đa tuyến. */
export function pointOnPoly(poly: Pt[], t: number): Pt {
  if (poly.length === 0) return { x: 0, y: 0 };
  const lens: number[] = [];
  let total = 0;
  for (let i = 0; i + 1 < poly.length; i++) {
    const d = Math.hypot(poly[i + 1].x - poly[i].x, poly[i + 1].y - poly[i].y);
    lens.push(d);
    total += d;
  }
  let want = Math.min(1, Math.max(0, t)) * total;
  for (let i = 0; i < lens.length; i++) {
    if (want <= lens[i] || i === lens.length - 1) {
      const f = lens[i] === 0 ? 0 : Math.min(1, want / lens[i]);
      return { x: poly[i].x + (poly[i + 1].x - poly[i].x) * f, y: poly[i].y + (poly[i + 1].y - poly[i].y) * f };
    }
    want -= lens[i];
  }
  return { ...poly[0] };
}

/** Như `nearestOnPolylines` nhưng trả thêm đường nào và vị trí `t` (0..1) trên đường đó. */
export function nearestOnLines(
  lines: Array<{ ref: string; poly: Pt[] }>,
  pt: Pt,
  maxDist: number,
): { x: number; y: number; dist: number; at: LineAt } | null {
  let best: { x: number; y: number; dist: number; at: LineAt } | null = null;
  for (const ln of lines) {
    const total = ln.poly.reduce((a, p, i) => (i ? a + Math.hypot(p.x - ln.poly[i - 1].x, p.y - ln.poly[i - 1].y) : 0), 0);
    let before = 0;
    for (let i = 0; i + 1 < ln.poly.length; i++) {
      const a = ln.poly[i];
      const b = ln.poly[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      const u = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2));
      const x = a.x + u * dx;
      const y = a.y + u * dy;
      const dist = Math.hypot(pt.x - x, pt.y - y);
      const seg = Math.sqrt(len2);
      if (dist <= maxDist && (!best || dist < best.dist)) {
        best = { x, y, dist, at: { ref: ln.ref, t: total === 0 ? 0 : (before + u * seg) / total } };
      }
      before += seg;
    }
  }
  return best;
}
