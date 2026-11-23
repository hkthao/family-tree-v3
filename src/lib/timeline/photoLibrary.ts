/**
 * THƯ VIỆN ẢNH TƯ LIỆU theo thời kỳ — CHỈ LÀ LINK tới Wikimedia Commons, không lưu file nào trên server
 * (server hạn chế dung lượng). Ảnh được nạp qua `Special:FilePath` (Commons tự thu nhỏ theo `?width=`).
 *
 * Giấy phép (đã kiểm tra khi chọn ngày 23/11/2026): Public domain, CC0, CC BY, CC BY-SA — dùng tự do nhưng
 * CC BY / CC BY-SA BẮT BUỘC ghi tác giả + giấy phép: poster tự hiện dòng ghi công dưới ảnh (`creditText`).
 * Ảnh được chọn theo tên và mô tả tệp, chưa duyệt từng tấm bằng mắt — rà soát trước khi phát hành.
 * Danh sách ứng viên đầy đủ: docs/nguon-anh-thu-vien-thoi-ky.md. `eraId` khớp `lib/timeline/eras.ts`.
 *
 * Thêm ảnh: thêm một dòng vào PHOTOS (tên tệp đúng như trên Commons, không có "File:").
 */
export interface LibraryPhoto {
  id: string;
  eraId: string;
  /** Tên tệp trên Wikimedia Commons (không có tiền tố "File:"). */
  file: string;
  caption: string;
  author: string;
  license: string;
}

