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

// 12 sao theo thứ tự, kèm tốt/xấu + nghĩa ngắn (để giải thích "vì sao").
// Khởi đầu là Thanh Long.
const STARS: { name: string; good: boolean; desc: string }[] = [
  { name: "Thanh Long", good: true, desc: "sao cát, vạn sự hanh thông" },
  { name: "Minh Đường", good: true, desc: "sáng sủa, tốt cho công danh, gặp gỡ" },
  { name: "Thiên Hình", good: false, desc: "dễ hình thương, kiện tụng" },
  { name: "Chu Tước", good: false, desc: "dễ thị phi, cãi vã" },
  { name: "Kim Quỹ", good: true, desc: "cát tinh, tốt cho tài lộc, cưới hỏi" },
  { name: "Kim Đường", good: true, desc: "tốt cho mọi việc" },
  { name: "Bạch Hổ", good: false, desc: "hung tinh, nên tránh việc lớn" },
  { name: "Ngọc Đường", good: true, desc: "cát tinh, hợp khai trương, nhập trạch" },
  { name: "Thiên Lao", good: false, desc: "giam hãm, trì trệ" },
  { name: "Nguyên Vũ", good: false, desc: "dễ mất mát, thị phi" },
  { name: "Tư Mệnh", good: true, desc: "cát tinh, hợp cầu phúc, tế tự" },
  { name: "Câu Trận", good: false, desc: "trì trệ, vướng mắc" },
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
  /** Nghĩa ngắn của sao, vd "sao cát, vạn sự hanh thông". */
  starDesc: string;
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
    starDesc: star.desc,
    label: star.good ? "Hoàng đạo" : "Hắc đạo",
    goodHours,
  };
}

// ════════════════════════════════════════════════════════════════
// 12 TRỰC (Kiến – Trừ) → việc NÊN / KIÊNG
//
// "Thập nhị trực" là 12 sao trực ngày cổ truyền, cơ sở để biết mỗi
// ngày hợp/kỵ việc gì (cưới hỏi, động thổ, an táng…). Quy tắc tra
// bảng (KHÔNG bịa): tháng Giêng ngày Dần là trực Kiến, rồi 12 trực
// chạy tuần tự theo chi NGÀY. Đây là quy tắc theo THÁNG ÂM phổ biến
// trong lịch vạn niên in ấn (bản đơn giản, không tách theo tiết khí).
// ════════════════════════════════════════════════════════════════

export type ActivityKey =
  | "cuoi-hoi"
  | "nhap-trach"
  | "dong-tho"
  | "khai-truong"
  | "xuat-hanh"
  | "an-tang"
  | "cung-le"
  | "ky-ket";

/** Các loại việc lớn thường xem ngày — kèm nhãn + emoji cho UI. */
export const ACTIVITIES: {
  key: ActivityKey;
  label: string;
  emoji: string;
}[] = [
  { key: "cuoi-hoi", label: "Cưới hỏi", emoji: "💍" },
  { key: "nhap-trach", label: "Về nhà mới", emoji: "🏠" },
  { key: "dong-tho", label: "Xây dựng, động thổ", emoji: "🧱" },
  { key: "khai-truong", label: "Khai trương, mở hàng", emoji: "🎋" },
  { key: "xuat-hanh", label: "Xuất hành, đi xa", emoji: "🧭" },
  { key: "an-tang", label: "An táng, cải táng", emoji: "⚱️" },
  { key: "cung-le", label: "Cúng lễ, cầu phúc", emoji: "🙏" },
  { key: "ky-ket", label: "Ký kết, giao dịch", emoji: "🤝" },
];

const ACTIVITY_LABEL: Record<ActivityKey, string> = Object.fromEntries(
  ACTIVITIES.map((a) => [a.key, a.label]),
) as Record<ActivityKey, string>;

interface Truc {
  name: string;
  /** Nghĩa ngắn gọn, dễ hiểu cho người lớn tuổi. */
  summary: string;
  /** Ngày tốt chung (khi KHÔNG chọn việc cụ thể). */
  generallyGood: boolean;
  good: ActivityKey[];
  avoid: ActivityKey[];
}

