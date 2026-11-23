/**
 * Dữ liệu của dòng thời gian dùng cho công cụ MCP: thư viện THỜI ĐẠI (bối cảnh), CẢNH minh hoạ và MẪU mốc.
 * SINH TỰ ĐỘNG từ code của app (src/lib/timeline/eras.ts, components/timeline/TimelineScene.tsx, lib/timeline/templates.ts) — KHÔNG
 * sửa tay. Có test đối chiếu (src/test/lib/mcpTimelineData.test.ts): lệch với app thì test báo đỏ, chạy lại bước sinh để cập nhật.
 */
export interface TimelineEra {
  id: string;
  from: number;
  to: number;
  title: string;
  bullets: string[];
  icon: string;
}

export const TIMELINE_ERAS: TimelineEra[] = [
  {
    "id": "ly",
    "from": 1009,
    "to": 1225,
    "title": "Nhà Lý",
    "bullets": [
      "Dời đô ra Thăng Long (1010)",
      "Lập Văn Miếu (1070), Quốc Tử Giám (1076)",
      "Phật giáo hưng thịnh"
    ],
    "icon": "citadel"
  },
  {
    "id": "tran",
    "from": 1226,
    "to": 1399,
    "title": "Nhà Trần",
    "bullets": [
      "Ba lần kháng chiến chống quân Nguyên Mông",
      "Chiến thắng Bạch Đằng (1288)",
      "Chữ Nôm phát triển"
    ],
    "icon": "sword"
  },
  {
    "id": "ho",
    "from": 1400,
    "to": 1406,
    "title": "Nhà Hồ",
    "bullets": [
      "Cải cách của Hồ Quý Ly",
      "Xây thành nhà Hồ"
    ],
    "icon": "citadel"
  },
  {
    "id": "lam-son",
    "from": 1407,
    "to": 1427,
    "title": "Thuộc Minh và khởi nghĩa Lam Sơn",
    "bullets": [
      "Lê Lợi dấy nghĩa Lam Sơn (1418)",
      "Giành lại độc lập (1427)"
    ],
    "icon": "banner"
  },
  {
    "id": "le-so",
    "from": 1428,
    "to": 1526,
    "title": "Nhà Lê sơ",
    "bullets": [
      "Bộ luật Hồng Đức",
      "Thời Lê Thánh Tông cực thịnh",
      "Khoa cử, bia tiến sĩ"
    ],
    "icon": "scroll"
  },
  {
    "id": "mac-le-trung-hung",
    "from": 1527,
    "to": 1599,
    "title": "Nhà Mạc và Lê Trung hưng",
    "bullets": [
      "Triều Mạc cát cứ phía Bắc",
      "Nam – Bắc triều đối đầu"
    ],
    "icon": "sword"
  },
  {
    "id": "trinh-nguyen",
    "from": 1600,
    "to": 1788,
    "title": "Trịnh – Nguyễn phân tranh",
    "bullets": [
      "Đàng Ngoài, Đàng Trong chia cắt",
      "Người Việt mở đất về phương Nam",
      "Chữ Quốc ngữ hình thành"
    ],
    "icon": "boat"
  },
  {
    "id": "tay-son",
    "from": 1789,
    "to": 1801,
    "title": "Nhà Tây Sơn",
    "bullets": [
      "Quang Trung đại phá quân Thanh (1789)",
      "Thống nhất đất nước"
    ],
    "icon": "banner"
  },
  {
    "id": "nguyen-doc-lap",
    "from": 1802,
    "to": 1857,
    "title": "Nhà Nguyễn độc lập",
    "bullets": [
      "Gia Long lên ngôi, đóng đô ở Huế (1802)",
      "Quốc hiệu Việt Nam (1804)"
    ],
    "icon": "citadel"
  },
  {
    "id": "phap-thuoc-som",
    "from": 1858,
    "to": 1918,
    "title": "Pháp xâm lược và đô hộ",
    "bullets": [
      "Pháp đánh Đà Nẵng (1858)",
      "Phong trào Cần Vương",
      "Chữ Quốc ngữ dần phổ biến"
    ],
    "icon": "boat"
  },
  {
    "id": "phap-thuoc-muon",
    "from": 1919,
    "to": 1944,
    "title": "Những năm đấu tranh giành độc lập",
    "bullets": [
      "Bỏ thi chữ Hán (1919)",
      "Đảng Cộng sản Việt Nam ra đời (1930)",
      "Nạn đói năm Ất Dậu (1945)"
    ],
    "icon": "rice"
  },
  {
    "id": "khang-chien-phap",
    "from": 1945,
    "to": 1954,
    "title": "Độc lập và kháng chiến chống Pháp",
    "bullets": [
      "Tuyên ngôn Độc lập 2/9/1945",
      "Chiến thắng Điện Biên Phủ (1954)"
    ],
    "icon": "banner"
  },
  {
    "id": "hai-mien",
    "from": 1955,
    "to": 1975,
    "title": "Đất nước chia hai miền",
    "bullets": [
      "Chia cắt ở vĩ tuyến 17",
      "Kháng chiến chống Mỹ",
      "Thống nhất ngày 30/4/1975"
    ],
    "icon": "radio"
  },
  {
    "id": "bao-cap",
    "from": 1976,
    "to": 1985,
    "title": "Thời bao cấp",
    "bullets": [
      "Tem phiếu, sổ gạo",
      "Xe đạp là phương tiện chính",
      "Cuộc sống nhiều khó khăn"
    ],
    "icon": "bicycle"
  },
  {
    "id": "doi-moi",
    "from": 1986,
    "to": 1999,
    "title": "Thời Đổi Mới",
    "bullets": [
      "Đổi Mới (1986), kinh tế khởi sắc",
      "Bình thường hoá quan hệ với Mỹ (1995)",
      "Internet vào Việt Nam (1997)"
    ],
    "icon": "rice"
  },
  {
    "id": "hoi-nhap",
    "from": 2000,
    "to": 2019,
    "title": "Hội nhập",
    "bullets": [
      "Gia nhập WTO (2007)",
      "Điện thoại di động, mạng xã hội phổ biến"
    ],
    "icon": "phone"
  },
  {
    "id": "so-hoa",
    "from": 2020,
    "to": 2099,
    "title": "Thời chuyển đổi số",
    "bullets": [
      "Đại dịch Covid-19 (2020)",
      "Học, làm việc và kết nối trực tuyến"
    ],
    "icon": "phone"
  }
];

