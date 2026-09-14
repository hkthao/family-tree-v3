import type { Rect } from "@/lib/poster/prims";

/**
 * MỘT bố cục dùng chung cho cả tấm.
 *
 * Hoa văn chia thành nhiều phần rời (khung diềm, băng tên, hoạ tiết góc,
 * hai cột câu đối) nhưng KHÔNG phần nào tự quyết định chỗ đứng: tất cả
 * đọc vùng của mình từ đây, và phần cây gia phả cũng vậy. Nhờ thế đổi
 * mẫu hoa văn không bao giờ làm cây đè lên khung — thứ mà mỗi mẫu tự
 * tính toạ độ riêng thì chắc chắn sẽ xảy ra, và chỉ lộ ra ở khổ giấy nào
 * đó chứ không phải mọi khổ.
 */

export type PosterSize = "A3" | "A2" | "A1" | "A0";

/** Khổ giấy NGANG, tính bằng point (1/72 inch) — đơn vị của @react-pdf. */
export const POSTER_SIZES: Record<
  PosterSize,
  { w: number; h: number; label: string; cm: string }
> = {
  A3: { w: 1191, h: 842, label: "A3", cm: "42 × 29,7 cm" },
  A2: { w: 1684, h: 1191, label: "A2", cm: "59,4 × 42 cm" },
  A1: { w: 2384, h: 1684, label: "A1", cm: "84,1 × 59,4 cm" },
  A0: { w: 3370, h: 2384, label: "A0", cm: "118,9 × 84,1 cm" },
};

export interface PosterRegions {
  page: Rect;
  /** Viền ngoài cùng — nơi vẽ khung diềm hoa văn. */
  border: Rect;
  /** Lòng trong khung diềm; mọi thứ khác nằm gọn trong đây. */
  inner: Rect;
  /** Băng tên dòng họ, trên giữa. */
  banner: Rect;
  /** Hai cột dọc hai bên (câu đối). */
  columnLeft: Rect;
  columnRight: Rect;
  /** Bốn ô vuông ở góc trong, cho hoạ tiết góc. */
  corners: { topLeft: Rect; topRight: Rect; bottomLeft: Rect; bottomRight: Rect };
  /**
   * Ô cho linh vật (rồng chầu, phượng múa) theo từng cách đặt.
   *
   * Vùng này nằm trong CÙNG bố cục với cây, nên chọn rồng không bao giờ
   * làm rồng đè lên tên người — thứ chắc chắn xảy ra nếu hình tự tìm chỗ
   * đứng theo tỉ lệ riêng của nó.
   */
  creatures: Record<"ben-bang-ten" | "goc-tren" | "goc-duoi", [Rect, Rect]>;
  /** Chỗ còn lại để vẽ cây — phần duy nhất co giãn theo dữ liệu. */
  tree: Rect;
  /** Bề dày khung diềm, để mẫu hoa văn biết vẽ dày bao nhiêu. */
  borderBand: number;
  /** Hệ số quy đổi so với khổ A2 — mẫu hoa văn nhân vào để nét không
   *  mảnh dần khi in khổ to. */
  scale: number;
}

export interface FrameOptions {
  /** Có hai cột câu đối hay không — không có thì cây rộng thêm. */
  columns: boolean;
  /** Có băng tên hay không. */
  banner: boolean;
  /**
   * Linh vật đặt ở đâu — cây phải tránh chỗ đó ra.
   *
   * "ben-bang-ten" không ăn vào phần cây (rồng đứng hai bên băng tên),
   * còn đặt ở góc thì cây phải lùi lên hoặc xuống, nếu không rồng nằm đè
   * lên mấy đời cuối.
   */
  creature?: "khong" | "ben-bang-ten" | "goc-tren" | "goc-duoi";
}

/**
 * Tính vùng cho một khổ giấy.
 *
 * Mọi con số là TỈ LỆ theo khổ, không phải point cố định: một cái viền
 * dày 24pt trông vừa mắt trên A3 sẽ mất tăm trên A0.
 */