// 12 trực theo đúng thứ tự cố định. Bảng nên/kiêng theo lịch cổ truyền.
const TRUC: Truc[] = [
  {
    name: "Kiến",
    summary: "Ngày khởi đầu, vững vàng",
    generallyGood: true,
    good: ["xuat-hanh", "cung-le"],
    avoid: ["dong-tho", "an-tang"],
  },
  {
    name: "Trừ",
    summary: "Trừ bỏ cái cũ, tống tiễn xui rủi",
    generallyGood: true,
    good: ["cung-le"],
    avoid: ["cuoi-hoi", "xuat-hanh", "khai-truong"],
  },
  {
    name: "Mãn",
    summary: "Đầy đủ, viên mãn",
    generallyGood: true,
    good: ["khai-truong", "ky-ket", "cung-le"],
    avoid: ["an-tang"],
  },
  {
    name: "Bình",
    summary: "Bằng phẳng, êm xuôi",
    generallyGood: true,
    good: ["dong-tho"],
    avoid: [],
  },
  {
    name: "Định",
    summary: "Ổn định, an bài",
    generallyGood: true,
    good: ["cuoi-hoi", "nhap-trach", "khai-truong", "ky-ket"],
    avoid: ["xuat-hanh"],
  },
  {
    name: "Chấp",
    summary: "Nắm giữ, tạo tác",
    generallyGood: true,
    good: ["dong-tho", "cuoi-hoi"],
    avoid: ["xuat-hanh", "nhap-trach"],
  },
  {
    name: "Phá",
    summary: "Đổ vỡ, hao tán — tránh việc lớn",
    generallyGood: false,
    good: [],
    avoid: [
      "cuoi-hoi",
      "khai-truong",
      "ky-ket",
      "nhap-trach",
      "dong-tho",
      "xuat-hanh",
    ],
  },
  {
    name: "Nguy",
    summary: "Nguy hiểm, chông chênh",
    generallyGood: false,
    good: ["cung-le"],
    avoid: ["xuat-hanh", "cuoi-hoi", "khai-truong"],
  },
  {
    name: "Thành",
    summary: "Thành công, vạn sự hanh thông",
    generallyGood: true,
    good: [
      "cuoi-hoi",
      "nhap-trach",
      "khai-truong",
      "dong-tho",
      "ky-ket",
      "xuat-hanh",
      "cung-le",
    ],
    avoid: [],
  },
  {
    name: "Thu",
    summary: "Thu vào, cầu tài lộc",
    generallyGood: true,
    good: ["khai-truong", "ky-ket"],
    avoid: ["an-tang", "xuat-hanh"],
  },
  {
    name: "Khai",
    summary: "Mở mang, hanh thông",
    generallyGood: true,
    good: [
      "khai-truong",
      "cuoi-hoi",
      "nhap-trach",
      "dong-tho",
      "cung-le",
      "xuat-hanh",
    ],
    avoid: ["an-tang"],
  },
  {
    name: "Bế",
    summary: "Đóng lại, bế tắc — tránh khởi sự",
    generallyGood: false,
    good: ["an-tang"],
    avoid: ["khai-truong", "xuat-hanh", "cuoi-hoi", "dong-tho"],
  },
];

/** Trực của một ngày, từ chi NGÀY + tháng ÂM. */
function trucForDay(dayChi: number, lunarMonth: number): Truc {
  // Tháng Giêng (1) "kiến" Dần (chi 2); tháng m kiến chi (m+1)%12.
  const kienChi = (lunarMonth + 1) % 12;
  const idx = (((dayChi - kienChi) % 12) + 12) % 12;
  return TRUC[idx];
}

export type DayLevel = "good" | "normal" | "bad";

/** Bản mô tả đầy đủ một ngày để hiển thị + lọc "ngày đẹp". */
export interface DayInfo {
  iso: string;
  /** Thứ trong tuần, 0 = Chủ nhật … 6 = Thứ Bảy. */
  weekday: number;
  solar: { day: number; month: number; year: number };
  lunar: { day: number; month: number; leap: boolean };
  canChi: { day: string; month: string; year: string };
  aus: DayAuspice;
  truc: { name: string; summary: string };
  /** Câu giải thích "vì sao" ngày này tốt/xấu, cho người đọc hiểu. */
  reason: string;
  /** Đánh giá ngày cho việc đã chọn (hoặc chung nếu không chọn). */
  level: DayLevel;
  /** Nhãn các việc NÊN làm hôm đó (theo trực). */
  nen: string[];
  /** Nhãn các việc NÊN TRÁNH hôm đó (theo trực). */
  kieng: string[];
}

