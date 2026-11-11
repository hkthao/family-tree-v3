/** Kích thước một ô lưới trong hệ toạ độ SVG của bức ghép. */
export const CELL = 100;

/** Phần ảnh nhô ra ngoài ô để phủ kín răng cưa (tỉ lệ theo ô). */
export const TAB_MARGIN = 0.2;

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** ±1 xác định theo (seed, vị trí cạnh) — hai mảnh kề luôn khớp răng. */
function sign(seed: string, kind: "h" | "v", r: number, c: number): 1 | -1 {
  return hash(`${seed}:${kind}:${r}:${c}`) % 2 === 0 ? 1 : -1;
}

/** Một cạnh từ (x1,y1) → (x2,y2), thuận chiều kim đồng hồ; dir>0 lồi ra ngoài. */
function edge(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dir: number,
): string {
  if (dir === 0) return `L${x2} ${y2}`;
  const ux = (x2 - x1) / CELL;
  const uy = (y2 - y1) / CELL;
  const nx = uy;
  const ny = -ux;
  const p = (a: number, b: number) => {
    const X = x1 + ux * a * CELL + nx * b * CELL * dir;
    const Y = y1 + uy * a * CELL + ny * b * CELL * dir;
    return `${X.toFixed(2)} ${Y.toFixed(2)}`;
  };
  return [
    // Răng nhỏ, gọn: chen ít ảnh sang ô bên cạnh cho bức đỡ lộn xộn.
    `L${p(0.42, 0)}`,
    `C${p(0.42, 0.05)} ${p(0.37, 0.07)} ${p(0.37, 0.12)}`,
    `C${p(0.37, 0.2)} ${p(0.63, 0.2)} ${p(0.63, 0.12)}`,
    `C${p(0.63, 0.07)} ${p(0.58, 0.05)} ${p(0.58, 0)}`,
    `L${x2} ${y2}`,
  ].join(" ");
}

/** Đường viền răng cưa của ô (hàng r, cột c) trong lưới rows×cols. */
export function jigsawPath(
  seed: string,
  r: number,
  c: number,
  rows: number,
  cols: number,
  total: number = rows * cols,
): string {
  const x0 = c * CELL;
  const y0 = r * CELL;
  const x1 = x0 + CELL;
  const y1 = y0 + CELL;
  const idx = r * cols + c;
  // Hàng cuối có thể lẻ: ô không có hàng xóm → cạnh thẳng.
  const top = r === 0 ? 0 : -sign(seed, "h", r - 1, c);
  const right = c === cols - 1 || idx + 1 >= total ? 0 : sign(seed, "v", r, c);
  const bottom =
    r === rows - 1 || idx + cols >= total ? 0 : sign(seed, "h", r, c);
  const left = c === 0 ? 0 : -sign(seed, "v", r, c - 1);
  return [
    `M${x0} ${y0}`,
    edge(x0, y0, x1, y0, top),
    edge(x1, y0, x1, y1, right),
    edge(x1, y1, x0, y1, bottom),
    edge(x0, y1, x0, y0, left),
    "Z",
  ].join(" ");
}

/** Tổng số ô hiển thị: đủ `slots`, dư một ô trống sau mảnh cuối, và luôn tròn hàng. */
export function gridTotal(
  maxPosition: number,
  slots: number,
  cols: number,
): number {
  return Math.ceil(Math.max(slots, maxPosition + 2) / cols) * cols;
}

export function gridRows(total: number, cols: number): number {
  return Math.max(1, Math.ceil(total / cols));
}

/** Trần số ô của một bức. */
export const MAX_SLOTS = 150;

/** Số ô tròn hàng theo số cột, không vượt MAX_SLOTS. */
export function normalizeSlots(slots: number, cols: number): number {
  const rounded = Math.ceil(slots / cols) * cols;
  return rounded <= MAX_SLOTS ? rounded : Math.floor(MAX_SLOTS / cols) * cols;
}

export type MosaicVariant = "grid" | "puzzle";

/** Ô vuông bo góc, thụt vào một khe nhỏ — kiểu lưới ảnh gọn, không răng cưa. */
function flatPath(r: number, c: number): string {
  const inset = 1.5;
  const rad = 5;
  const x0 = c * CELL + inset;
  const y0 = r * CELL + inset;
  const x1 = (c + 1) * CELL - inset;
  const y1 = (r + 1) * CELL - inset;
  return [
    `M${x0 + rad} ${y0}`,
    `H${x1 - rad}`,
    `A${rad} ${rad} 0 0 1 ${x1} ${y0 + rad}`,
    `V${y1 - rad}`,
    `A${rad} ${rad} 0 0 1 ${x1 - rad} ${y1}`,
    `H${x0 + rad}`,
    `A${rad} ${rad} 0 0 1 ${x0} ${y1 - rad}`,
    `V${y0 + rad}`,
    `A${rad} ${rad} 0 0 1 ${x0 + rad} ${y0}`,
    "Z",
  ].join(" ");
}

/** Đường viền một ô theo kiểu hiển thị đang chọn. */
export function cellPath(
  variant: MosaicVariant,
  seed: string,
  r: number,
  c: number,
  rows: number,
  cols: number,
  total: number,
): string {
  return variant === "puzzle"
    ? jigsawPath(seed, r, c, rows, cols, total)
    : flatPath(r, c);
}
