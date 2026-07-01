/**
 * Từ điển đồng nghĩa / tình huống → giúp tìm kiếm ra đúng bài dù user gõ cách
 * gọi khác hoặc theo tình huống thực tế ("nhà mới" → nhập trạch).
 *
 * Key là 1 cụm chuẩn; value là các cách gọi/tình huống tương đương. Tìm kiếm
 * so khớp không dấu 2 chiều (chứa nhau) rồi gộp mọi biến thể vào truy vấn.
 * Mở rộng dần — chỉ là mapping tĩnh, chưa cần AI.
 */
export const CUSTOM_SYNONYMS: Record<string, string[]> = {
  "nhập trạch": ["nhà mới", "chuyển nhà", "về nhà mới", "dọn nhà", "tân gia"],
  "đầy tháng": ["cúng đầy tháng", "trẻ sơ sinh", "em bé mới sinh", "cữ"],
  "thôi nôi": ["đầy năm", "một tuổi", "thoi noi"],
  "ăn hỏi": ["đám hỏi", "đính hôn", "dạm ngõ", "lễ hỏi", "cưới hỏi"],
  "tang lễ": ["đám ma", "đám tang", "người mất", "có người mất", "ma chay"],
  "cải táng": ["bốc mộ", "sang cát", "sang mộ"],
  "giỗ": ["ngày giỗ", "cúng giỗ", "kỵ", "húy nhật"],
  "thanh minh": ["tảo mộ", "đi tảo mộ", "dọn mộ"],
  "ông công ông táo": ["ông táo", "táo quân", "23 tháng chạp", "cúng táo"],
  "khai trương": ["mở cửa hàng", "mở quán", "khai xuân"],
  "động thổ": ["xây nhà", "khởi công", "làm nhà"],
  "cúng xe": ["mua xe mới", "xe mới"],
  "giao thừa": ["đêm 30", "trừ tịch", "cúng giao thừa"],
  "mừng thọ": ["chúc thọ", "lễ thọ", "đại thọ"],
  "vu lan": ["rằm tháng bảy", "báo hiếu", "xá tội vong nhân"],
  "trung thu": ["rằm tháng tám", "tết thiếu nhi"],
  "thần tài": ["ông địa", "thờ thần tài", "vía thần tài"],
};
