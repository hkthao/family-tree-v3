/**
 * Seed nội dung "Sổ tay Văn hoá – Phong tục" (bảng custom_entries).
 * Chạy: npx tsx scripts/seed-customs.ts   (cần SUPABASE_SERVICE_ROLE_KEY ở .env.local)
 *
 * ⚠️ NỘI DUNG THAM KHẢO do soạn nhanh — mọi bài để status='needs_review',
 * admin phải đọc & xác minh trước khi chuyển 'published'. Phong tục có thể
 * khác nhau theo vùng/gia đình; không trình bày kiểu "đúng/sai".
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import type { Database } from "../src/lib/database.types.ts";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SERVICE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Row = Database["public"]["Tables"]["custom_entries"]["Insert"];

const sec = (heading: string, body: string) => ({ heading, body });

const ENTRIES: Row[] = [
  {
    title: "Lễ nhập trạch (về nhà mới)",
    aliases: ["nhà mới", "chuyển nhà", "tân gia", "dọn về nhà mới"],
    short_description:
      "Lễ trình báo Thổ Công – Thần linh khi dọn đến nơi ở mới, cầu bình an.",
    category: "tho_cung",
    regions: ["Miền Bắc", "Miền Trung", "Miền Nam"],
    scope: "gia_dinh",
    mandatory_level: "khuyen_khich",
    origin: "dan_gian",
    reliability: 3,
    applicable_to: "Gia đình chuyển đến nhà mới (mua/xây/thuê dài hạn).",
    timing: "Chọn ngày giờ hợp tuổi gia chủ, thường buổi sáng.",
    status: "needs_review",
    sections: [
      sec("Ý nghĩa", "Trình báo với Thổ Công, Thần linh cai quản đất nơi ở mới, xin phép chuyển đến cư ngụ và cầu mong bình an, thuận hoà."),
      sec("Chuẩn bị / lễ vật", "Mâm ngũ quả, hương hoa, trầu cau, xôi/gà hoặc mâm chay, nước, rượu, bếp lửa (bật bếp/đun nước tượng trưng cho sự ấm cúng). Lễ vật gia giảm theo điều kiện."),
      sec("Trình tự thực hiện", "Gia chủ mang bài vị/bát hương (nếu có) và bếp vào trước, thắp hương khấn trình Thổ Công – gia tiên, rồi mới chuyển đồ đạc vào. Nhiều nơi giữ tục đun ấm nước/nồi cơm đầu tiên trong nhà mới."),
      sec("Nên / kiêng kỵ", "Nên vào nhà vào giờ đã chọn, mang theo vật tượng trưng may mắn (gạo, muối). Nhiều vùng kiêng đi tay không vào nhà mới. Đây là tập tục phổ biến, không bắt buộc thống nhất."),
    ],
    faq: [
      { q: "Có nhất thiết phải làm không?", a: "Không bắt buộc; là phong tục cầu an, tuỳ tín ngưỡng và điều kiện gia đình." },
      { q: "Thuê nhà có cần làm không?", a: "Tuỳ quan niệm; nhiều gia đình chỉ thắp hương trình báo đơn giản khi thuê dài hạn." },
    ],
    sources: "Tổng hợp dân gian — cần đối chiếu tài liệu địa phương.",
  },
  {
    title: "Cúng đầy tháng cho bé",
    aliases: ["đầy tháng", "cúng mụ", "trẻ sơ sinh", "đầy cữ"],
    short_description:
      "Lễ tạ ơn 12 Bà Mụ và trình báo gia tiên khi bé tròn một tháng tuổi.",
    category: "vong_doi",
    regions: ["Miền Bắc", "Miền Trung", "Miền Nam"],
    scope: "gia_dinh",
    mandatory_level: "khuyen_khich",
    origin: "dan_gian",
    reliability: 3,
    applicable_to: "Gia đình có em bé tròn 1 tháng tuổi.",
    timing: "Bé tròn 1 tháng (tính theo âm lịch; nhiều nơi 'gái lùi 2, trai lùi 1').",
    lunar_month: null,
    status: "needs_review",
    sections: [
      sec("Ý nghĩa", "Tạ ơn 12 Bà Mụ và Đức Ông đã nặn ra và che chở cho bé, trình báo gia tiên có thêm thành viên, cầu bé hay ăn chóng lớn."),
      sec("Chuẩn bị / lễ vật", "Mâm cúng 12 Bà Mụ (chè, xôi, cháo, hoa quả, trầu cau…) và mâm cúng Đức Ông. Số lượng/loại lễ khác nhau rõ rệt giữa các vùng."),
      sec("Trình tự thực hiện", "Bày mâm, thắp hương, người lớn khấn tạ ơn Bà Mụ – gia tiên; sau đó có tục 'khai hoa' (bắt miếng) chúc bé điều tốt lành."),
      sec("Biến thể vùng miền", "Miền Nam thường cúng chè đậu/chè trôi nước; miền Bắc hay dùng xôi chè; lễ vật và cách tính ngày có khác nhau."),
    ],
    faq: [
      { q: "Tính ngày đầy tháng thế nào?", a: "Phổ biến theo âm lịch; nhiều nơi áp dụng 'gái lùi 2 ngày, trai lùi 1 ngày' — tuỳ tục địa phương." },
    ],
    sources: "Tổng hợp dân gian — cần admin xác minh.",
  },
  {
    title: "Cúng ông Công ông Táo",
    aliases: ["ông Táo", "Táo Quân", "23 tháng Chạp", "tiễn Táo về trời"],
    short_description:
      "Lễ tiễn Táo Quân về trời tâu việc bếp núc, gia đạo trong năm.",
    category: "le_tet",
    regions: ["Miền Bắc", "Miền Trung", "Miền Nam"],
    scope: "gia_dinh",
    mandatory_level: "khuyen_khich",
    origin: "dan_gian",
    reliability: 4,
    timing: "Ngày 23 tháng Chạp âm lịch.",
    lunar_month: 12,
    status: "needs_review",
    sections: [
      sec("Ý nghĩa", "Tiễn Táo Quân (Thần Bếp) về trời báo cáo Ngọc Hoàng việc trong nhà một năm qua; mở đầu không khí chuẩn bị Tết."),
      sec("Chuẩn bị / lễ vật", "Hương hoa, mâm cỗ, và (đặc trưng miền Bắc) cá chép sống để 'phóng sinh' làm phương tiện cho Táo; miền Trung/Nam có thể dùng cá chép giấy."),
      sec("Nên / kiêng kỵ", "Thả cá nhẹ nhàng, không ném từ trên cao; giữ vệ sinh nơi thả. Đây là nét đẹp gắn với phóng sinh."),
    ],
    faq: [
      { q: "Cúng trước ngày 23 được không?", a: "Nhiều gia đình cúng vào tối 22 hoặc sáng 23; tuỳ điều kiện, miễn trước giờ trưa 23 theo quan niệm phổ biến." },
    ],
    sources: "Tổng hợp — cần đối chiếu tài liệu.",
  },
  {
    title: "Tảo mộ tiết Thanh Minh",
    aliases: ["thanh minh", "tảo mộ", "đi tảo mộ", "dọn mộ tổ tiên"],
    short_description:
      "Con cháu sửa sang, dọn dẹp phần mộ và thắp hương tưởng nhớ tổ tiên.",
    category: "le_tet",
    regions: ["Miền Bắc", "Miền Trung", "Miền Nam"],
    scope: "dong_ho",
    mandatory_level: "khuyen_khich",
    origin: "dan_gian",
    reliability: 4,
    lunar_month: 3,
    timing: "Tiết Thanh Minh (khoảng đầu tháng 3 âm lịch).",
    status: "needs_review",
    sections: [
      sec("Ý nghĩa", "Thể hiện đạo hiếu 'uống nước nhớ nguồn'; con cháu tề tựu dọn cỏ, đắp lại mộ, thắp hương cho tổ tiên."),
      sec("Chuẩn bị", "Dụng cụ dọn cỏ, hương hoa, lễ vật đơn giản (trầu cau, bánh trái). Nhiều dòng họ tổ chức tảo mộ chung cả họ."),
      sec("Nên / kiêng kỵ", "Giữ trang nghiêm, dọn sạch khu mộ; tránh giẫm đạp mộ phần người khác."),
    ],
    faq: [],
    sources: "Tổng hợp dân gian.",
  },
  {
    title: "Dạm ngõ – Ăn hỏi – Cưới hỏi",
    aliases: ["đám hỏi", "ăn hỏi", "đính hôn", "cưới hỏi", "dạm ngõ"],
    short_description:
      "Chuỗi nghi lễ hôn nhân truyền thống gắn kết hai gia đình, hai dòng họ.",
    category: "vong_doi",
    regions: ["Miền Bắc", "Miền Trung", "Miền Nam"],
    scope: "dong_ho",
    mandatory_level: "dia_phuong",
    origin: "nho_giao",
    reliability: 3,
    applicable_to: "Cặp đôi chuẩn bị kết hôn và hai bên gia đình.",
    status: "needs_review",
    sections: [
      sec("Ý nghĩa", "Chính thức hoá quan hệ hôn nhân, ra mắt và gắn kết hai họ; thể hiện sự tôn trọng gia tiên hai bên."),
      sec("Các bước chính", "Dạm ngõ (chạm ngõ) → Ăn hỏi (lễ hỏi, tráp) → Lễ cưới (đón dâu, gia tiên). Số tráp, sính lễ thay đổi theo vùng và thoả thuận hai họ."),
      sec("Biến thể vùng miền", "Số tráp lẻ (miền Bắc) hay chẵn (miền Nam), nghi thức và lễ vật khác nhau — nên thống nhất trước giữa hai gia đình."),
    ],
    faq: [
      { q: "Bao nhiêu tráp ăn hỏi?", a: "Tuỳ vùng và thoả thuận: miền Bắc thường số lẻ (5,7,9,11), miền Nam hay số chẵn (6,8). Không có con số bắt buộc chung." },
    ],
    sources: "Tổng hợp — cần đối chiếu theo vùng.",
  },
  {
    title: "Giỗ (ngày kỵ) tổ tiên",
    aliases: ["ngày giỗ", "cúng giỗ", "kỵ", "húy nhật"],
    short_description:
      "Ngày tưởng nhớ người đã khuất theo âm lịch, con cháu sum họp cúng gia tiên.",
    category: "tho_cung",
    regions: ["Miền Bắc", "Miền Trung", "Miền Nam"],
    scope: "gia_dinh",
    mandatory_level: "khuyen_khich",
    origin: "nho_giao",
    reliability: 4,
    timing: "Theo ngày mất âm lịch của người được giỗ (giỗ đầu, giỗ hết, giỗ thường).",
    status: "needs_review",
    sections: [
      sec("Ý nghĩa", "Tưởng nhớ công ơn người đã khuất, duy trì sợi dây gắn kết con cháu và gia tiên."),
      sec("Các mốc giỗ", "Giỗ đầu (tròn 1 năm), giỗ hết (tròn 2 năm, mãn tang), sau đó là giỗ thường hằng năm."),
      sec("Chuẩn bị", "Mâm cỗ mặn hoặc chay, hương hoa; con cháu tề tựu. Quy mô tuỳ gia đình và mối quan hệ với người được giỗ."),
    ],
    faq: [
      { q: "Cúng giỗ trước hay đúng ngày?", a: "Nhiều gia đình cúng cáo giỗ (tiên thường) chiều hôm trước và chính giỗ đúng ngày." },
    ],
    sources: "Tổng hợp dân gian.",
  },
  {
    title: "Thờ Thần Tài – Ông Địa",
    aliases: ["thần tài", "ông địa", "vía thần tài", "mùng 10 tháng Giêng"],
    short_description:
      "Tín ngưỡng thờ cầu tài lộc, phổ biến với hộ kinh doanh, nhất là miền Nam.",
    category: "tho_cung",
    regions: ["Miền Nam", "Miền Trung"],
    scope: "gia_dinh",
    mandatory_level: "dia_phuong",
    origin: "dan_gian",
    reliability: 3,
    applicable_to: "Hộ kinh doanh, buôn bán, cửa hàng.",
    timing: "Cúng hằng ngày/tuần; vía Thần Tài mùng 10 tháng Giêng.",
    lunar_month: 1,
    status: "needs_review",
    sections: [
      sec("Ý nghĩa", "Cầu buôn may bán đắt, tài lộc; bàn thờ đặt sát đất gần cửa để 'đón' khách và tài."),
      sec("Chuẩn bị", "Bàn thờ Thần Tài – Ông Địa, hương, nước, hoa quả; ngày vía nhiều người mua vàng lấy may."),
      sec("Lưu ý", "Là tín ngưỡng vùng/nghề, không phải phong tục bắt buộc toàn quốc."),
    ],
    faq: [],
    sources: "Tổng hợp — phổ biến miền Nam.",
  },
  {
    title: "Lễ mừng thọ",
    aliases: ["chúc thọ", "lễ thọ", "đại thọ", "khao thọ"],
    short_description:
      "Con cháu tổ chức mừng ông bà, cha mẹ cao tuổi, tri ân và cầu trường thọ.",
    category: "vong_doi",
    regions: ["Miền Bắc", "Miền Trung", "Miền Nam"],
    scope: "dong_ho",
    mandatory_level: "khuyen_khich",
    origin: "nho_giao",
    reliability: 4,
    timing: "Thường vào dịp đầu xuân hoặc sinh nhật cụ; các mốc 70, 80, 90 tuổi.",
    status: "needs_review",
    sections: [
      sec("Ý nghĩa", "Thể hiện đạo hiếu, tôn kính người cao tuổi; dịp con cháu sum vầy chúc mừng."),
      sec("Tổ chức", "Có thể làm tại nhà, nhà thờ họ hoặc kết hợp lễ của hội người cao tuổi địa phương; trao quà, chụp ảnh gia đình."),
    ],
    faq: [],
    sources: "Tổng hợp dân gian.",
  },
  {
    title: "Lễ Vu Lan báo hiếu",
    aliases: ["vu lan", "rằm tháng bảy", "báo hiếu", "xá tội vong nhân"],
    short_description:
      "Dịp báo hiếu cha mẹ và tưởng nhớ tổ tiên; gắn với Phật giáo và tín ngưỡng dân gian.",
    category: "le_tet",
    regions: ["Miền Bắc", "Miền Trung", "Miền Nam"],
    scope: "ton_giao",
    mandatory_level: "khuyen_khich",
    origin: "phat_giao",
    reliability: 4,
    lunar_month: 7,
    timing: "Rằm tháng 7 âm lịch.",
    status: "needs_review",
    sections: [
      sec("Ý nghĩa", "Báo hiếu công ơn cha mẹ (còn sống lẫn đã khuất); nhà chùa làm lễ Vu Lan, cài hoa hồng. Dân gian cũng cúng cô hồn (xá tội vong nhân)."),
      sec("Thực hành", "Đi chùa, làm việc thiện, ăn chay, cúng gia tiên; nhiều nhà cúng chúng sinh ngoài trời."),
    ],
    faq: [
      { q: "Hoa hồng cài áo màu gì?", a: "Hồng đỏ nếu còn mẹ, hồng trắng nếu mẹ đã mất — nét đẹp trong lễ Vu Lan tại chùa." },
    ],
    sources: "Phật giáo + dân gian.",
  },
  {
    title: "Tết Đoan Ngọ (mùng 5 tháng 5)",
    aliases: ["đoan ngọ", "giết sâu bọ", "mùng 5 tháng 5"],
    short_description:
      "Tết 'diệt sâu bọ' giữa năm, ăn cơm rượu, trái cây, bánh tro theo mùa.",
    category: "le_tet",
    regions: ["Miền Bắc", "Miền Trung", "Miền Nam"],
    scope: "gia_dinh",
    mandatory_level: "dia_phuong",
    origin: "dan_gian",
    reliability: 3,
    lunar_month: 5,
    timing: "Mùng 5 tháng 5 âm lịch.",
    status: "needs_review",
    sections: [
      sec("Ý nghĩa", "Quan niệm 'giết sâu bọ' trong người vào giữa năm, cầu mùa màng, sức khoẻ."),
      sec("Món đặc trưng", "Cơm rượu nếp, mận, vải, bánh tro (bánh gio); mỗi vùng có món riêng."),
    ],
    faq: [],
    sources: "Tổng hợp dân gian.",
  },
  {
    title: "Lễ động thổ (khởi công xây nhà)",
    aliases: ["động thổ", "xây nhà", "khởi công", "làm nhà"],
    short_description:
      "Lễ xin phép Thổ Địa trước khi khởi công xây dựng, cầu công trình thuận lợi.",
    category: "tho_cung",
    regions: ["Miền Bắc", "Miền Trung", "Miền Nam"],
    scope: "gia_dinh",
    mandatory_level: "khuyen_khich",
    origin: "dan_gian",
    reliability: 3,
    applicable_to: "Gia đình/chủ đầu tư chuẩn bị khởi công xây dựng.",
    timing: "Chọn ngày giờ hợp tuổi gia chủ.",
    status: "needs_review",
    sections: [
      sec("Ý nghĩa", "Trình báo và xin phép Thổ Địa nơi xây dựng, cầu an toàn, thuận lợi cho công trình."),
      sec("Chuẩn bị", "Mâm lễ (hương hoa, ngũ quả, xôi gà/chay…), gia chủ cuốc/xúc nhát đất tượng trưng khởi công."),
    ],
    faq: [],
    sources: "Tổng hợp dân gian.",
  },
  {
    title: "Cúng tất niên",
    aliases: ["tất niên", "cuối năm", "cúng cuối năm"],
    short_description:
      "Bữa cúng và sum họp cuối năm, tạ ơn một năm và mời gia tiên về ăn Tết.",
    category: "le_tet",
    regions: ["Miền Bắc", "Miền Trung", "Miền Nam"],
    scope: "gia_dinh",
    mandatory_level: "khuyen_khich",
    origin: "dan_gian",
    reliability: 4,
    lunar_month: 12,
    timing: "Những ngày cuối tháng Chạp, thường 29–30 Tết.",
    status: "needs_review",
    sections: [
      sec("Ý nghĩa", "Khép lại năm cũ, tạ ơn trời đất – gia tiên, mời tổ tiên về sum vầy đón Tết cùng con cháu."),
      sec("Chuẩn bị", "Mâm cỗ tất niên, dọn dẹp bàn thờ; cả nhà quây quần dùng bữa."),
    ],
    faq: [],
    sources: "Tổng hợp dân gian.",
  },
  {
    title: "Giao thừa (lễ trừ tịch)",
    aliases: ["giao thừa", "đêm 30", "trừ tịch", "cúng giao thừa"],
    short_description:
      "Lễ chuyển giao năm cũ – năm mới, cúng trong nhà và ngoài trời đón năm mới.",
    category: "le_tet",
    regions: ["Miền Bắc", "Miền Trung", "Miền Nam"],
    scope: "gia_dinh",
    mandatory_level: "khuyen_khich",
    origin: "dan_gian",
    reliability: 4,
    lunar_month: 12,
    timing: "Thời khắc chuyển giao đêm 30 rạng mùng 1 Tết.",
    status: "needs_review",
    sections: [
      sec("Ý nghĩa", "Tiễn năm cũ, đón năm mới; cúng ngoài trời tiễn – đón quan Hành Khiển và cúng gia tiên trong nhà."),
      sec("Chuẩn bị", "Hai mâm: ngoài trời và trong nhà; hương hoa, mâm cỗ hoặc lễ chay tuỳ gia đình."),
    ],
    faq: [
      { q: "Cúng ngoài trời trước hay trong nhà trước?", a: "Quan niệm phổ biến: cúng ngoài trời (tiễn – đón quan Hành Khiển) trước, rồi cúng gia tiên trong nhà." },
    ],
    sources: "Tổng hợp dân gian.",
  },
  {
    title: "Xông đất – hái lộc đầu năm",
    aliases: ["xông đất", "xông nhà", "hái lộc", "đầu năm mới"],
    short_description:
      "Phong tục người đầu tiên bước vào nhà năm mới và tục xin lộc đầu xuân.",
    category: "sinh_hoat",
    regions: ["Miền Bắc", "Miền Trung", "Miền Nam"],
    scope: "gia_dinh",
    mandatory_level: "dia_phuong",
    origin: "dan_gian",
    reliability: 3,
    lunar_month: 1,
    timing: "Sáng mùng 1 Tết.",
    status: "needs_review",
    sections: [
      sec("Ý nghĩa", "Quan niệm người xông đất hợp tuổi, vui vẻ sẽ mang may mắn cho gia chủ cả năm; hái lộc lấy 'lộc' đầu xuân."),
      sec("Lưu ý", "Là tập tục cầu may, không bắt buộc; hái lộc nên hạn chế bẻ cành cây nơi công cộng/đền chùa để giữ cảnh quan."),
    ],
    faq: [],
    sources: "Tổng hợp dân gian.",
  },
  {
    title: "Tết Trung Thu",
    aliases: ["trung thu", "rằm tháng tám", "tết thiếu nhi", "tết đoàn viên"],
    short_description:
      "Tết trông trăng, đoàn viên; gắn với thiếu nhi, đèn lồng, bánh trung thu.",
    category: "le_tet",
    regions: ["Miền Bắc", "Miền Trung", "Miền Nam"],
    scope: "gia_dinh",
    mandatory_level: "dia_phuong",
    origin: "dan_gian",
    reliability: 4,
    lunar_month: 8,
    timing: "Rằm tháng 8 âm lịch.",
    status: "needs_review",
    sections: [
      sec("Ý nghĩa", "Tết đoàn viên trông trăng; trẻ em rước đèn, phá cỗ; gia đình sum họp."),
      sec("Đặc trưng", "Bánh nướng – bánh dẻo, mâm cỗ trông trăng, múa lân, đèn ông sao."),
    ],
    faq: [],
    sources: "Tổng hợp dân gian.",
  },
];

async function main() {
  console.log(`Seeding ${ENTRIES.length} bài Sổ tay Văn hoá (status=needs_review)…`);
  let ok = 0;
  for (const e of ENTRIES) {
    // Tránh trùng khi chạy lại: bỏ qua nếu đã có bài cùng tiêu đề.
    const { data: existing } = await admin
      .from("custom_entries")
      .select("id")
      .eq("title", e.title)
      .is("deleted_at", null)
      .maybeSingle();
    if (existing) {
      console.log(`  ↷ bỏ qua (đã có): ${e.title}`);
      continue;
    }
    const { error } = await admin.from("custom_entries").insert(e);
    if (error) console.error(`  ✗ ${e.title}: ${error.message}`);
    else {
      ok++;
      console.log(`  ✓ ${e.title}`);
    }
  }
  console.log(`Xong. Đã thêm ${ok} bài. Nhớ đọc & xác minh trước khi 'published'.`);
}

main().then(() => process.exit(0));
