import type { Prim, Rect } from "@/lib/poster/prims";
import { centeredLines } from "@/lib/poster/prims";

/**
 * Hoa văn của bảng gia phả, chia thành CÁC PHẦN RỜI: khung diềm, băng
 * tên, hoạ tiết góc, hai cột câu đối, bảng màu. Mỗi phần chọn riêng
 * được, nhưng tất cả nhận vùng vẽ từ `posterRegions` nên không phần nào
 * lấn chỗ phần khác.
 *
 * Vẽ bằng ĐƯỜNG NÉT (vector), không dùng ảnh: bảng gia phả in khổ A0 là
 * chuyện thường, mà ảnh bitmap phóng tới cỡ đó thì rỗ hết — hoa văn vẽ
 * bằng đường thì khổ nào cũng nét như nhau.
 *
 * Hoạ tiết ở đây là hình học cách điệu (hồi văn, hoa thị, mây, cánh
 * sen). Rồng chầu hay sen vẽ tay như tranh in ngoài tiệm thì phải có
 * tranh riêng, không sinh ra bằng công thức được — chỗ đó để trống cho
 * ai muốn đặt hoạ sĩ vẽ rồi ghép vào sau.
 */

export interface Palette {
  id: string;
  label: string;
  /** Nền tấm. */
  paper: string;
  /** Màu chủ đạo: khung, băng tên, cột câu đối. */
  primary: string;
  /** Màu nhấn: nét hoa văn, viền ô. */
  accent: string;
  /** Màu chữ trên nền sáng. */
  ink: string;
  /** Màu chữ trên nền màu chủ đạo. */
  inkOnPrimary: string;
  /** Nền ô người trong cây. */
  cardFill: string;
  /** Nền ô dâu/rể — nhạt hơn để phân biệt mà không cần chú thích. */
  cardFillSpouse: string;
}

export const PALETTES: Palette[] = [
  {
    id: "son-vang",
    label: "Đỏ son – vàng đồng",
    paper: "#FDF8EE",
    primary: "#9E2B25",
    accent: "#B8862A",
    ink: "#2B2118",
    inkOnPrimary: "#FDF3D7",
    cardFill: "#FFFFFF",
    cardFillSpouse: "#F6EEDC",
  },
  {
    id: "cham-vang",
    label: "Chàm – vàng",
    paper: "#F7F5EF",
    primary: "#1F3A5F",
    accent: "#C79A2E",
    ink: "#1B2430",
    inkOnPrimary: "#F3E7C4",
    cardFill: "#FFFFFF",
    cardFillSpouse: "#EAEFF5",
  },
  {
    id: "muc-nho",
    label: "Mực nho (đen trắng)",
    paper: "#FFFFFF",
    primary: "#2A2A2A",
    accent: "#5A5A5A",
    ink: "#1A1A1A",
    inkOnPrimary: "#FFFFFF",
    cardFill: "#FFFFFF",
    cardFillSpouse: "#F0F0F0",
  },
];

export const paletteById = (id: string): Palette =>
  PALETTES.find((p) => p.id === id) ?? PALETTES[0];

// ───────── Khung diềm ───────────────────────────────────────────────

export type BorderId = "hoi-van" | "hoa-thi" | "kep-thanh";

export const BORDERS: { id: BorderId; label: string }[] = [
  { id: "hoi-van", label: "Hồi văn" },
  { id: "hoa-thi", label: "Chuỗi hoa thị" },
  { id: "kep-thanh", label: "Kép thanh" },
];

/**
 * Đặt một hoạ tiết lặp đều dọc theo bốn cạnh của khung.
 *
 * Bước lặp tính từ chiều dài cạnh chia cho số nhịp làm tròn, nên hoạ
 * tiết luôn KHÍT vào góc — nếu lấy bước cố định thì cạnh nào cũng dư ra
 * một mẩu dở dang ở góc, và đó là chỗ mắt người nhìn vào đầu tiên.
 */
