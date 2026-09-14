/**
 * Hình linh vật (rồng, phượng) rút từ file SVG thành đường nét thuần.
 *
 * Giữ nguyên hệ toạ độ gốc của file; nơi dùng sẽ bọc một phép biến hình
 * để đặt vào đúng ô trên tấm. Không đụng vào dữ liệu đường nét: mỗi lần
 * tính lại toạ độ là một lần có cơ hội làm méo hình, mà hình méo thì chỉ
 * nhận ra khi đã in.
 */
/**
 * dark = nét chính (tô màu chủ đạo của tấm), light = mảng khoét hoặc nét
 * chi tiết (tô màu giấy).
 *
 * Phải giữ cả phần TÔ lẫn phần NÉT: có hình vẽ chi tiết bằng nét trắng
 * đè lên thân đen — bỏ phần nét đi thì cả con rồng thành một vệt đặc.
 */
export type CreatureTone = "dark" | "light";

export interface CreatureShape {
  d: string;
  fill?: CreatureTone;
  stroke?: CreatureTone;
  /** Bề dày nét theo hệ toạ độ gốc của hình. */
  sw?: number;
  rule?: "evenodd";
  /** Chuỗi transform thừa hưởng từ các nhóm bao ngoài trong file gốc. */
  transform?: string;
}

export interface CreatureArt {
  id: string;
  label: string;
  viewBox: { x: number; y: number; w: number; h: number };
  shapes: CreatureShape[];
}

/**
 * Dữ liệu nén của file sinh tự động: khoá một chữ cái, tone là 0/1.
 *
 * Không phải thích ngắn: hình rồng Á Đông có 3.632 nét, viết đầy đủ tên
 * khoá thì file phình lên gấp rưỡi, và TypeScript không kiểm nổi một
 * literal cỡ đó ("union type too complex") nên phải đi qua JSON.
 */
interface PackedShape {
  d: string;
  f?: 0 | 1;
  s?: 0 | 1;
  w?: number;
  e?: 1;
  t?: string;
}

const tone = (v: 0 | 1 | undefined): CreatureTone | undefined =>
  v === undefined ? undefined : v === 1 ? "light" : "dark";

export function expandShapes(json: string): CreatureShape[] {
  return (JSON.parse(json) as PackedShape[]).map((p) => ({
    d: p.d,
    fill: tone(p.f),
    stroke: tone(p.s),
    sw: p.w,
    rule: p.e ? ("evenodd" as const) : undefined,
    transform: p.t,
  }));
}
