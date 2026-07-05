import type { GalleryPhoto } from "@/lib/queries/galleryPhotos";

/** Kiểu khung (viền màu + độ dày). Mat trắng do PhotoFrame tự tạo (fit ảnh). */
export type FrameStyle = { color: string; border: number; depth: number };

// Đều đủ tương phản với tường sáng (bỏ khung trắng — sẽ tàng hình).
export const FRAME_STYLES: FrameStyle[] = [
  { color: "#1B1B1D", border: 0.06, depth: 0.05 }, // đen (như mẫu)
  { color: "#2B2B2E", border: 0.055, depth: 0.05 }, // đen xám
  { color: "#4A3524", border: 0.06, depth: 0.06 }, // gỗ đậm
  { color: "#7A5A2E", border: 0.06, depth: 0.06 }, // gỗ sáng
  { color: "#8C6A1E", border: 0.055, depth: 0.06 }, // vàng đồng
  { color: "#3A3A3D", border: 0.06, depth: 0.05 }, // xám đậm
];

export type PlacedFrame = {
  photo: GalleryPhoto;
  position: [number, number, number];
  rotationY: number;
  viewFrom: [number, number, number];
  w: number; // bề rộng khung (slot)
  h: number; // chiều cao khung (slot)
  style: FrameStyle;
};

export type RoomLayout = {
  frames: PlacedFrame[];
  width: number;
  length: number;
  height: number;
};

const WALL_X = 3.2;
export const EYE = 1.65;
const HEIGHT = 3.9;
const STANDBACK = 3.3;
const GAP = 1.9; // khoảng cách giữa các cụm
const START = 2.6;

/** Ô ảnh trong một cụm: lệch (x dọc tường, y cao/thấp) + cỡ (w×h). */
type Slot = { x: number; y: number; w: number; h: number };
/** Mẫu cụm: footprint (bề rộng chiếm dọc tường) + các ô. */
type Template = { footprint: number; slots: Slot[] };

// Các cụm được siết SÁT NHAU (gutter đều ~0.1) để thành một mảng bố cục gọn.
const T_SINGLE: Template = {
  footprint: 1.7,
  slots: [{ x: 0, y: 0, w: 1.45, h: 1.15 }],
};
const T3: Template = {
  footprint: 2.1,
  slots: [
    { x: -0.5, y: 0.0, w: 1.0, h: 1.25 }, // lớn, dọc — bên trái
    { x: 0.53, y: 0.265, w: 0.9, h: 0.72 }, // nhỏ trên phải
    { x: 0.53, y: -0.535, w: 0.9, h: 0.72 }, // nhỏ dưới phải
  ],
};
const T4: Template = {
  footprint: 2.6,
  slots: [
    { x: -0.78, y: 0.55, w: 1.0, h: 0.78 },
    { x: 0.3, y: 0.52, w: 0.92, h: 0.72 },
    { x: -0.78, y: -0.5, w: 0.92, h: 0.82 },
    { x: 0.28, y: -0.48, w: 1.02, h: 0.9 },
  ],
};
// 6 khung như mẫu: 3 cột (trái/giữa/phải) × 2 hàng, gutter đều ~0.08, KHÔNG chồng.
// B ở giữa là khung LỚN & CAO nhất; A/C kèm hai bên trên, D/E/F ở dưới; gutter
// đều ~0.06 (sát nhau, nghệ thuật như mẫu).
const T6: Template = {
  footprint: 3.1,
  slots: [
    { x: -1.04, y: 0.6, w: 0.98, h: 0.82 }, // A trái-trên
    { x: 0.06, y: 0.36, w: 1.1, h: 1.3 }, // B giữa (lớn nhất, cao)
    { x: 1.07, y: 0.66, w: 0.8, h: 0.7 }, // C phải-trên
    { x: -1.2, y: -0.18, w: 0.66, h: 0.62 }, // D trái-dưới (nhỏ)
    { x: 0.06, y: -0.68, w: 1.02, h: 0.66 }, // E giữa-dưới
    { x: 1.1, y: -0.22, w: 0.86, h: 0.94 }, // F phải-dưới
  ],
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bố trí ảnh thành các CỤM "gallery wall" (nhiều khung to/nhỏ ghép mảng) rải
 * ngẫu nhiên dọc hai bên hành lang — đỡ nhàm chán so với treo từng ảnh đều nhau.
 * Random có seed → ổn định giữa các lần mở. Ảnh fit trong khung (mat trắng).
 */
export function placePhotos(photos: GalleryPhoto[]): RoomLayout {
  const rnd = mulberry32(photos.length * 2654435761 + 7);
  const frames: PlacedFrame[] = [];
  let zLeft = START;
  let zRight = START;
  let i = 0; // photo index
  let left = true; // xen kẽ hai bên
  let guard = 0;

  while (i < photos.length && guard++ < photos.length + 8) {
    const remaining = photos.length - i;
    const options: Template[] = [];
    if (remaining >= 6) options.push(T6);
    if (remaining >= 4) options.push(T4);
    if (remaining >= 3) options.push(T3);
    options.push(T_SINGLE);
    const t = options[Math.floor(rnd() * options.length)];

    const wallX = left ? -WALL_X : WALL_X;
    const rotationY = left ? Math.PI / 2 : -Math.PI / 2;
    const baseZ = (left ? zLeft : zRight) + t.footprint / 2;
    // Cả cụm DÙNG CHUNG một kiểu khung cho gọn/nghệ thuật.
    const style = FRAME_STYLES[Math.floor(rnd() * FRAME_STYLES.length)];

    for (const s of t.slots) {
      if (i >= photos.length) break;
      const z = baseZ + s.x;
      const y = EYE + s.y;
      frames.push({
        photo: photos[i++],
        position: [wallX, y, z],
        rotationY,
        viewFrom: [wallX * 0.15, EYE, z - STANDBACK],
        w: s.w,
        h: s.h,
        style,
      });
    }

    if (left) zLeft += t.footprint + GAP;
    else zRight += t.footprint + GAP;
    left = !left;
  }

  const length = Math.max(zLeft, zRight, START * 2) + GAP;
  return { frames, width: WALL_X * 2, length, height: HEIGHT };
}