/** Xếp hạng ngày cho một việc cụ thể (hoặc chung nếu activity trống). */
function levelFor(
  ausGood: boolean,
  truc: Truc,
  activity?: ActivityKey,
): DayLevel {
  if (!activity) {
    // Không chọn việc: ngày tốt chung = hoàng đạo + trực tốt chung.
    if (ausGood && truc.generallyGood) return "good";
    if (!ausGood && !truc.generallyGood) return "bad";
    return "normal";
  }
  let score = ausGood ? 1 : -1;
  if (truc.good.includes(activity)) score += 2;
  if (truc.avoid.includes(activity)) score -= 3;
  if (score >= 2) return "good";
  if (score <= -1) return "bad";
  return "normal";
}

function parseIsoUtc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function isoFromUtc(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Mô tả đầy đủ một ngày dương (yyyy-mm-dd): âm lịch, can chi, hoàng
 * đạo, trực, việc nên/kiêng và xếp hạng cho việc `activity` (nếu có).
 */
export function describeDay(
  iso: string,
  activity?: ActivityKey,
): DayInfo | null {
  const cc = getCanChiForSolarDate(iso);
  const lunar = solarStringToLunar(iso);
  const aus = dayAuspice(iso);
  if (!cc || !lunar || !aus) return null;

  const dayChi = chiIndexFromCanChi(cc.day);
  if (dayChi < 0) return null;
  const truc = trucForDay(dayChi, lunar.month);
  const level = levelFor(aus.good, truc, activity);

  const [y, m, d] = iso.split("-").map(Number);
  return {
    iso,
    weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay(),
    solar: { day: d, month: m, year: y },
    lunar: { day: lunar.day, month: lunar.month, leap: !!lunar.isLeap },
    canChi: { day: cc.day, month: cc.month, year: cc.year },
    aus,
    truc: { name: truc.name, summary: truc.summary },
    reason: buildReason(aus, truc, activity, level),
    level,
    nen: truc.good.map((k) => ACTIVITY_LABEL[k]),
    kieng: truc.avoid.map((k) => ACTIVITY_LABEL[k]),
  };
}

/** Ghép câu giải thích vì sao ngày này tốt/xấu — 2 vế: sao hoàng đạo + trực. */
function buildReason(
  aus: DayAuspice,
  truc: Truc,
  activity: ActivityKey | undefined,
  level: DayLevel,
): string {
  const starPart = aus.good
    ? `Là ngày Hoàng đạo (sao ${aus.star} — ${aus.starDesc}), được coi là ngày lành.`
    : `Là ngày Hắc đạo (sao ${aus.star} — ${aus.starDesc}), nên hạn chế việc trọng đại.`;
  const trucPart = ` Ngày thuộc trực ${truc.name}: ${truc.summary.toLowerCase()}.`;

  // Nếu đang xét một việc cụ thể, nói rõ việc đó hợp/kỵ ra sao.
  let actPart = "";
  if (activity) {
    const label = ACTIVITY_LABEL[activity].toLowerCase();
    if (truc.avoid.includes(activity)) {
      actPart = ` Riêng việc ${label}: trực ${truc.name} kỵ, nên tránh.`;
    } else if (truc.good.includes(activity)) {
      actPart =
        level === "good"
          ? ` Riêng việc ${label}: trực ${truc.name} rất hợp.`
          : ` Việc ${label} hợp với trực ${truc.name}, nhưng vướng ngày hắc đạo nên chỉ ở mức tạm được.`;
    } else {
      actPart = ` Việc ${label} không được lịch nhấn mạnh trong ngày này.`;
    }
  }
  return starPart + trucPart + actPart;
}

/**
 * Quét khoảng [startIso, endIso] (bao gồm 2 đầu) và trả về các ngày
 * ĐẸP (level "good") cho việc `activity` (hoặc ngày tốt chung nếu
 * không truyền). Giới hạn an toàn 400 ngày để không quét vô hạn.
 */
export function findGoodDays(
  startIso: string,
  endIso: string,
  activity?: ActivityKey,
): DayInfo[] {
  const start = parseIsoUtc(startIso);
  const end = parseIsoUtc(endIso);
  const out: DayInfo[] = [];
  if (isNaN(start) || isNaN(end) || end < start) return out;
  const maxT = Math.min(end, start + 400 * 86_400_000);
  for (let t = start; t <= maxT; t += 86_400_000) {
    const info = describeDay(isoFromUtc(t), activity);
    if (info && info.level === "good") out.push(info);
  }
  return out;
}