function repeatAlongBand(
  band: Rect,
  thickness: number,
  targetStep: number,
  motif: (cx: number, cy: number, step: number, horizontal: boolean) => Prim[],
): Prim[] {
  const out: Prim[] = [];
  const runs: { len: number; at: (t: number) => [number, number]; horiz: boolean }[] = [
    {
      len: band.w,
      at: (t) => [band.x + t, band.y + thickness / 2],
      horiz: true,
    },
    {
      len: band.w,
      at: (t) => [band.x + t, band.y + band.h - thickness / 2],
      horiz: true,
    },
    {
      len: band.h,
      at: (t) => [band.x + thickness / 2, band.y + t],
      horiz: false,
    },
    {
      len: band.h,
      at: (t) => [band.x + band.w - thickness / 2, band.y + t],
      horiz: false,
    },
  ];
  for (const run of runs) {
    const n = Math.max(2, Math.round(run.len / targetStep));
    const step = run.len / n;
    for (let i = 0; i < n; i++) {
      const [cx, cy] = run.at(step * (i + 0.5));
      out.push(...motif(cx, cy, step, run.horiz));
    }
  }
  return out;
}

export function borderPrims(
  id: BorderId,
  band: Rect,
  thickness: number,
  pal: Palette,
  scale: number,
): Prim[] {
  const sw = Math.max(1, 1.4 * scale);
  const out: Prim[] = [
    // Dải nền của khung + hai đường viền trong/ngoài.
    { k: "rect", x: band.x, y: band.y, w: band.w, h: band.h, stroke: pal.primary, sw: sw * 1.6 },
    {
      k: "rect",
      x: band.x + thickness,
      y: band.y + thickness,
      w: band.w - thickness * 2,
      h: band.h - thickness * 2,
      stroke: pal.primary,
      sw,
    },
  ];

  if (id === "kep-thanh") {
    out.push({
      k: "rect",
      x: band.x + thickness * 0.45,
      y: band.y + thickness * 0.45,
      w: band.w - thickness * 0.9,
      h: band.h - thickness * 0.9,
      stroke: pal.accent,
      sw: sw * 2.2,
    });
    return out;
  }

  if (id === "hoa-thi") {
    const r = thickness * 0.26;
    out.push(
      ...repeatAlongBand(band, thickness, thickness * 1.9, (cx, cy) => [
        { k: "circle", cx, cy, r, stroke: pal.accent, sw },
        { k: "circle", cx, cy, r: r * 0.42, fill: pal.accent },
      ]),
    );
    return out;
  }

  // Hồi văn: xoắn vuông, hướng theo cạnh đang chạy.
  const u = thickness * 0.3;
  out.push(
    ...repeatAlongBand(band, thickness, thickness * 2.1, (cx, cy, _step, horiz) => {
      const d = horiz
        ? `M ${cx - u * 1.5} ${cy + u} L ${cx - u * 1.5} ${cy - u} L ${cx + u * 1.5} ${cy - u} L ${cx + u * 1.5} ${cy + u * 0.2} L ${cx - u * 0.4} ${cy + u * 0.2} L ${cx - u * 0.4} ${cy - u * 0.4}`
        : `M ${cx + u} ${cy - u * 1.5} L ${cx - u} ${cy - u * 1.5} L ${cx - u} ${cy + u * 1.5} L ${cx + u * 0.2} ${cy + u * 1.5} L ${cx + u * 0.2} ${cy - u * 0.4} L ${cx - u * 0.4} ${cy - u * 0.4}`;
      return [{ k: "path", d, stroke: pal.accent, sw: sw * 1.3 }];
    }),
  );
  return out;
}

// ───────── Băng tên dòng họ ─────────────────────────────────────────

export type BannerId = "cuon-thu" | "khien-vom" | "the-chu-nhat";

