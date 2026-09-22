import type { Palette } from "@/lib/poster/ornaments";
import type { Prim, Rect } from "@/lib/poster/prims";
import type { CreatureArt } from "@/lib/poster/creatures/types";

/**
 * Linh vật trên bảng gia phả: rồng chầu, phượng múa.
 *
 * Hình lấy từ file SVG do chủ dòng họ cung cấp, đã rút thành đường nét
 * thuần (xem scripts/convert-poster-creature.mjs) để in khổ A0 vẫn sắc.
 *
 * TẢI RỜI TỪNG HÌNH: con rồng Á Đông một mình đã ~2 MB dữ liệu đường
 * nét. Gộp vào gói chính thì ai mở app cũng phải tải, kể cả người không
 * bao giờ in bảng — nên chỉ tải đúng hình đang chọn.
 */

export interface CreatureOption {
  id: string;
  label: string;
  /** Nói trước cái giá, đừng để người dùng ngồi chờ không hiểu vì sao. */
  note?: string;
  load: () => Promise<CreatureArt>;
}

export const CREATURES: CreatureOption[] = [
  { id: "khong", label: "Không có", load: async () => EMPTY },
  {
    id: "rong-tribal",
    label: "Rồng dáng đứng",
    load: () => import("./rong-tribal").then((m) => m.art),
  },
  {
    id: "rong-a-dong",
    label: "Rồng Á Đông (dáng ngang)",
    note: "Nhiều chi tiết — tải lâu hơn và file PDF nặng hơn.",
    load: () => import("./rong-a-dong").then((m) => m.art),
  },
  {
    id: "phuong-line",
    label: "Phượng nét mảnh",
    load: () => import("./phuong-line").then((m) => m.art),
  },
  {
    id: "phuong-cuon",
    label: "Phượng cuộn",
    load: () => import("./phuong-cuon").then((m) => m.art),
  },
];

const EMPTY: CreatureArt = {
  id: "khong",
  label: "Không có",
  viewBox: { x: 0, y: 0, w: 1, h: 1 },
  shapes: [],
};

/**
 * Hoa văn NỀN — đặt mờ giữa tấm, phía sau cây.
 *
 * Tách khỏi danh sách linh vật vì cách dùng khác hẳn: linh vật để nhìn,
 * còn hoa văn nền để KHÔNG nhìn thấy rõ. Đọc ra được nó là hỏng — chữ
 * trong ô sẽ khó đọc theo.
 */
export const BACKGROUNDS: CreatureOption[] = [
  { id: "khong", label: "Không có", load: async () => EMPTY },
  {
    id: "trong-dong",
    label: "Trống đồng Đông Sơn",
    note: "Hoa văn mờ giữa tấm. Nhiều nét — tải lâu hơn một chút.",
    load: () => import("./trong-dong").then((m) => m.art),
  },
];

export type CreaturePlacement = "ben-bang-ten" | "goc-tren" | "goc-duoi";

export const PLACEMENTS: { id: CreaturePlacement; label: string }[] = [
  { id: "ben-bang-ten", label: "Chầu hai bên băng tên" },
  { id: "goc-tren", label: "Hai góc trên" },
  { id: "goc-duoi", label: "Hai góc dưới" },
];

/**
 * Đặt hình vào một ô, giữ NGUYÊN tỉ lệ và canh giữa.
 *
 * `flip` lật ngang để con bên phải soi gương con bên trái — đôi rồng
 * chầu mà cùng quay một hướng thì nhìn là biết ngay sai.
 */
/**
 * Hoa văn nền: phủ giữa tấm, một màu, MỜ HẲN.
 *
 * Đặt 6% chứ không 20%: hoa văn trống đồng dày đặc, đậm hơn chút là chữ
 * tên người nằm trên nó đọc không ra — mà tên người mới là thứ người ta
 * tới để đọc.
 */
export function backgroundPrims(
  art: CreatureArt,
  box: Rect,
  pal: Palette,
  opacity = 0.06,
): Prim[] {
  if (art.shapes.length === 0) return [];
  const vb = art.viewBox;
  // Phủ theo cạnh NGẮN để hoa văn tròn không bị cắt mất vành.
  const s = Math.min(box.w / vb.w, box.h / vb.h);
  const tx = box.x + (box.w - vb.w * s) / 2;
  const ty = box.y + (box.h - vb.h * s) / 2;
  return [
    {
      k: "group",
      transform: `translate(${tx} ${ty}) scale(${s} ${s}) translate(${-vb.x} ${-vb.y})`,
      children: art.shapes.map((sh) => ({
        k: "path" as const,
        d: sh.d,
        fill: sh.fill ? pal.primary : undefined,
        stroke: sh.stroke ? pal.primary : undefined,
        sw: sh.stroke ? (sh.sw ?? 1) : undefined,
        opacity,
      })),
    },
  ];
}

export function creaturePrims(
  art: CreatureArt,
  box: Rect,
  pal: Palette,
  flip: boolean,
): Prim[] {
  if (art.shapes.length === 0 || box.w <= 0 || box.h <= 0) return [];
  const vb = art.viewBox;
  const s = Math.min(box.w / vb.w, box.h / vb.h);
  const drawW = vb.w * s;
  const drawH = vb.h * s;
  const tx = box.x + (box.w - drawW) / 2;
  const ty = box.y + (box.h - drawH) / 2;

  // Lật quanh tâm ô: scale(-1) rồi bù lại bề ngang, nếu không hình bay
  // sang bên trái màn hình.
  const flipPart = flip ? `translate(${drawW} 0) scale(-1 1) ` : "";
  const transform = `translate(${tx} ${ty}) ${flipPart}scale(${s} ${s}) translate(${-vb.x} ${-vb.y})`;

  const colorOf = (t: "dark" | "light") =>
    t === "light" ? pal.paper : pal.primary;

  return [
    {
      k: "group",
      transform,
      children: art.shapes.map((sh) => {
        const path: Prim = {
          k: "path",
          d: sh.d,
          fill: sh.fill ? colorOf(sh.fill) : undefined,
          stroke: sh.stroke ? colorOf(sh.stroke) : undefined,
          sw: sh.stroke ? (sh.sw ?? 1) : undefined,
        };
        // Nét nào mang sẵn phép biến hình từ file gốc thì bọc riêng —
        // gắn thẳng vào thẻ path sẽ bị bỏ qua trong im lặng, và hình
        // hiện ra lệch chỗ mà không ai biết vì sao.
        return sh.transform
          ? ({ k: "group", transform: sh.transform, children: [path] } as Prim)
          : path;
      }),
    },
  ];
}
