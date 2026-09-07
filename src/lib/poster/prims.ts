/**
 * Nguyên thuỷ vẽ (primitive) cho bảng gia phả in khổ lớn.
 *
 * Vì sao có tầng này thay vì vẽ thẳng: cùng một tấm phải hiện ra ở HAI
 * nơi — xem trước trên màn hình (SVG) và file PDF mang ra tiệm in
 * (@react-pdf). Nếu mỗi nơi vẽ một lần thì bản xem trước và bản in sẽ
 * lệch nhau, mà lệch kiểu này chỉ phát hiện được sau khi đã in xong và
 * trả tiền. Ở đây bố cục tính MỘT LẦN ra danh sách nguyên thuỷ, hai nơi
 * chỉ việc dịch sang cú pháp của mình.
 *
 * Toạ độ tính bằng point (1/72 inch) — cùng đơn vị @react-pdf dùng, nên
 * không có bước đổi đơn vị nào để mà sai.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Prim =
  | {
      k: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      fill?: string;
      stroke?: string;
      sw?: number;
      rx?: number;
    }
  | {
      k: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      stroke: string;
      sw: number;
    }
  | { k: "path"; d: string; fill?: string; stroke?: string; sw?: number }
  | {
      k: "circle";
      cx: number;
      cy: number;
      r: number;
      fill?: string;
      stroke?: string;
      sw?: number;
    }
  | {
      k: "text";
      x: number;
      y: number;
      s: string;
      size: number;
      fill: string;
      /** Mặc định "middle" — chữ trên bảng gia phả gần như luôn căn giữa. */
      anchor?: "start" | "middle" | "end";
      weight?: 400 | 600;
    };

/** Khung con nằm trong khung cha, thu vào mỗi bề `pad`. */
export function inset(r: Rect, pad: number): Rect {
  return { x: r.x + pad, y: r.y + pad, w: r.w - pad * 2, h: r.h - pad * 2 };
}

/**
 * Xếp các dòng chữ vào giữa một khung theo chiều dọc.
 *
 * Dùng cho tên người trong ô (mỗi âm tiết một dòng, kiểu viết dọc của
 * bảng gia phả truyền thống) và cho chữ trên băng tên.
 */
export function centeredLines(
  lines: string[],
  box: Rect,
  fontSize: number,
  lineHeight: number,
  fill: string,
  weight: 400 | 600 = 400,
): Prim[] {
  const total = lines.length * lineHeight;
  const top = box.y + (box.h - total) / 2;
  return lines.map((s, i) => ({
    k: "text" as const,
    x: box.x + box.w / 2,
    // +fontSize*0.78: baseline nằm dưới đỉnh dòng, không phải giữa dòng.
    y: top + i * lineHeight + fontSize * 0.78,
    s,
    size: fontSize,
    fill,
    anchor: "middle" as const,
    weight,
  }));
}

/** Tách tên thành các âm tiết — mỗi âm tiết một dòng khi viết dọc. */
export function nameSyllables(name: string): string[] {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts : ["?"];
}
