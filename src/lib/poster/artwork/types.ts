/**
 * Tranh nhiều màu dùng trên bảng gia phả (cuốn thư, khung, linh vật vẽ tay).
 *
 * Khác `CreatureArt` ở chỗ GIỮ NGUYÊN MÀU của bản gốc. Với cuốn thư
 * truyền thống thì màu chính là nội dung — rồng vàng, nền đỏ son, hoa đào
 * hồng — đổi sang bảng màu của tấm là hỏng hình.
 */
export interface ArtworkShape {
  d: string;
  fill?: string;
  stroke?: string;
  sw?: number;
}

export interface PosterArtwork {
  id: string;
  label: string;
  /**
   * Ô để đặt chữ, tính theo TỈ LỆ của khung tranh (0–1).
   *
   * Cuốn thư nào cũng chừa sẵn một ô trống ở giữa cho tên dòng họ. Ghi
   * lại vị trí ô đó thì chữ tự rơi đúng chỗ dù tranh được phóng to nhỏ
   * cỡ nào.
   */
  textBox?: { x: number; y: number; w: number; h: number };
  viewBox: { x: number; y: number; w: number; h: number };
  shapes: ArtworkShape[];
}

interface PackedArtworkShape {
  d: string;
  f?: string;
  s?: string;
  w?: number;
}

/**
 * Dữ liệu đi qua JSON vì tranh có cả nghìn hình — viết thẳng thành mảng
 * TypeScript thì trình biên dịch bó tay ("union type too complex").
 */
export function expandArtwork(json: string): ArtworkShape[] {
  return (JSON.parse(json) as PackedArtworkShape[]).map((p) => ({
    d: p.d,
    fill: p.f,
    stroke: p.s,
    sw: p.w,
  }));
}
