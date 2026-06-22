// Tuổi thọ ("hưởng thọ") của người đã mất. Ưu tiên giá trị tự ghi
// (manual) vì các cụ đời trước thường chỉ truyền lại tuổi thọ, không
// đủ ngày sinh/mất để tính. Nếu không có thì suy ra từ năm sinh – năm
// mất khi có đủ cả hai.

/** Tính tuổi thọ (số) — manual nếu có, ngược lại từ năm sinh/mất. */
export function computeLifespanYears(
  manual: number | null | undefined,
  birthDate: string | null | undefined,
  deathDate: string | null | undefined,
): number | null {
  if (manual != null && manual >= 0) return manual;
  const by = birthDate?.slice(0, 4);
  const dy = deathDate?.slice(0, 4);
  if (by && dy && /^\d{4}$/.test(by) && /^\d{4}$/.test(dy)) {
    const n = Number(dy) - Number(by);
    if (n >= 0 && n <= 150) return n;
  }
  return null;
}

/** Chuỗi hiển thị "hưởng thọ X tuổi" — rỗng nếu không tính được. */
export function lifespanText(
  manual: number | null | undefined,
  birthDate: string | null | undefined,
  deathDate: string | null | undefined,
): string {
  const n = computeLifespanYears(manual, birthDate, deathDate);
  return n == null ? "" : `${n} tuổi`;
}
