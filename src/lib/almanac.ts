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
  /** Nhị thập bát tú (28 sao) trực ngày. */
  tu: TuInfo;
  /** Tiết khí (24 tiết), vd "Lập xuân". */
  tietKhi: string;
  /** Ngày kiêng dân gian (Tam Nương, Nguyệt Kỵ) — rỗng nếu không có. */
  warnings: FolkWarning[];
  /** Câu giải thích "vì sao" ngày này tốt/xấu, đầy đủ (dùng ở thẻ 1 ngày). */
  reason: string;
  /** Lý do NGẮN 1 dòng (dùng trong danh sách nhiều ngày). */
  shortReason: string;
  /** Đánh giá ngày cho việc đã chọn (hoặc chung nếu không chọn). */
  level: DayLevel;
  /** Nhãn các việc NÊN làm hôm đó (theo trực). */
  nen: string[];
  /** Nhãn các việc NÊN TRÁNH hôm đó (theo trực). */
  kieng: string[];
}

/**
 * Xếp hạng ngày cho một việc cụ thể (hoặc chung nếu activity trống).
 * `folkBlocked` = ngày kiêng dân gian (Tam Nương/Nguyệt Kỵ) → không bao giờ
 * xếp "good" (hạ xuống "normal") để danh sách "ngày đẹp" khỏi lọt ngày kiêng.
 */
function levelFor(
  ausGood: boolean,
  truc: Truc,
  activity: ActivityKey | undefined,
  folkBlocked: boolean,
): DayLevel {
  let base: DayLevel;
  if (!activity) {
    // Không chọn việc: ngày tốt chung = hoàng đạo + trực tốt chung.
    if (ausGood && truc.generallyGood) base = "good";
    else if (!ausGood && !truc.generallyGood) base = "bad";
    else base = "normal";
  } else {
    let score = ausGood ? 1 : -1;
    if (truc.good.includes(activity)) score += 2;
    if (truc.avoid.includes(activity)) score -= 3;
    base = score >= 2 ? "good" : score <= -1 ? "bad" : "normal";
  }
  if (folkBlocked && base === "good") return "normal";
  return base;
}