export const BANNERS: { id: BannerId; label: string }[] = [
  { id: "cuon-thu", label: "Cuốn thư" },
  { id: "khien-vom", label: "Khiên vòm" },
  { id: "the-chu-nhat", label: "Thẻ chữ nhật" },
];

export function bannerPrims(
  id: BannerId,
  box: Rect,
  pal: Palette,
  scale: number,
  title: string,
  subtitle: string | null,
): Prim[] {
  const sw = Math.max(1, 1.4 * scale);
  const out: Prim[] = [];
  const { x, y, w, h } = box;

  if (id === "cuon-thu") {
    // Thân băng + hai đầu cuộn tròn vào trong.
    const curl = w * 0.075;
    out.push({
      k: "path",
      d: `M ${x + curl} ${y} L ${x + w - curl} ${y} C ${x + w} ${y} ${x + w} ${y + h} ${x + w - curl} ${y + h} L ${x + curl} ${y + h} C ${x} ${y + h} ${x} ${y} ${x + curl} ${y} Z`,
      fill: pal.primary,
      stroke: pal.accent,
      sw: sw * 1.6,
    });
    out.push({
      k: "path",
      d: `M ${x + curl * 1.3} ${y + h * 0.5} C ${x + curl * 0.2} ${y + h * 0.5} ${x + curl * 0.2} ${y + h * 0.12} ${x + curl * 1.1} ${y + h * 0.18}`,
      stroke: pal.accent,
      sw,
    });
    out.push({
      k: "path",
      d: `M ${x + w - curl * 1.3} ${y + h * 0.5} C ${x + w - curl * 0.2} ${y + h * 0.5} ${x + w - curl * 0.2} ${y + h * 0.12} ${x + w - curl * 1.1} ${y + h * 0.18}`,
      stroke: pal.accent,
      sw,
    });
  } else if (id === "khien-vom") {
    const arc = h * 0.45;
    out.push({
      k: "path",
      d: `M ${x} ${y + arc} Q ${x + w / 2} ${y - arc * 0.5} ${x + w} ${y + arc} L ${x + w} ${y + h} L ${x} ${y + h} Z`,
      fill: pal.primary,
      stroke: pal.accent,
      sw: sw * 1.6,
    });
  } else {
    out.push({ k: "rect", x, y, w, h, fill: pal.primary, stroke: pal.accent, sw: sw * 1.6 });
    out.push({
      k: "rect",
      x: x + h * 0.12,
      y: y + h * 0.12,
      w: w - h * 0.24,
      h: h - h * 0.24,
      stroke: pal.accent,
      sw,
    });
  }

  // Chữ: tên dòng họ to, dòng phụ nhỏ bên dưới.
  const titleSize = Math.min(h * 0.42, (w * 1.6) / Math.max(6, title.length));
  const lines = subtitle ? [title, subtitle] : [title];
  const sizes = subtitle ? [titleSize, titleSize * 0.42] : [titleSize];
  const totalH = sizes.reduce((a, s) => a + s * 1.35, 0);
  let cursor = y + h * 0.55 - totalH / 2 + (id === "khien-vom" ? h * 0.12 : 0);
  lines.forEach((s, i) => {
    cursor += sizes[i] * 1.35;
    out.push({
      k: "text",
      x: x + w / 2,
      y: cursor - sizes[i] * 0.4,
      s,
      size: sizes[i],
      fill: pal.inkOnPrimary,
      anchor: "middle",
      weight: i === 0 ? 600 : 400,
    });
  });
  return out;
}

// ───────── Hoạ tiết góc ─────────────────────────────────────────────

export type CornerId = "may" | "sen" | "khong";

export const CORNERS: { id: CornerId; label: string }[] = [
  { id: "may", label: "Mây cách điệu" },
  { id: "sen", label: "Cánh sen" },
  { id: "khong", label: "Không có" },
];

/**
 * Hoạ tiết một góc. `flipX`/`flipY` để bốn góc đối xứng nhau — vẽ bốn
 * hình riêng thì sớm muộn cũng có một góc lệch mà không ai để ý.
 */
