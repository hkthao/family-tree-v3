/**
 * Ngày lịch dạng chuỗi "yyyy-mm-dd" (giống `<input type="date">`) — cắt/ghép chuỗi thuần,
 * KHÔNG qua `Date` để múi giờ không làm lùi ngày (xem formatDate.ts).
 */
export interface YMD {
  y: number;
  m: number;
  d: number;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

export function isValidYMD({ y, m, d }: YMD): boolean {
  return (
    y >= 1000 &&
    y <= 9999 &&
    m >= 1 &&
    m <= 12 &&
    d >= 1 &&
    d <= daysInMonth(y, m)
  );
}

export function parseIso(s: string | null | undefined): YMD | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((s ?? "").trim());
  if (!m) return null;
  const v = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  return isValidYMD(v) ? v : null;
}

const p2 = (n: number) => String(n).padStart(2, "0");

export function toIso({ y, m, d }: YMD): string {
  return `${String(y).padStart(4, "0")}-${p2(m)}-${p2(d)}`;
}

/** "yyyy-mm-dd" → "dd/mm/yyyy"; rỗng/sai → "". */
export function isoToVi(s: string | null | undefined): string {
  const v = parseIso(s);
  return v ? `${p2(v.d)}/${p2(v.m)}/${String(v.y).padStart(4, "0")}` : "";
}

/** Ô gõ tay: giữ tối đa 8 chữ số và tự chèn "/" → "dd", "dd/mm", "dd/mm/yyyy". */
export function maskViDate(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** "dd/mm/yyyy" đủ 8 chữ số và hợp lệ → "yyyy-mm-dd"; còn lại null. */
export function viToIso(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) return null;
  const v = { y: Number(m[3]), m: Number(m[2]), d: Number(m[1]) };
  return isValidYMD(v) ? toIso(v) : null;
}

export function todayIso(): string {
  const n = new Date();
  return toIso({ y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() });
}
