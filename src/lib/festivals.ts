import { solarStringToLunar, type LunarYMD } from "@/lib/lunarDate";

/**
 * Ngày lễ, tết và ngày rằm quan trọng của người Việt.
 *
 * Vì sao cần: lịch trong app đang chỉ có ngày tốt/xấu, can chi và giỗ
 * của dòng họ — mở ra ngày rằm tháng Bảy mà không thấy chữ "Vu Lan" nào
 * thì đúng thứ người ta cần nhớ nhất lại là thứ duy nhất không có.
 *
 * BA QUYẾT ĐỊNH:
 *
 * 1. **Bỏ qua tháng nhuận.** Năm có tháng Bảy nhuận thì Vu Lan vẫn là
 *    rằm tháng Bảy THƯỜNG, không phải cả hai. Ghi cả hai là mời người ta
 *    cúng nhầm ngày.
 * 2. **Ngày lễ dương lịch để riêng.** Quốc khánh 2/9 là ngày dương, tính
 *    theo âm là sai hẳn.
 * 3. **Tất niên tính theo NGÀY CUỐI tháng Chạp**, không viết cứng 30 —
 *    tháng Chạp thiếu thì năm đó là 29 Tết, và "30 Tết" không tồn tại.
 *    Đây là lỗi kinh điển của lịch âm làm ẩu.
 */

export type FestivalKind = "lunar" | "solar";

export interface Festival {
  key: string;
  name: string;
  /** Câu ngắn nói ngày đó làm gì — hiện dưới tên. */
  note: string;
  kind: FestivalKind;
  month: number;
  /** Ngày trong tháng; `"last"` = ngày cuối tháng (chỉ dùng cho Tất niên). */
  day: number | "last";
  /** Ngày nghỉ chính thức theo luật lao động. */
  publicHoliday?: boolean;
}