export const LIBRARY_PHOTOS: LibraryPhoto[] = [
  { id: "ly-1", eraId: "ly", file: "Hanoi - Hanoi1638.jpg", caption: "Chùa Một Cột, Hà Nội (xây năm 1049 thời Lý)", author: "lumoplank", license: "CC0" },
  { id: "ly-2", eraId: "ly", file: "Hanoi day 2-3 (42633363262).jpg", caption: "Chùa Một Cột", author: "rhjpage", license: "CC BY 2.0" },
  { id: "ly-3", eraId: "ly", file: "20220605 Temple of Literature, Hanoi 01.jpg", caption: "Văn Miếu – Quốc Tử Giám (lập năm 1070)", author: "Ltn12345", license: "CC BY-SA 4.0" },
  { id: "ly-4", eraId: "ly", file: "20220605 Temple of Literature, Hanoi 02.jpg", caption: "Văn Miếu – Quốc Tử Giám", author: "Ltn12345", license: "CC BY-SA 4.0" },
  { id: "tran-1", eraId: "tran", file: "Tran Dynasty Stone Lion (9980684273).jpg", caption: "Sư tử đá thời Trần", author: "Gary Todd from Xinzheng, China", license: "CC0" },
  { id: "tran-2", eraId: "tran", file: "Tran-Ho Dynasty, 14th-15th Century, Architectural Decoration (9735703437).jpg", caption: "Trang trí kiến trúc thời Trần – Hồ", author: "Gary Todd from Xinzheng, China", license: "CC0" },
  { id: "tran-3", eraId: "tran", file: "Tran Dynasty Ceramic Brick (9980668973).jpg", caption: "Gạch gốm thời Trần", author: "Gary Todd from Xinzheng, China", license: "CC0" },
  { id: "ho-1", eraId: "ho", file: "Tay Do castle East gate.JPG", caption: "Cổng Đông thành Tây Đô (thành nhà Hồ)", author: "vi:Thành viên:Silviculture", license: "Public domain" },
  { id: "ho-2", eraId: "ho", file: "Tay Do castle North gate.JPG", caption: "Cổng Bắc thành Tây Đô", author: "vi:Thành viên:Silviculture", license: "Public domain" },
  { id: "ho-3", eraId: "ho", file: "Tay Do castle South gate.JPG", caption: "Cổng Nam thành Tây Đô", author: "vi:Thành viên:Silviculture", license: "Public domain" },
  { id: "ho-4", eraId: "ho", file: "Cổng Nam.jpg", caption: "Cổng Nam thành nhà Hồ", author: "Cổng Nam Thành Nhà Hồ", license: "CC BY-SA 3.0" },
  { id: "lam-son-1", eraId: "lam-son", file: "Lê Lợi's victory over 100,000 Ming invaders from China in 1427 AD - Chi Lang Pass (Ải Chi Lăng) - Museum of Vietnamese History - Ho Chi Minh City - DSC06005.JPG", caption: "Chiến thắng ải Chi Lăng năm 1427 (hiện vật bảo tàng)", author: "Daderot", license: "CC0" },
  { id: "lam-son-2", eraId: "lam-son", file: "Elephant, rhino, and horse, Le Loi mausoleum, Thanh Hoa province, 1433 AD, stone - Vietnam National Museum of Fine Arts - Hanoi, Vietnam - DSC04853.JPG", caption: "Tượng đá lăng Lê Lợi, Thanh Hoá", author: "Daderot", license: "CC0" },
  { id: "lam-son-3", eraId: "lam-son", file: "A painting depicting Lê Lợi's victory over Liễu Thăng.jpg", caption: "Tranh vẽ Lê Lợi đại thắng Liễu Thăng", author: "unknown author, collected by the Institute of Social Science", license: "Public domain" },
  { id: "le-so-1", eraId: "le-so", file: "Stelae of Doctors - Temple of Literature, Hanoi - DSC04561.JPG", caption: "Bia tiến sĩ, Văn Miếu Hà Nội", author: "Daderot", license: "CC0" },
  { id: "le-so-2", eraId: "le-so", file: "Stelae of Doctors - Temple of Literature, Hanoi - DSC04571.JPG", caption: "Bia tiến sĩ, Văn Miếu Hà Nội", author: "Daderot", license: "CC0" },
  { id: "le-so-3", eraId: "le-so", file: "Stelae of Doctors - Temple of Literature, Hanoi - DSC04676.JPG", caption: "Bia tiến sĩ, Văn Miếu Hà Nội", author: "Daderot", license: "CC0" },
  { id: "le-so-4", eraId: "le-so", file: "Nhà bia tiến sĩ.jpg", caption: "Nhà bia tiến sĩ", author: "Bùi Thụy Đào Nguyên", license: "CC BY-SA 3.0" },
  { id: "mac-le-trung-hung-1", eraId: "mac-le-trung-hung", file: "Triumphant return of a civil commander, view 2, Doc Loi temple, Nghe An province, late 18th century, Do (poonah) paper - Vietnam National Museum of Fine Arts - Hanoi, Vietnam - DSC05115.JPG", caption: "Tượng đá chạm cảnh quan văn vinh quy, đền Đức Lôi", author: "Daderot", license: "CC0" },
  { id: "mac-le-trung-hung-2", eraId: "mac-le-trung-hung", file: "Cannons and cannon balls, Restored Le dynasty, 17th-18th century AD, bronze and stone - National Museum of Vietnamese History - Hanoi, Vietnam - DSC05706.JPG", caption: "Đại bác thời Lê Trung hưng", author: "Daderot", license: "CC0" },
  { id: "mac-le-trung-hung-3", eraId: "mac-le-trung-hung", file: "Văn quan vinh quy đồ 2.jpg", caption: "Tranh văn quan vinh quy", author: "Unknown authorUnknown author", license: "Public domain" },
  { id: "trinh-nguyen-1", eraId: "trinh-nguyen", file: "Red Seal Ship departs Nagasaki to Annam (Vietnam).jpg", caption: "Thuyền Châu Ấn từ Nagasaki sang An Nam", author: "Unknown, compiled by Kondo Seisai (1771 - 1829), archived at", license: "Public domain" },
  { id: "trinh-nguyen-2", eraId: "trinh-nguyen", file: "Samuel Baron - The City of CHA-CHO, the Metropolis of TONQUEEN.jpg", caption: "Kẻ Chợ – Đông Kinh (tranh của Samuel Baron)", author: "Samuel Baron", license: "Public domain" },
  { id: "trinh-nguyen-3", eraId: "trinh-nguyen", file: "Plan d'une partie des côtes de la Cochinchine 1787 - Le Floch de La Carrière.jpg", caption: "Bản đồ bờ biển Đàng Trong năm 1787", author: "René-Julien Le Floch de la Carrière (1730-1792)", license: "Public domain" },
  { id: "tay-son-1", eraId: "tay-son", file: "Chính điện trong thành Hoàng đế.JPG", caption: "Chính điện thành Hoàng Đế", author: "Nguyễn Đông Sơn at Vietnamese Wikipedia", license: "CC BY-SA 3.0" },
  { id: "tay-son-2", eraId: "tay-son", file: "Cổng chính tử cấm thành, thành Hoàng Đế.JPG", caption: "Cổng chính Tử Cấm thành, thành Hoàng Đế", author: "Nguyễn Đông Sơn at Vietnamese Wikipedia", license: "CC BY-SA 3.0" },
  { id: "tay-son-3", eraId: "tay-son", file: "Nhà Tây Sơn, dấu ấn.JPG", caption: "Ấn triện thời Tây Sơn", author: "Nguyễn Thanh Quang", license: "CC BY-SA 3.0" },
  { id: "nguyen-doc-lap-1", eraId: "nguyen-doc-lap", file: "Gateway in the Imperial City.jpg", caption: "Cổng trong Hoàng thành Huế", author: "Kandukuru Nagarjun", license: "CC BY 2.0" },
  { id: "nguyen-doc-lap-2", eraId: "nguyen-doc-lap", file: "Gate in the Citadel of Huế.jpg", caption: "Cổng trong Kinh thành Huế", author: "Christophe95", license: "CC BY-SA 4.0" },
  { id: "nguyen-doc-lap-3", eraId: "nguyen-doc-lap", file: "Flag tower hoang thanh hue.jpg", caption: "Kỳ đài Huế", author: "Gaodanielbo", license: "CC BY 4.0" },
  { id: "nguyen-doc-lap-4", eraId: "nguyen-doc-lap", file: "Diên Thọ palace.jpg", caption: "Cung Diên Thọ, Huế", author: "Vano111ru", license: "CC BY-SA 4.0" },
  { id: "phap-thuoc-som-1", eraId: "phap-thuoc-som", file: "Chemin de fer de Hatou - 1000mm gauge Port-Courbet (Hòn Gai)–Hà Tu mining tramway in Tonkin, built after 1888 by the Société de charbonnages de Hon-gay.jpg", caption: "Tuyến đường sắt khổ 1000 mm ở Bắc Kỳ", author: "M. Martin, photographe Haiphong", license: "Public domain" },
  { id: "phap-thuoc-som-2", eraId: "phap-thuoc-som", file: "Conferentie Franco Vletonamcnic, Bestanddeelnr 901-8468.jpg", caption: "Hội nghị Việt – Pháp (tư liệu báo ảnh Hà Lan)", author: "Nationaal Archief", license: "CC0" },
  { id: "phap-thuoc-muon-1", eraId: "phap-thuoc-muon", file: "AP0024-Sallet Hanoï, 1930 – Vue aérienne – Le Petit Lac et ses alentours.jpg", caption: "Hà Nội năm 1930 nhìn từ trên cao, quanh Hồ Gươm", author: "Unknown photographer", license: "Public domain" },
  { id: "phap-thuoc-muon-2", eraId: "phap-thuoc-muon", file: "Canne à sucre en Indochine - champ de cannes après épaillage sur pied - btv1b10102912b.jpg", caption: "Cánh đồng mía ở Đông Dương (tư liệu Pháp)", author: "Không rõ", license: "Public domain" },
  { id: "phap-thuoc-muon-3", eraId: "phap-thuoc-muon", file: "Ảnh chụp các cô giáo và học sanh trường Thanh-Tâm đứng trước trường.png", caption: "Cô giáo và học sinh trường Thanh-Tâm", author: "Tân-Văn", license: "Public domain" },
  { id: "khang-chien-phap-1", eraId: "khang-chien-phap", file: "Ngày 28-08-1945, Đoàn giải phóng quân ở Việt Bắc về duyệt binh ở quảng trường Nhà hát Lớn - Hà Nội.jpg", caption: "Duyệt binh ngày 28/8/1945, Nhà hát Lớn Hà Nội", author: "The government of Vietnam.", license: "Public domain" },
  { id: "khang-chien-phap-2", eraId: "khang-chien-phap", file: "Toàn cảnh lễ đài tại Quảng trường Ba Đình - Hà Nội, ngày 02-09-1945.jpg", caption: "Lễ đài Quảng trường Ba Đình, ngày 2/9/1945", author: "The government of Vietnam.", license: "Public domain" },
  { id: "khang-chien-phap-3", eraId: "khang-chien-phap", file: "Rencontre au Grand Opéra de Hanoï le 17 août 1945.jpg", caption: "Cuộc mít tinh tại Nhà hát Lớn Hà Nội, 17/8/1945", author: "Front pour l'indépendance du Việt-Nam", license: "Public domain" },
  { id: "khang-chien-phap-4", eraId: "khang-chien-phap", file: "Lễ mít tinh thành lập Chính quyền cách mạng tỉnh Thái Nguyên ngày 20-8-1945.png", caption: "Lễ thành lập chính quyền cách mạng tỉnh Thái Nguyên, 20/8/1945", author: "Unknown photographer", license: "Public domain" },
  { id: "bao-cap-1", eraId: "bao-cap", file: "Stanisław Ryszard Chaciński - Wietnam 1981.jpg", caption: "Việt Nam năm 1981", author: "Autor nieznany", license: "CC0" },
  { id: "bao-cap-2", eraId: "bao-cap", file: "Thoi bao cap.jpg", caption: "Căn phòng thời bao cấp (Bảo tàng Dân tộc học)", author: "vi:User:Rungbachduong", license: "CC BY-SA 3.0" },
  { id: "bao-cap-3", eraId: "bao-cap", file: "Tem phiếu thời bao cấp.jpg", caption: "Tem phiếu thời bao cấp", author: "Myra Siason", license: "CC BY-SA 2.0" },
  { id: "so-hoa-1", eraId: "so-hoa", file: "NewOne - Surgical mask in Covid-19.jpg", caption: "Khẩu trang y tế mùa dịch COVID-19, Hà Nội", author: "Newone", license: "CC BY-SA 4.0" },
  { id: "so-hoa-2", eraId: "so-hoa", file: "Newone - Times City rực rỡ mùa cô Vy.jpg", caption: "Hà Nội mùa đại dịch COVID-19", author: "Newone", license: "CC BY-SA 4.0" },
  { id: "so-hoa-3", eraId: "so-hoa", file: "Newone - tấm chắn COVID.jpg", caption: "Tấm chắn phòng dịch ở quán ăn, Hà Nội 2020", author: "Newone", license: "CC BY-SA 4.0" },
];

