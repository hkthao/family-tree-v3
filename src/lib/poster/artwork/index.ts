import type { Prim, Rect } from "@/lib/poster/prims";
import type { PosterArtwork } from "@/lib/poster/artwork/types";

/**
 * Tranh trang trí nhiều màu, tải rời.
 *
 * Tải rời vì mỗi bức là hàng trăm KB dữ liệu đường nét, mà chỉ ai đang
 * dựng tấm in mới cần — gộp vào gói chính là bắt mọi người tải.
 */
export interface ArtworkOption {
  id: string;
  label: string;
  load: () => Promise<PosterArtwork>;
}

export const BANNER_ARTWORKS: ArtworkOption[] = [
  {
    id: "cuon-thu-co",
    label: "Cuốn thư cổ truyền (tranh)",
    load: () => import("./cuon-thu-co").then((m) => m.artwork),
  },
];

/**
 * Đặt tranh vào một ô, giữ nguyên tỉ lệ, canh giữa.
 *
 * Trả kèm ô đặt chữ đã quy đổi sang toạ độ thật của tấm, để người gọi
 * biết viết tên dòng họ vào đâu.
 */
export function artworkPrims(
  art: PosterArtwork,
  box: Rect,
): { prims: Prim[]; textBox: Rect } {
  const vb = art.viewBox;
  const s = Math.min(box.w / vb.w, box.h / vb.h);
  const drawW = vb.w * s;
  const drawH = vb.h * s;
  const tx = box.x + (box.w - drawW) / 2;
  const ty = box.y + (box.h - drawH) / 2;

  const tb = art.textBox ?? { x: 0.2, y: 0.25, w: 0.6, h: 0.4 };
  return {
    prims: [
      {
        k: "group",
        transform: `translate(${tx} ${ty}) scale(${s} ${s}) translate(${-vb.x} ${-vb.y})`,
        children: art.shapes.map((sh) => ({
          k: "path" as const,
          d: sh.d,
          // GIỮ NGUYÊN màu bản gốc: với cuốn thư truyền thống thì màu
          // chính là nội dung, đổi sang bảng màu của tấm là hỏng hình.
          fill: sh.fill,
          stroke: sh.stroke,
          sw: sh.sw,
        })),
      },
    ],
    textBox: {
      x: tx + tb.x * drawW,
      y: ty + tb.y * drawH,
      w: tb.w * drawW,
      h: tb.h * drawH,
    },
  };
}