export const FESTIVALS: Festival[] = [
  // ─── Âm lịch ───────────────────────────────────────────────────
  {
    key: "giao-thua",
    name: "Tất niên · Giao thừa",
    note: "Cúng tất niên, đón giao thừa.",
    kind: "lunar",
    month: 12,
    day: "last",
    publicHoliday: true,
  },
  {
    key: "tet-mung-1",
    name: "Mùng 1 Tết",
    note: "Tết Nguyên Đán — cúng gia tiên, mừng tuổi.",
    kind: "lunar",
    month: 1,
    day: 1,
    publicHoliday: true,
  },
  {
    key: "tet-mung-2",
    name: "Mùng 2 Tết",
    note: "Tết Nguyên Đán.",
    kind: "lunar",
    month: 1,
    day: 2,
    publicHoliday: true,
  },
  {
    key: "tet-mung-3",
    name: "Mùng 3 Tết",
    note: "Tết Nguyên Đán — hoá vàng, tiễn ông bà.",
    kind: "lunar",
    month: 1,
    day: 3,
    publicHoliday: true,
  },
  {
    key: "nguyen-tieu",
    name: "Rằm tháng Giêng · Tết Nguyên Tiêu",
    note: "“Cúng quanh năm không bằng rằm tháng Giêng.”",
    kind: "lunar",
    month: 1,
    day: 15,
  },
  {
    key: "han-thuc",
    name: "Tết Hàn thực",
    note: "Bánh trôi bánh chay, nhớ về tổ tiên.",
    kind: "lunar",
    month: 3,
    day: 3,
  },
  {
    key: "gio-to-hung-vuong",
    name: "Giỗ Tổ Hùng Vương",
    note: "“Dù ai đi ngược về xuôi…” — ngày nghỉ lễ.",
    kind: "lunar",
    month: 3,
    day: 10,
    publicHoliday: true,
  },
  {
    key: "phat-dan",
    name: "Lễ Phật Đản",
    note: "Rằm tháng Tư — ngày Đức Phật đản sinh.",
    kind: "lunar",
    month: 4,
    day: 15,
  },
  {
    key: "doan-ngo",
    name: "Tết Đoan Ngọ",
    note: "Mùng 5 tháng Năm — giết sâu bọ.",
    kind: "lunar",
    month: 5,
    day: 5,
  },
  {
    key: "vu-lan",
    name: "Vu Lan · Rằm tháng Bảy",
    note: "Báo hiếu cha mẹ, xá tội vong nhân.",
    kind: "lunar",
    month: 7,
    day: 15,
  },
  {
    key: "trung-thu",
    name: "Tết Trung Thu",
    note: "Rằm tháng Tám — Tết đoàn viên, phá cỗ trông trăng.",
    kind: "lunar",
    month: 8,
    day: 15,
  },
  {
    key: "trung-cuu",
    name: "Tết Trùng Cửu",
    note: "Mùng 9 tháng Chín — lên cao, mừng thọ người già.",
    kind: "lunar",
    month: 9,
    day: 9,
  },
  {
    key: "trung-thap",
    name: "Tết Trùng Thập · Tết cơm mới",
    note: "Mùng 10 tháng Mười — mừng mùa màng.",
    kind: "lunar",
    month: 10,
    day: 10,
  },
  {
    key: "ong-cong-ong-tao",
    name: "Ông Công Ông Táo",
    note: "23 tháng Chạp — tiễn Táo quân về trời.",
    kind: "lunar",
    month: 12,
    day: 23,
  },

  // ─── Dương lịch ────────────────────────────────────────────────
  {
    key: "tet-duong-lich",
    name: "Tết Dương lịch",
    note: "Ngày nghỉ lễ.",
    kind: "solar",
    month: 1,
    day: 1,
    publicHoliday: true,
  },
  {
    key: "giai-phong",
    name: "Ngày Giải phóng miền Nam",
    note: "30/4 — ngày nghỉ lễ.",
    kind: "solar",
    month: 4,
    day: 30,
    publicHoliday: true,
  },
  {
    key: "quoc-te-lao-dong",
    name: "Quốc tế Lao động",
    note: "1/5 — ngày nghỉ lễ.",
    kind: "solar",
    month: 5,
    day: 1,
    publicHoliday: true,
  },
  {
    key: "quoc-khanh",
    name: "Quốc khánh",
    note: "2/9 — ngày nghỉ lễ.",
    kind: "solar",
    month: 9,
    day: 2,
    publicHoliday: true,
  },
];

/**
 * Ngày âm này có phải ngày cuối tháng không.
 *
 * Không có bảng "tháng đủ / tháng thiếu" nên hỏi ngược: ngày mai (dương)
 * rơi vào tháng âm khác thì hôm nay là ngày cuối tháng âm. Cách này đúng
 * cho cả tháng 29 lẫn 30 ngày, không cần biết trước.
 */
function isLastLunarDay(solarIso: string, lunar: LunarYMD): boolean {
  const next = new Date(`${solarIso}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const nextIso = next.toISOString().slice(0, 10);
  const nextLunar = solarStringToLunar(nextIso);
  return !!nextLunar && nextLunar.month !== lunar.month;
}

/**
 * Ngày lễ rơi vào ngày dương này.
 *
 * Trả mảng vì một ngày có thể trùng hai lễ (vd Quốc khánh dương lịch rơi
 * đúng một ngày rằm).
 */
export function festivalsOn(solarIso: string): Festival[] {
  const lunar = solarStringToLunar(solarIso);
  const [, sm, sd] = solarIso.split("-").map(Number);

  return FESTIVALS.filter((f) => {
    if (f.kind === "solar") return f.month === sm && f.day === sd;
    if (!lunar) return false;
    // Tháng nhuận KHÔNG có lễ: Vu Lan là rằm tháng Bảy thường.
    if (lunar.isLeap) return false;
    if (f.month !== lunar.month) return false;
    return f.day === "last"
      ? isLastLunarDay(solarIso, lunar)
      : f.day === lunar.day;
  });
}

/** Có lễ nào trong ngày không — dùng để chấm dấu trên lịch, rẻ hơn lấy cả mảng. */
export const hasFestival = (solarIso: string): boolean =>
  festivalsOn(solarIso).length > 0;