export const TIMELINE_SCENES: { id: string; icon: string }[] = [
  {
    "id": "lap-gia-dinh",
    "icon": "ring"
  },
  {
    "id": "con-dau-long",
    "icon": "cradle"
  },
  {
    "id": "sum-hop",
    "icon": "family"
  },
  {
    "id": "dung-nha",
    "icon": "citadel"
  },
  {
    "id": "tu-duong",
    "icon": "citadel"
  },
  {
    "id": "hop-ho",
    "icon": "candle"
  },
  {
    "id": "tien-biet",
    "icon": "candle"
  },
  {
    "id": "gia-pha",
    "icon": "scroll"
  },
  {
    "id": "ky-niem",
    "icon": "banner"
  },
  {
    "id": "di-cu",
    "icon": "boat"
  },
  {
    "id": "hoi-huong",
    "icon": "boat"
  },
  {
    "id": "tong-quan",
    "icon": "sword"
  },
  {
    "id": "chien-tranh",
    "icon": "sword"
  },
  {
    "id": "do-dat",
    "icon": "book"
  },
  {
    "id": "lam-an",
    "icon": "rice"
  },
  {
    "id": "xe-dap",
    "icon": "bicycle"
  },
  {
    "id": "radio-tivi",
    "icon": "radio"
  },
  {
    "id": "hien-dai",
    "icon": "phone"
  }
];

