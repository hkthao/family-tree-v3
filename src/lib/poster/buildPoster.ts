import {
  bannerPrims,
  borderPrims,
  columnPrims,
  cornerPrims,
  paletteById,
  type BannerId,
  type BorderId,
  type ColumnId,
  type CornerId,
} from "@/lib/poster/ornaments";
import { posterRegions, POSTER_SIZES, type PosterSize } from "@/lib/poster/frame";
import { centeredLines, type Prim, type Rect } from "@/lib/poster/prims";
import { layoutPosterTree } from "@/lib/poster/treeLayout";
import type { FamilyForTree, PersonForTree } from "@/lib/queries/tree";

/**
 * Ghép tất cả lại thành MỘT danh sách nguyên thuỷ vẽ.
 *
 * Đây là bản gốc duy nhất của tấm bảng: xem trước trên màn hình và file
 * PDF gửi tiệm in đều đọc từ đây, nên không có chuyện xem một kiểu in ra
 * một kiểu.
 */

export interface PosterConfig {
  size: PosterSize;
  paletteId: string;
  border: BorderId;
  banner: BannerId;
  corner: CornerId;
  column: ColumnId;
  /** Tên dòng họ trên băng tên. */
  title: string;
  subtitle: string;
  coupletLeft: string;
  coupletRight: string;
  showYears: boolean;
  showSpouses: boolean;
  showGenerationLabels: boolean;
  /** Null = in cả dòng họ từ thuỷ tổ. */
  focalId: string | null;
  /** 0 = hết cây. */
  generations: number;
}

export const DEFAULT_POSTER_CONFIG: Omit<PosterConfig, "title"> = {
  size: "A1",
  paletteId: "son-vang",
  border: "hoi-van",
  banner: "cuon-thu",
  corner: "may",
  column: "cot-do",
  subtitle: "PHẢ ĐỒ DÒNG HỌ",
  coupletLeft: "Cây có gốc mới nở cành xanh ngọn",
  coupletRight: "Nước có nguồn mới bể rộng sông sâu",
  showYears: true,
  showSpouses: true,
  showGenerationLabels: true,
  focalId: null,
  generations: 0,
};

export interface PosterDoc {
  w: number;
  h: number;
  prims: Prim[];
  /** Cỡ chữ tên THẬT trên bản in (point) — để cảnh báo khi quá nhỏ. */
  namePt: number;
  peopleCount: number;
  rows: number;
  /** Điều đáng nói với người dùng trước khi mang đi in. */
  warnings: string[];
}

/** Dưới cỡ này thì in ra đọc phải soi — cảnh báo thay vì im lặng. */
const MIN_READABLE_PT = 4.5;