const COMMONS = "https://commons.wikimedia.org/wiki/";

/** Link ảnh (đã thu nhỏ) để nhúng — đây cũng là giá trị lưu ở `image_url` của mốc. */
export function libraryPhotoUrl(p: Pick<LibraryPhoto, "file">, width = 800): string {
  const name = encodeURIComponent(p.file.replace(/ /g, "_")).replace(/%28/g, "(").replace(/%29/g, ")");
  return `${COMMONS}Special:FilePath/${name}?width=${width}`;
}

/** Trang mô tả tệp trên Commons (nơi xem tác giả, giấy phép đầy đủ). */
export function libraryPhotoPage(p: Pick<LibraryPhoto, "file">): string {
  return `${COMMONS}File:${encodeURIComponent(p.file.replace(/ /g, "_"))}`;
}

export function photosForEra(eraId: string): LibraryPhoto[] {
  return LIBRARY_PHOTOS.filter((p) => p.eraId === eraId);
}

/** Tìm ảnh thư viện theo link đã lưu (mọi cỡ `width`). Không phải ảnh thư viện → null. */
export function findLibraryPhotoByUrl(url: string | null | undefined): LibraryPhoto | null {
  if (!url || !url.startsWith(`${COMMONS}Special:FilePath/`)) return null;
  const base = url.split("?")[0];
  return LIBRARY_PHOTOS.find((p) => libraryPhotoUrl(p).split("?")[0] === base) ?? null;
}

/** Dòng ghi công hiện dưới ảnh. */
export function creditText(p: LibraryPhoto): string {
  return `${p.author} · ${p.license} · Wikimedia Commons`;
}
