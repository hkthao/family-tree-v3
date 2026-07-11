/**
 * Lịch vạn niên tối giản: NGÀY hoàng đạo/hắc đạo + GIỜ hoàng đạo.
 *
 * Thuật toán cổ truyền (tra bảng), KHÔNG bịa:
 *  - Ngày hoàng đạo: 12 sao (Thanh Long, Minh Đường… Câu Trận) khởi từ một chi
 *    tuỳ THÁNG ÂM, chạy theo chi NGÀY. 6 sao tốt (hoàng đạo) / 6 sao xấu (hắc đạo).
 *  - Giờ hoàng đạo: bảng 6 khung giờ tốt theo chi NGÀY.
 *
 * Chi ngày + tháng âm lấy từ src/lib/lunarDate.ts.
 */

import { getCanChiForSolarDate, solarStringToLunar } from "@/lib/lunarDate";

const CHI = [
  "Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ",
  "Ngọ", "Mùi", "Thân", "Dậu", "Tuất", "Hợi",
];

// 12 sao theo thứ tự, kèm tốt/xấu. Khởi đầu là Thanh Long.
const STARS: { name: string; good: boolean }[] = [
  { name: "Thanh Long", good: true },
  { name: "Minh Đường", good: true },
  { name: "Thiên Hình", good: false },
  { name: "Chu Tước", good: false },
  { name: "Kim Quỹ", good: true },
  { name: "Kim Đường", good: true },
  { name: "Bạch Hổ", good: false },
  { name: "Ngọc Đường", good: true },
  { name: "Thiên Lao", good: false },
  { name: "Nguyên Vũ", good: false },
  { name: "Tư Mệnh", good: true },
  { name: "Câu Trận", good: false },
];

/** Chi ngày → khung giờ hoàng đạo (chỉ số chi của các giờ tốt). Bảng cổ truyền:
 *  các ngày cùng cặp chi (Tý-Ngọ, Sửu-Mùi…) dùng chung khung giờ. */
const GOOD_HOUR_CHI: Record<number, number[]> = {
  0: [0, 1, 3, 6, 8, 9], // Tý  → Tý Sửu Mão Ngọ Thân Dậu
  6: [0, 1, 3, 6, 8, 9], // Ngọ
  1: [2, 3, 5, 8, 10, 11], // Sửu → Dần Mão Tỵ Thân Tuất Hợi
  7: [2, 3, 5, 8, 10, 11], // Mùi
  2: [0, 1, 4, 5, 7, 10], // Dần → Tý Sửu Thìn Tỵ Mùi Tuất
  8: [0, 1, 4, 5, 7, 10], // Thân
  3: [0, 2, 3, 6, 7, 9], // Mão → Tý Dần Mão Ngọ Mùi Dậu
  9: [0, 2, 3, 6, 7, 9], // Dậu
  4: [2, 4, 5, 8, 9, 11], // Thìn → Dần Thìn Tỵ Thân Dậu Hợi
  10: [2, 4, 5, 8, 9, 11], // Tuất
  5: [1, 4, 6, 7, 10, 11], // Tỵ  → Sửu Thìn Ngọ Mùi Tuất Hợi
  11: [1, 4, 6, 7, 10, 11], // Hợi
};

/** Khung giờ (giờ dương lịch) của mỗi chi — kèm "h" cho rõ là giờ. */
const CHI_HOURS = [
  "23h–1h", "1h–3h", "3h–5h", "5h–7h", "7h–9h", "9h–11h",
  "11h–13h", "13h–15h", "15h–17h", "17h–19h", "19h–21h", "21h–23h",
];

function chiIndexFromCanChi(canChiDay: string): number {
  // "Giáp Tý" → "Tý". Lấy từ cuối (Can 1 từ, Chi 1 từ).
  const parts = canChiDay.trim().split(/\s+/);
  const chi = parts[parts.length - 1];
  return CHI.indexOf(chi);
}

export interface DayAuspice {
  /** true = hoàng đạo (ngày tốt), false = hắc đạo (ngày xấu). */
  good: boolean;
  /** Tên sao trực ngày, vd "Thanh Long". */
  star: string;
  /** "Hoàng đạo" | "Hắc đạo". */
  label: string;
  /** Giờ hoàng đạo (khung giờ tốt), vd ["Tý (23–1)", …]. */
  goodHours: string[];
}

/** Tính ngày tốt/xấu + giờ hoàng đạo cho một ngày dương yyyy-mm-dd. */
export function dayAuspice(isoSolar: string): DayAuspice | null {
  const cc = getCanChiForSolarDate(isoSolar);
  const lunar = solarStringToLunar(isoSolar);
  if (!cc || !lunar) return null;
  const dayChi = chiIndexFromCanChi(cc.day);
  if (dayChi < 0) return null;

  // Sao khởi đầu (Thanh Long) theo tháng âm: ((month-1) % 6) * 2 (chỉ số chi).
  const startChi = (((lunar.month - 1) % 6) * 2) % 12;
  const starIdx = (dayChi - startChi + 12) % 12;
  const star = STARS[starIdx];

  const goodHours = (GOOD_HOUR_CHI[dayChi] ?? []).map(
    (ci) => `${CHI[ci]} (${CHI_HOURS[ci]})`,
  );

  return {
    good: star.good,
    star: star.name,
    label: star.good ? "Hoàng đạo" : "Hắc đạo",
    goodHours,
  };
}
