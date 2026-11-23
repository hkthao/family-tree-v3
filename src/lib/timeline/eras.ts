import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";

/**
 * Thư viện "bối cảnh thời đại" Việt Nam — thẻ gắn theo khoảng năm, dùng cho hàng "Thời ấy" dưới trục
 * dòng thời gian. Dữ liệu seed cố định (không theo dòng họ); admin có thể ghi đè sau (bước 2).
 *
 * `iconKey` chọn hình minh hoạ trong bộ icon cùng một phong cách (bước 3) — để mọi mốc/thẻ trông
 * đồng bộ thay vì mỗi chỗ một kiểu.
 *
 * LƯU Ý: nội dung lịch sử đã viết ngắn, chỉ những mốc phổ biến; cần rà soát lại trước khi phát hành.
 */
export type TimelineIconKey =
  | "citadel"
  | "scroll"
  | "sword"
  | "boat"
  | "banner"
  | "book"
  | "rice"
  | "bicycle"
  | "radio"
  | "phone"
  | "family"
  | "tree"
  | "cradle"
  | "candle"
  | "ring";

export interface EraCard {
  id: string;
  from: number;
  to: number;
  title: string;
  bullets: string[];
  iconKey: TimelineIconKey;
}

interface RawEra {
  id: string;
  from: number;
  to: number;
  title: ReturnType<typeof msg>;
  bullets: ReturnType<typeof msg>[];
  iconKey: TimelineIconKey;
}

