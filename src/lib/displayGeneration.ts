/**
 * Hiển thị "Đời N" trừ đi offset của clan.
 *
 * DB lưu generation thực (1-based, Thủy tổ = 1, con = 2, cháu = 3…).
 * Một số clan muốn "Thủy tổ là Đời 0" — họ bật generation_offset = 1
 * và mọi chỗ render trên UI sẽ trừ 1 trước khi in.
 *
 * Sort + filter ở DB vẫn dùng generation thực — offset chỉ là format
 * hiển thị, không phá ordering hay query nào.
 */
export function displayGen(
  gen: number | null,
  offset = 0,
): number | null {
  if (gen === null || gen === undefined) return null;
  return gen - offset;
}

/**
 * Trả về string "Đời N" hoặc "" nếu generation null. Dùng cho mọi
 * subtitle / badge / list item — không phải nhân tách điều kiện ở
 * từng chỗ.
 */
export function displayGenLabel(
  gen: number | null,
  offset = 0,
): string {
  const d = displayGen(gen, offset);
  return d === null ? "" : `Đời ${d}`;
}