function parseIsoUtc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function isoFromUtc(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

// ════════════════════════════════════════════════════════════════
// NHỊ THẬP BÁT TÚ (28 sao) + NGÀY KIÊNG DÂN GIAN (Tam Nương, Nguyệt Kỵ)
//
// Nguồn: Wikipedia tiếng Việt + lichngaytot/xemlicham. 28 tú là chu kỳ 28
// NGÀY LIÊN TỤC (không theo thứ tuần): index = (JDN + 11) % 28, đã đối chiếu
// 27/03/2026 = Quỷ (khớp 3 mốc). Trương=cát, Dực=hung theo đa số nguồn.
// ════════════════════════════════════════════════════════════════

export interface TuInfo {
  /** Tên đầy đủ, vd "Quỷ Kim Dương". */
  name: string;
  /** Tên gọi tắt, vd "Quỷ". */
  short: string;
  /** true = cát tú (tốt); false = hung/bình tú. */
  good: boolean;
  /** Tóm tắt việc nên/kỵ. */
  note: string;
}

const NHI_THAP_BAT_TU: TuInfo[] = [
  { short: "Giác", name: "Giác Mộc Giao", good: true, note: "Tốt cưới hỏi, khai trương, thi cử. Kỵ mai táng." },
  { short: "Cang", name: "Cang Kim Long", good: false, note: "Kỵ cưới gả, chôn cất, dựng nhà, kiện tụng." },
  { short: "Đê", name: "Đê Thổ Lạc", good: false, note: "Kỵ động thổ, kinh doanh, xuất hành, cưới hỏi." },
  { short: "Phòng", name: "Phòng Nhật Thố", good: true, note: "Tốt mọi việc: cưới xin, xây cất, khai trương, an táng." },
  { short: "Tâm", name: "Tâm Nguyệt Hồ", good: false, note: "Kỵ mọi việc, nhất là cưới hỏi, tang lễ, kiện tụng." },
  { short: "Vĩ", name: "Vĩ Hỏa Hổ", good: true, note: "Tốt cưới gả, xuất hành, kinh doanh, xây dựng." },
  { short: "Cơ", name: "Cơ Thủy Báo", good: true, note: "Tốt khai trương, cầu tài, xây cất." },
  { short: "Đẩu", name: "Đẩu Mộc Giải", good: true, note: "Tốt mọi việc: cưới hỏi, xây dựng, khai trương." },
  { short: "Ngưu", name: "Ngưu Kim Ngưu", good: false, note: "Kỵ cưới gả, làm việc lớn; dễ hao tài." },
  { short: "Nữ", name: "Nữ Thổ Bức", good: false, note: "Kỵ cưới hỏi, sinh nở; dễ bị lừa gạt." },
  { short: "Hư", name: "Hư Nhật Thử", good: false, note: "Kỵ cưới hỏi, làm việc lớn." },
  { short: "Nguy", name: "Nguy Nguyệt Yến", good: false, note: "Kỵ mọi việc; dễ hao tài, thua lỗ." },
  { short: "Thất", name: "Thất Hỏa Trư", good: true, note: "Tốt xây dựng, cưới hỏi, khai trương, cầu công danh." },
  { short: "Bích", name: "Bích Thủy Du", good: true, note: "Tốt mai táng, cưới hỏi, kinh doanh, xây cất." },
  { short: "Khuê", name: "Khuê Mộc Lang", good: false, note: "Nửa tốt nửa xấu: tốt xuất hành, nhập học; kỵ xây dựng." },
  { short: "Lâu", name: "Lâu Kim Cẩu", good: true, note: "Tốt cưới hỏi, xây dựng, khai trương, thăng chức." },
  { short: "Vị", name: "Vị Thổ Trĩ", good: true, note: "Tốt xây dựng, cưới hỏi, an táng, khai trương." },
  { short: "Mão", name: "Mão Nhật Kê", good: false, note: "Kỵ xây dựng, an táng; bất lợi công danh." },
  { short: "Tất", name: "Tất Nguyệt Ô", good: true, note: "Tốt xây dựng, cưới hỏi, sinh nở, khai trương." },
  { short: "Chủy", name: "Chủy Hỏa Hầu", good: false, note: "Kỵ mọi việc; dễ kiện tụng." },
  { short: "Sâm", name: "Sâm Thủy Viên", good: true, note: "Tốt kinh doanh, cưới hỏi, xây dựng, cầu tài." },
  { short: "Tỉnh", name: "Tỉnh Mộc Hãn", good: true, note: "Tốt xây dựng, thi cử, khai trương. Kỵ an táng." },
  { short: "Quỷ", name: "Quỷ Kim Dương", good: false, note: "Kỵ xây dựng, cưới gả; riêng mai táng lại tốt." },
  { short: "Liễu", name: "Liễu Thổ Chương", good: false, note: "Kỵ khởi công, an táng, cưới hỏi; dễ hao tài." },
  { short: "Tinh", name: "Tinh Nhật Mã", good: false, note: "Kỵ cưới hỏi; riêng xây dựng thì được." },
  { short: "Trương", name: "Trương Nguyệt Lộc", good: true, note: "Tốt cưới hỏi, an táng, khai trương, cầu tài." },
  { short: "Dực", name: "Dực Hỏa Xà", good: false, note: "Kỵ dựng nhà, chôn cất, cưới gả." },
  { short: "Chẩn", name: "Chẩn Thủy Dẫn", good: true, note: "Tốt khai trương, cưới hỏi, xây dựng, thăng chức." },
];

/** Julian Day Number của một ngày dương lịch (Gregorian). */
function toJDN(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return (
    d +
    Math.floor((153 * mm + 2) / 5) +
    365 * yy +
    Math.floor(yy / 4) -
    Math.floor(yy / 100) +
    Math.floor(yy / 400) -
    32045
  );
}

/** Nhị thập bát tú trực một ngày dương yyyy-mm-dd. */
export function dayTu(iso: string): TuInfo | null {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const idx = (((toJDN(y, m, d) + 11) % 28) + 28) % 28;
  return NHI_THAP_BAT_TU[idx];
}

const TAM_NUONG = [3, 7, 13, 18, 22, 27];
const NGUYET_KY = [5, 14, 23];

export interface FolkWarning {
  key: "tam-nuong" | "nguyet-ky";
  label: string;
  note: string;
}

// ─── 24 Tiết khí (theo kinh độ mặt trời, 15° một tiết) ──────────────
// Tên tiết xếp theo floor(kinhĐộ/15): index 0 = kinh độ [0°,15°) = Xuân phân.
const TIET_KHI = [
  "Xuân phân", "Thanh minh", "Cốc vũ", "Lập hạ", "Tiểu mãn", "Mang chủng",
  "Hạ chí", "Tiểu thử", "Đại thử", "Lập thu", "Xử thử", "Bạch lộ",
  "Thu phân", "Hàn lộ", "Sương giáng", "Lập đông", "Tiểu tuyết", "Đại tuyết",
  "Đông chí", "Tiểu hàn", "Đại hàn", "Lập xuân", "Vũ thủy", "Kinh trập",
];

/**
 * Kinh độ mặt trời (độ, 0–360) tại CUỐI ngày theo giờ Việt Nam (UTC+7).
 * Dùng cuối ngày để: ngày giao tiết được gán cho tiết MỚI (đúng quy ước lịch
 * vạn niên — vd 4/2 = Lập xuân, 22/12 = Đông chí). Thuật toán Hồ Ngọc Đức.
 */
function sunLongitudeDeg(jdn: number): number {
  const T = (jdn + 0.5 - 7 / 24 - 2451545.0) / 36525;
  const T2 = T * T;
  const dr = Math.PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL +=
    (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) +
    0.00029 * Math.sin(dr * 3 * M);
  let L = L0 + DL;
  L = L - 360 * Math.floor(L / 360);
  return L;
}

/** Tiết khí của một ngày dương yyyy-mm-dd (vd "Lập xuân"). */
export function dayTietKhi(iso: string): string | null {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const lon = sunLongitudeDeg(toJDN(y, m, d));
  return TIET_KHI[Math.floor(lon / 15) % 24];
}

/** Cảnh báo ngày kiêng dân gian theo NGÀY ÂM (Tam Nương, Nguyệt Kỵ). */
export function folkWarnings(lunarDay: number): FolkWarning[] {
  const out: FolkWarning[] = [];
  if (TAM_NUONG.includes(lunarDay)) {
    out.push({
      key: "tam-nuong",
      label: "Tam Nương",
      note: "Dân gian kiêng làm việc lớn (cưới hỏi, khai trương, động thổ, xuất hành).",
    });
  }
  if (NGUYET_KY.includes(lunarDay)) {
    out.push({
      key: "nguyet-ky",
      label: "Nguyệt Kỵ",
      note: "“Mùng năm, mười bốn, hai ba” — ngày kiêng khởi sự việc trọng đại.",
    });
  }
  return out;
}

/**
 * Mô tả đầy đủ một ngày dương (yyyy-mm-dd): âm lịch, can chi, hoàng
 * đạo, trực, nhị thập bát tú, ngày kiêng dân gian, việc nên/kiêng và
 * xếp hạng cho việc `activity` (nếu có).
 */
export function describeDay(
  iso: string,
  activity?: ActivityKey,
): DayInfo | null {
  const cc = getCanChiForSolarDate(iso);
  const lunar = solarStringToLunar(iso);
  const aus = dayAuspice(iso);
  const tu = dayTu(iso);
  if (!cc || !lunar || !aus || !tu) return null;

  const dayChi = chiIndexFromCanChi(cc.day);
  if (dayChi < 0) return null;
  const truc = trucForDay(dayChi, lunar.month);
  const warnings = folkWarnings(lunar.day);
  const level = levelFor(aus.good, truc, activity, warnings.length > 0);

  const [y, m, d] = iso.split("-").map(Number);
  return {
    iso,
    weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay(),
    solar: { day: d, month: m, year: y },
    lunar: { day: lunar.day, month: lunar.month, leap: !!lunar.isLeap },
    canChi: { day: cc.day, month: cc.month, year: cc.year },
    aus,
    truc: { name: truc.name, summary: truc.summary },
    tu,
    tietKhi: dayTietKhi(iso) ?? "",
    warnings,
    reason: buildReason(aus, truc, activity),
    shortReason: buildShortReason(aus, truc, activity),
    level,
    nen: truc.good.map((k) => ACTIVITY_LABEL[k]),
    kieng: truc.avoid.map((k) => ACTIVITY_LABEL[k]),
  };
}

/**
 * Câu giải thích vì sao ngày tốt/xấu — NGẮN GỌN, KHÔNG lặp: một vế đánh giá
 * ngày (hoàng/hắc đạo), một vế trực gắn thẳng với việc đang xét (trực chỉ
 * nhắc một lần). Không xét activity thì nêu ý nghĩa trực chung.
 */
function buildReason(
  aus: DayAuspice,
  truc: Truc,
  activity: ActivityKey | undefined,
): string {
  const day = aus.good
    ? `Ngày Hoàng đạo (sao ${aus.star}) — ngày lành.`
    : `Ngày Hắc đạo (sao ${aus.star} — ${aus.starDesc}) — nên kiêng việc lớn.`;

  if (!activity) {
    return `${day} Trực ${truc.name}: ${truc.summary.toLowerCase()}.`;
  }
  const label = ACTIVITY_LABEL[activity].toLowerCase();
  if (truc.good.includes(activity)) {
    return `${day} Trực ${truc.name} rất hợp việc ${label}.`;
  }
  if (truc.avoid.includes(activity)) {
    return `${day} Song trực ${truc.name} kỵ việc ${label}, nên tránh.`;
  }
  return `${day} Trực ${truc.name} không đặc biệt hợp hay kỵ việc ${label}.`;
}

/** Lý do ngắn gọn 1 dòng, cho danh sách nhiều ngày. */
function buildShortReason(
  aus: DayAuspice,
  truc: Truc,
  activity: ActivityKey | undefined,
): string {
  let s = `${aus.good ? "Hoàng đạo" : "Hắc đạo"} · Trực ${truc.name}`;
  if (activity) {
    const label = ACTIVITY_LABEL[activity].toLowerCase();
    if (truc.good.includes(activity)) s += ` — rất hợp ${label}`;
    else if (truc.avoid.includes(activity)) s += ` — kỵ ${label}`;
  }
  return s;
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