export function posterRegions(
  size: PosterSize,
  opts: FrameOptions = { columns: true, banner: true },
): PosterRegions {
  const place = opts.creature ?? "khong";
  const { w, h } = POSTER_SIZES[size];
  const scale = w / POSTER_SIZES.A2.w;

  const margin = Math.round(Math.min(w, h) * 0.022);
  const borderBand = Math.round(Math.min(w, h) * 0.032);

  const border: Rect = { x: margin, y: margin, w: w - margin * 2, h: h - margin * 2 };
  const gap = Math.round(borderBand * 0.55);
  const inner: Rect = {
    x: border.x + borderBand + gap,
    y: border.y + borderBand + gap,
    w: border.w - (borderBand + gap) * 2,
    h: border.h - (borderBand + gap) * 2,
  };

  const bannerH = opts.banner ? Math.round(inner.h * 0.135) : 0;
  const banner: Rect = {
    x: inner.x + inner.w * 0.22,
    y: inner.y,
    w: inner.w * 0.56,
    h: bannerH,
  };

  const colW = opts.columns ? Math.round(inner.w * 0.062) : 0;
  const columnLeft: Rect = { x: inner.x, y: inner.y, w: colW, h: inner.h };
  const columnRight: Rect = {
    x: inner.x + inner.w - colW,
    y: inner.y,
    w: colW,
    h: inner.h,
  };

  // Ô góc nằm TRONG lòng, cạnh cột (nếu có) — hoạ tiết góc không được
  // lấn vào chỗ của cây.
  const cs = Math.round(Math.min(inner.w, inner.h) * 0.11);
  const cx0 = columnLeft.x + colW;
  const cx1 = columnRight.x - cs;
  const corners = {
    topLeft: { x: cx0, y: inner.y, w: cs, h: cs },
    topRight: { x: cx1, y: inner.y, w: cs, h: cs },
    bottomLeft: { x: cx0, y: inner.y + inner.h - cs, w: cs, h: cs },
    bottomRight: { x: cx1, y: inner.y + inner.h - cs, w: cs, h: cs },
  };

  // Ô linh vật.
  //
  // "Chầu hai bên băng tên": lấp đúng khoảng trống hai bên băng — chỗ
  // này vốn bỏ không, nên không lấy mất chỗ nào của cây.
  const sideW = banner.x - (columnLeft.x + colW) - Math.round(borderBand * 0.4);
  const sideH = Math.round(bannerH * 1.25);
  const sideY = inner.y;
  const creatureSide: [Rect, Rect] = [
    { x: columnLeft.x + colW, y: sideY, w: Math.max(0, sideW), h: sideH },
    {
      x: banner.x + banner.w + Math.round(borderBand * 0.4),
      y: sideY,
      w: Math.max(0, sideW),
      h: sideH,
    },
  ];

  const breathe = Math.round(borderBand * 0.5);
  const cs2 = Math.round(Math.min(inner.w, inner.h) * 0.16);
  const cornerTop: [Rect, Rect] = [
    { x: cx0, y: inner.y + bannerH, w: cs2, h: cs2 },
    { x: columnRight.x - cs2, y: inner.y + bannerH, w: cs2, h: cs2 },
  ];
  const cornerBottom: [Rect, Rect] = [
    { x: cx0, y: inner.y + inner.h - cs2, w: cs2, h: cs2 },
    { x: columnRight.x - cs2, y: inner.y + inner.h - cs2, w: cs2, h: cs2 },
  ];

  // Cây: dưới băng tên, giữa hai cột. Chừa thêm một khoảng thở để chữ
  // trong ô không chạm vào hoa văn.
  //
  // Linh vật ở góc thì cây phải lùi HẲN qua khỏi ô linh vật. Lùi nửa vời
  // (đủ cho hàng ngắn, không đủ cho hàng dài) thì đuôi rồng vắt ngang
  // tên người ở hàng cuối — mà hàng cuối luôn là hàng rộng nhất.
  const dodge =
    place === "khong" || place === "ben-bang-ten"
      ? 0
      : Math.max(0, cs2 - breathe);
  const treeTop =
    inner.y + bannerH + (opts.banner ? breathe : 0) + (place === "goc-tren" ? dodge : 0);
  const treeBottom =
    inner.y + inner.h - breathe - (place === "goc-duoi" ? dodge : 0);
  const tree: Rect = {
    x: columnLeft.x + colW + breathe,
    y: treeTop,
    w: inner.w - colW * 2 - breathe * 2,
    h: treeBottom - treeTop,
  };

  return {
    page: { x: 0, y: 0, w, h },
    border,
    inner,
    banner,
    columnLeft,
    columnRight,
    corners,
    creatures: {
      "ben-bang-ten": creatureSide,
      "goc-tren": cornerTop,
      "goc-duoi": cornerBottom,
    },
    tree,
    borderBand,
    scale,
  };
}