export const TIMELINE_TEMPLATES: { id: string; title: string; body: string; icon: string }[] = [
  {
    "id": "lap-gia-dinh",
    "title": "Lập gia đình",
    "body": "Hai người nên duyên vợ chồng, bắt đầu một mái ấm mới.",
    "icon": "ring"
  },
  {
    "id": "con-dau-long",
    "title": "Đón con đầu lòng",
    "body": "Gia đình đón thành viên mới chào đời.",
    "icon": "cradle"
  },
  {
    "id": "sum-hop",
    "title": "Sum họp nhiều thế hệ",
    "body": "Ông bà, cha mẹ, con cháu cùng quây quần một nhà.",
    "icon": "family"
  },
  {
    "id": "dung-nha",
    "title": "Dựng nhà mới",
    "body": "Gia đình dựng được căn nhà riêng sau bao năm cần cù.",
    "icon": "citadel"
  },
  {
    "id": "tu-duong",
    "title": "Xây dựng, tu bổ từ đường",
    "body": "Con cháu góp công góp của dựng lại từ đường của dòng họ.",
    "icon": "citadel"
  },
  {
    "id": "hop-ho",
    "title": "Họp họ, giỗ Tổ",
    "body": "Con cháu khắp nơi về họp mặt, cùng tưởng nhớ tổ tiên.",
    "icon": "candle"
  },
  {
    "id": "tien-biet",
    "title": "Tiễn biệt người đáng kính",
    "body": "Cả họ tiễn đưa một người đã có công vun đắp cho gia đình.",
    "icon": "candle"
  },
  {
    "id": "gia-pha",
    "title": "Biên soạn gia phả",
    "body": "Dòng họ ghi chép lại cội nguồn và các đời để con cháu nhớ.",
    "icon": "scroll"
  },
  {
    "id": "ky-niem",
    "title": "Lễ kỷ niệm của dòng họ",
    "body": "Dòng họ tổ chức lễ lớn, con cháu về dự đông đủ.",
    "icon": "banner"
  },
  {
    "id": "di-cu",
    "title": "Di cư, lập nghiệp nơi mới",
    "body": "Gia đình rời quê cũ để tìm cuộc sống mới ở nơi khác.",
    "icon": "boat"
  },
  {
    "id": "hoi-huong",
    "title": "Trở về quê cũ",
    "body": "Cả nhà trở về quê hương sau nhiều năm xa cách.",
    "icon": "boat"
  },
  {
    "id": "tong-quan",
    "title": "Tòng quân, lên đường nhập ngũ",
    "body": "Người con của gia đình lên đường làm nghĩa vụ với đất nước.",
    "icon": "sword"
  },
  {
    "id": "chien-tranh",
    "title": "Thời chiến loạn, tản cư",
    "body": "Gia đình trải qua mất mát, phải rời nhà lánh nạn.",
    "icon": "sword"
  },
  {
    "id": "do-dat",
    "title": "Con cháu học hành, đỗ đạt",
    "body": "Con cháu trong nhà tốt nghiệp, đỗ đạt, làm rạng danh dòng họ.",
    "icon": "book"
  },
  {
    "id": "lam-an",
    "title": "Gây dựng cơ nghiệp, làm ăn",
    "body": "Gia đình bắt đầu làm ăn, từng bước gây dựng cơ nghiệp.",
    "icon": "rice"
  },
  {
    "id": "xe-dap",
    "title": "Sắm chiếc xe đầu tiên",
    "body": "Gia đình sắm được chiếc xe đầu tiên, đi lại đỡ vất vả.",
    "icon": "bicycle"
  },
  {
    "id": "radio-tivi",
    "title": "Có chiếc radio, ti vi đầu tiên",
    "body": "Cả xóm kéo đến xem chung chiếc ti vi đầu tiên của nhà.",
    "icon": "radio"
  },
  {
    "id": "hien-dai",
    "title": "Cuộc sống hiện đại",
    "body": "Điện thoại, mạng xã hội giúp con cháu xa nhà vẫn gần nhau.",
    "icon": "phone"
  }
];

export const SCENE_IDS: string[] = TIMELINE_SCENES.map((s) => s.id);

/** Thời đại CHỨA đúng năm (không có → null). */
export function eraOfYear(year: number): TimelineEra | null {
  return TIMELINE_ERAS.find((e) => e.from <= year && year <= e.to) ?? null;
}