const RAW_ERAS: RawEra[] = [
  {
    id: "ly",
    from: 1009,
    to: 1225,
    title: msg`Nhà Lý`,
    bullets: [
      msg`Dời đô ra Thăng Long (1010)`,
      msg`Lập Văn Miếu (1070), Quốc Tử Giám (1076)`,
      msg`Phật giáo hưng thịnh`,
    ],
    iconKey: "citadel",
  },
  {
    id: "tran",
    from: 1226,
    to: 1399,
    title: msg`Nhà Trần`,
    bullets: [
      msg`Ba lần kháng chiến chống quân Nguyên Mông`,
      msg`Chiến thắng Bạch Đằng (1288)`,
      msg`Chữ Nôm phát triển`,
    ],
    iconKey: "sword",
  },
  {
    id: "ho",
    from: 1400,
    to: 1406,
    title: msg`Nhà Hồ`,
    bullets: [
      msg`Cải cách của Hồ Quý Ly`,
      msg`Xây thành nhà Hồ`,
    ],
    iconKey: "citadel",
  },
  {
    id: "lam-son",
    from: 1407,
    to: 1427,
    title: msg`Thuộc Minh và khởi nghĩa Lam Sơn`,
    bullets: [
      msg`Lê Lợi dấy nghĩa Lam Sơn (1418)`,
      msg`Giành lại độc lập (1427)`,
    ],
    iconKey: "banner",
  },
  {
    id: "le-so",
    from: 1428,
    to: 1526,
    title: msg`Nhà Lê sơ`,
    bullets: [
      msg`Bộ luật Hồng Đức`,
      msg`Thời Lê Thánh Tông cực thịnh`,
      msg`Khoa cử, bia tiến sĩ`,
    ],
    iconKey: "scroll",
  },
  {
    id: "mac-le-trung-hung",
    from: 1527,
    to: 1599,
    title: msg`Nhà Mạc và Lê Trung hưng`,
    bullets: [
      msg`Triều Mạc cát cứ phía Bắc`,
      msg`Nam – Bắc triều đối đầu`,
    ],
    iconKey: "sword",
  },
  {
    id: "trinh-nguyen",
    from: 1600,
    to: 1788,
    title: msg`Trịnh – Nguyễn phân tranh`,
    bullets: [
      msg`Đàng Ngoài, Đàng Trong chia cắt`,
      msg`Người Việt mở đất về phương Nam`,
      msg`Chữ Quốc ngữ hình thành`,
    ],
    iconKey: "boat",
  },
  {
    id: "tay-son",
    from: 1789,
    to: 1801,
    title: msg`Nhà Tây Sơn`,
    bullets: [
      msg`Quang Trung đại phá quân Thanh (1789)`,
      msg`Thống nhất đất nước`,
    ],
    iconKey: "banner",
  },
  {
    id: "nguyen-doc-lap",
    from: 1802,
    to: 1857,
    title: msg`Nhà Nguyễn độc lập`,
    bullets: [
      msg`Gia Long lên ngôi, đóng đô ở Huế (1802)`,
      msg`Quốc hiệu Việt Nam (1804)`,
    ],
    iconKey: "citadel",
  },
  {
    id: "phap-thuoc-som",
    from: 1858,
    to: 1918,
    title: msg`Pháp xâm lược và đô hộ`,
    bullets: [
      msg`Pháp đánh Đà Nẵng (1858)`,
      msg`Phong trào Cần Vương`,
      msg`Chữ Quốc ngữ dần phổ biến`,
    ],
    iconKey: "boat",
  },
  {
    id: "phap-thuoc-muon",
    from: 1919,
    to: 1944,
    title: msg`Những năm đấu tranh giành độc lập`,
    bullets: [
      msg`Bỏ thi chữ Hán (1919)`,
      msg`Đảng Cộng sản Việt Nam ra đời (1930)`,
      msg`Nạn đói năm Ất Dậu (1945)`,
    ],
    iconKey: "rice",
  },
  {
    id: "khang-chien-phap",
    from: 1945,
    to: 1954,
    title: msg`Độc lập và kháng chiến chống Pháp`,
    bullets: [
      msg`Tuyên ngôn Độc lập 2/9/1945`,
      msg`Chiến thắng Điện Biên Phủ (1954)`,
    ],
    iconKey: "banner",
  },
  {
    id: "hai-mien",
    from: 1955,
    to: 1975,
    title: msg`Đất nước chia hai miền`,
    bullets: [
      msg`Chia cắt ở vĩ tuyến 17`,
      msg`Kháng chiến chống Mỹ`,
      msg`Thống nhất ngày 30/4/1975`,
    ],
    iconKey: "radio",
  },
  {
    id: "bao-cap",
    from: 1976,
    to: 1985,
    title: msg`Thời bao cấp`,
    bullets: [
      msg`Tem phiếu, sổ gạo`,
      msg`Xe đạp là phương tiện chính`,
      msg`Cuộc sống nhiều khó khăn`,
    ],
    iconKey: "bicycle",
  },
  {
    id: "doi-moi",
    from: 1986,
    to: 1999,
    title: msg`Thời Đổi Mới`,
    bullets: [
      msg`Đổi Mới (1986), kinh tế khởi sắc`,
      msg`Bình thường hoá quan hệ với Mỹ (1995)`,
      msg`Internet vào Việt Nam (1997)`,
    ],
    iconKey: "rice",
  },
  {
    id: "hoi-nhap",
    from: 2000,
    to: 2019,
    title: msg`Hội nhập`,
    bullets: [
      msg`Gia nhập WTO (2007)`,
      msg`Điện thoại di động, mạng xã hội phổ biến`,
    ],
    iconKey: "phone",
  },
  {
    id: "so-hoa",
    from: 2020,
    to: 2099,
    title: msg`Thời chuyển đổi số`,
    bullets: [
      msg`Đại dịch Covid-19 (2020)`,
      msg`Học, làm việc và kết nối trực tuyến`,
    ],
    iconKey: "phone",
  },
];

/** Thẻ bối cảnh, đã dịch theo ngôn ngữ hiện tại. Gọi lúc render (không cache ở module). */
export function getEraCards(): EraCard[] {
  return RAW_ERAS.map((e) => ({
    id: e.id,
    from: e.from,
    to: e.to,
    iconKey: e.iconKey,
    title: i18n._(e.title),
    bullets: e.bullets.map((b) => i18n._(b)),
  }));
}

/** Các thẻ bối cảnh giao với khoảng [from, to]. */
export function erasOverlapping(
  from: number,
  to: number,
  eras: EraCard[] = getEraCards(),
): EraCard[] {
  return eras.filter((e) => e.from <= to && e.to >= from);
}