export function buildPoster(
  persons: PersonForTree[],
  families: FamilyForTree[],
  cfg: PosterConfig,
): PosterDoc {
  const pal = paletteById(cfg.paletteId);
  const { w, h } = POSTER_SIZES[cfg.size];
  const r = posterRegions(cfg.size, {
    columns: cfg.column !== "khong",
    banner: true,
  });
  const prims: Prim[] = [
    { k: "rect", x: 0, y: 0, w, h, fill: pal.paper },
  ];

  // ─── Hoa văn: từng phần một, vùng nào việc nấy ───────────────────
  prims.push(...borderPrims(cfg.border, r.border, r.borderBand, pal, r.scale));
  prims.push(
    ...cornerPrims(cfg.corner, r.corners.topLeft, pal, r.scale, false, false),
    ...cornerPrims(cfg.corner, r.corners.topRight, pal, r.scale, true, false),
    ...cornerPrims(cfg.corner, r.corners.bottomLeft, pal, r.scale, false, true),
    ...cornerPrims(cfg.corner, r.corners.bottomRight, pal, r.scale, true, true),
  );
  prims.push(
    ...columnPrims(cfg.column, r.columnLeft, pal, r.scale, cfg.coupletLeft),
    ...columnPrims(cfg.column, r.columnRight, pal, r.scale, cfg.coupletRight),
  );
  prims.push(
    ...bannerPrims(
      cfg.banner,
      r.banner,
      pal,
      r.scale,
      cfg.title.toUpperCase(),
      cfg.subtitle.trim() || null,
    ),
  );

  // ─── Cây ─────────────────────────────────────────────────────────
  const layout = layoutPosterTree(persons, families, {
    focalId: cfg.focalId,
    generations: cfg.generations,
    showSpouses: cfg.showSpouses,
    showYears: cfg.showYears,
  });

  // Nhãn "Đời n" ăn một rẻo bên trái; nếu không chừa thì nó đè lên ô
  // ngoài cùng của những hàng rộng nhất.
  const gutter = cfg.showGenerationLabels ? Math.round(r.tree.w * 0.045) : 0;
  const area: Rect = {
    x: r.tree.x + gutter,
    y: r.tree.y,
    w: r.tree.w - gutter,
    h: r.tree.h,
  };

  // Cỡ chữ do BỀ NGANG quyết định: co đều, không bao giờ bóp méo chữ —
  // chữ méo trên tấm in là lỗi không sửa được sau khi in.
  const fitW = area.w / layout.contentW;
  // Chặn trên: dòng họ mới có ba người thì đừng phóng ô to bằng cái ghế.
  const scale = Math.min(fitW, 46 / layout.nameSize, area.h / (layout.cardH * 1.6));
  const cardW = layout.cardW * scale;
  const cardH = layout.cardH * scale;

  // Còn chiều dọc thì RẢI ĐỀU các hàng cho kín tấm.
  //
  // Nếu co đều cả hai chiều thì cây (rất bẹt: rộng gấp mấy lần cao) chỉ
  // chiếm một dải mỏng giữa tấm, nửa dưới bỏ trống — trông như in lỗi.
  // Giãn KHOẢNG CÁCH giữa các hàng thì kín tấm mà chữ vẫn đúng tỉ lệ.
  const natural = cardH * 1.55;
  // Trần cho khoảng cách hàng: cây hai đời mà rải kín tấm thì một hàng
  // dính đỉnh, một hàng dính đáy, ở giữa là một nét nối dài ngoẵng —
  // trông như tấm in lỗi chứ không phải thoáng.
  const rowPitch =
    layout.rows > 1
      ? Math.min(
          Math.max(natural, (area.h - cardH) / (layout.rows - 1)),
          cardH * 5,
        )
      : 0;
  const drawH = cardH + rowPitch * (layout.rows - 1);
  const drawW = layout.contentW * scale;
  const ox = area.x + (area.w - drawW) / 2;
  const oy = area.y + Math.max(0, (area.h - drawH) / 2);
  const X = (v: number) => ox + v * scale;
  /** Tâm dọc của một hàng. */
  const rowY = (row: number) => oy + cardH / 2 + row * rowPitch;

  const namePt = layout.nameSize * scale;
  const yearPt = layout.yearSize * scale;
  const lineW = Math.max(0.4, 0.9 * r.scale);

  // Nét nối vẽ TRƯỚC ô để ô che đầu nét, không thấy nét chạy vào trong ô.
  for (const l of layout.links) {
    if (l.kind === "marriage") {
      const y = rowY(l.row);
      prims.push({
        k: "line",
        x1: X(l.x1),
        y1: y,
        x2: X(l.x2),
        y2: y,
        stroke: pal.primary,
        sw: lineW * 1.6,
      });
      continue;
    }
    // Nét con: gấp khúc vuông (xuống – ngang – xuống), đúng lối phả đồ
    // in truyền thống; nét chéo trông như sơ đồ kỹ thuật.
    const y1 = rowY(l.row) + cardH / 2;
    const y2 = rowY(l.toRow ?? l.row + 1) - cardH / 2;
    const midY = (y1 + y2) / 2;
    prims.push(
      { k: "line", x1: X(l.x1), y1, x2: X(l.x1), y2: midY, stroke: pal.accent, sw: lineW },
      { k: "line", x1: X(l.x1), y1: midY, x2: X(l.x2), y2: midY, stroke: pal.accent, sw: lineW },
      { k: "line", x1: X(l.x2), y1: midY, x2: X(l.x2), y2, stroke: pal.accent, sw: lineW },
    );
  }

  for (const c of layout.cards) {
    const box: Rect = {
      x: X(c.cx) - cardW / 2,
      y: rowY(c.row) - cardH / 2,
      w: cardW,
      h: cardH,
    };
    prims.push({
      k: "rect",
      ...box,
      fill: c.kind === "spouse" ? pal.cardFillSpouse : pal.cardFill,
      stroke: c.kind === "spouse" ? pal.accent : pal.primary,
      sw: lineW * (c.kind === "spouse" ? 1 : 1.5),
      rx: cardW * 0.06,
    });
    const textBox: Rect = {
      x: box.x,
      y: box.y + cardH * 0.06,
      w: box.w,
      h: cardH * (c.years ? 0.72 : 0.88),
    };
    prims.push(
      ...centeredLines(c.lines, textBox, namePt, namePt * 1.22, pal.ink, 600),
    );
    if (c.years) {
      prims.push({
        k: "text",
        x: box.x + box.w / 2,
        y: box.y + cardH - cardH * 0.12,
        s: c.years,
        size: yearPt,
        fill: pal.accent,
        anchor: "middle",
      });
    }
  }

  if (cfg.showGenerationLabels) {
    const size = Math.min(namePt * 1.25, cardH * 0.34, gutter * 0.42);
    for (let i = 0; i < layout.rows; i++) {
      prims.push({
        k: "text",
        x: r.tree.x + gutter * 0.5,
        y: rowY(i) + size * 0.35,
        s: `Đời ${i + 1}`,
        size,
        fill: pal.primary,
        anchor: "middle",
        weight: 600,
      });
    }
  }

  const warnings: string[] = [];
  if (namePt < MIN_READABLE_PT) {
    warnings.push(
      `Chữ tên chỉ còn ${namePt.toFixed(1)}pt — in ra sẽ phải soi mới đọc được. Chọn khổ lớn hơn, hoặc in theo nhánh (chọn người gốc + số đời).`,
    );
  }
  if (layout.omitted > 0) {
    warnings.push(
      `${layout.omitted} người không nối được vào nhánh nào nên không có trên tấm này — họ chưa được ghi cha/mẹ trong gia phả.`,
    );
  }
  if (!cfg.title.trim()) {
    warnings.push("Chưa có tên dòng họ trên băng tên.");
  }

  return {
    w,
    h,
    prims,
    namePt,
    peopleCount: layout.cards.length,
    rows: layout.rows,
    warnings,
  };
}
