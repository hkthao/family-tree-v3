// Tuổi thọ của người đã mất. Ưu tiên giá trị tự ghi (manual) vì các cụ
// đời trước thường chỉ truyền lại tuổi thọ, không đủ ngày sinh/mất để
// tính. Nếu không có thì suy ra từ năm sinh – năm mất khi có đủ cả hai.
//
// Phong tục xưng hô: người mất từ 60 tuổi trở lên gọi là "hưởng thọ"
// (thọ); dưới 60 tuổi gọi là "hưởng dương".

export const THO_MIN_AGE = 60;

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

/** Nhãn theo phong tục: "Hưởng thọ" (≥60) hoặc "Hưởng dương" (<60). */
export function lifespanLabel(years: number): string {
  return years >= THO_MIN_AGE ? "Hưởng thọ" : "Hưởng dương";
}

/**
 * Cụm chữ gọn dùng trên thẻ/cây: "Thọ 82 tuổi" hoặc
 * "Hưởng dương 45 tuổi". Trả "" nếu không tính được tuổi thọ.
 */
export function lifespanPhrase(
  manual: number | null | undefined,
  birthDate: string | null | undefined,
  deathDate: string | null | undefined,
): string {
  const n = computeLifespanYears(manual, birthDate, deathDate);
  if (n == null) return "";
  const word = n >= THO_MIN_AGE ? "Thọ" : "Hưởng dương";
  return `${word} ${n} tuổi`;
}