export function cornerPrims(
  id: CornerId,
  box: Rect,
  pal: Palette,
  scale: number,
  flipX: boolean,
  flipY: boolean,
): Prim[] {
  if (id === "khong") return [];
  const sw = Math.max(1, 1.3 * scale);
  const px = (t: number) => (flipX ? box.x + box.w * (1 - t) : box.x + box.w * t);
  const py = (t: number) => (flipY ? box.y + box.h * (1 - t) : box.y + box.h * t);

  if (id === "sen") {
    const out: Prim[] = [];
    // Nan cánh sen xoè từ góc.
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      out.push({
        k: "path",
        d: `M ${px(0.08)} ${py(0.08)} Q ${px(0.28 + t * 0.5)} ${py(0.2 + (1 - t) * 0.35)} ${px(0.1 + t * 0.85)} ${py(0.95 - t * 0.85)}`,
        stroke: pal.accent,
        sw,
      });
    }
    out.push({ k: "circle", cx: px(0.1), cy: py(0.1), r: box.w * 0.06, fill: pal.primary });
    return out;
  }

  // Mây: xoắn ốc vuông góc, hai lớp.
  return [
    {
      k: "path",
      d: `M ${px(0.05)} ${py(0.62)} Q ${px(0.05)} ${py(0.05)} ${px(0.62)} ${py(0.05)} Q ${px(0.34)} ${py(0.12)} ${px(0.3)} ${py(0.3)} Q ${px(0.26)} ${py(0.5)} ${px(0.05)} ${py(0.62)} Z`,
      fill: pal.primary,
    },
    {
      k: "path",
      d: `M ${px(0.16)} ${py(0.9)} Q ${px(0.16)} ${py(0.16)} ${px(0.9)} ${py(0.16)}`,
      stroke: pal.accent,
      sw: sw * 1.4,
    },
  ];
}

// ───────── Cột câu đối ──────────────────────────────────────────────

export type ColumnId = "cot-do" | "thanh-manh" | "khong";

export const COLUMNS: { id: ColumnId; label: string }[] = [
  { id: "cot-do", label: "Cột đặc, chữ dọc" },
  { id: "thanh-manh", label: "Cột thanh mảnh" },
  { id: "khong", label: "Không có" },
];

/**
 * Một cột câu đối. Chữ viết DỌC theo lối cổ: mỗi chữ một dòng, không
 * quay ngang — quay chữ 90° thì người đọc phải nghiêng đầu, mà tấm này
 * treo trên tường nhà thờ họ.
 */
export function columnPrims(
  id: ColumnId,
  box: Rect,
  pal: Palette,
  scale: number,
  text: string,
): Prim[] {
  if (id === "khong" || box.w <= 0) return [];
  const sw = Math.max(1, 1.4 * scale);
  const out: Prim[] = [];
  const filled = id === "cot-do";

  if (filled) {
    out.push({
      k: "rect",
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      fill: pal.primary,
      stroke: pal.accent,
      sw,
      rx: box.w * 0.12,
    });
  } else {
    out.push({
      k: "rect",
      x: box.x + box.w * 0.18,
      y: box.y,
      w: box.w * 0.64,
      h: box.h,
      stroke: pal.accent,
      sw: sw * 1.4,
      rx: box.w * 0.1,
    });
  }

  const chars = text.trim().split(/\s+/).join(" ").split("");
  if (chars.length === 0) return out;
  const usable = box.h * 0.86;
  const size = Math.min(box.w * 0.56, usable / chars.length / 1.25);
  const lineH = size * 1.25;
  out.push(
    ...centeredLines(
      chars,
      { x: box.x, y: box.y + box.h * 0.07, w: box.w, h: usable },
      size,
      lineH,
      filled ? pal.inkOnPrimary : pal.primary,
      600,
    ),
  );
  return out;
}
