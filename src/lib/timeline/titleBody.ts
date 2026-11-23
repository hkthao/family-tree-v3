/** Tiêu đề tối đa khi suy từ nội dung (khớp migration gộp person_timeline và công cụ MCP). */
export const DERIVE_TITLE = 120;

/**
 * Mốc chỉ có một đoạn nội dung (từ tiểu sử, dữ liệu cũ): ≤120 ký tự thì làm tiêu đề và không cần `body`; dài hơn thì
 * cắt 117 ký tự + "…" làm tiêu đề và GIỮ NGUYÊN VĂN ở `body`.
 */
export function splitTitleBody(text: string): { title: string; body: string | null } {
  const t = text.trim();
  return t.length <= DERIVE_TITLE
    ? { title: t, body: null }
    : { title: `${t.slice(0, DERIVE_TITLE - 3)}…`, body: t };
}

/**
 * Gợi ý hình minh hoạ cho một mốc chỉ có chữ (tiểu sử, dữ liệu nhập) theo từ khoá ở ĐẦU / trong câu, để poster có hình
 * phù hợp thay vì cùng một biểu tượng cho mọi mốc. Không khớp từ nào → "scroll" (văn thư). Câu lệnh SQL nhập tiểu sử
 * trên prod dùng đúng các quy tắc này (xem docs/plan-dong-thoi-gian-dong-ho.md).
 */
export function suggestIcon(text: string): import("@/lib/timeline/eras").TimelineIconKey {
  const s = text.trim().toLowerCase();
  if (/^sinh\b|chào đời|ra đời/.test(s)) return "cradle";
  // Không dùng \\b: JS coi chữ có dấu (à, ấ…) là KHÔNG phải ký tự từ nên "băng hà," không tạo ranh giới từ.
  if (/^(mất|băng hà|qua đời|chết|tạ thế|hy sinh)(?=$|[\s,.;:])|\bmất\b.*tuổi/.test(s)) return "candle";
  if (/kết hôn|cưới|lấy vợ|lấy chồng|thành thân|tiến cung|phong\b.*(phi|hậu)|lập hoàng hậu/.test(s)) return "ring";
  if (/lên ngôi|đăng cơ|xưng đế|xưng vương|tức vị|nhường ngôi|đổi niên hiệu|đóng đô|dời đô|xây thành|lập kinh/.test(s)) return "citadel";
  if (/đánh|chống|kháng chiến|dẹp|chinh|khởi nghĩa|đại phá|chiến thắng|thắng|quân|binh|bại|xâm lược/.test(s)) return "sword";
  if (/thi cử|khoa thi|tiến sĩ|học|sách|biên soạn|soạn|văn miếu|quốc tử giám|chữ/.test(s)) return "book";
  if (/cờ|lá cờ|hiệu triệu|truyền hịch/.test(s)) return "banner";
  return "scroll";
}
