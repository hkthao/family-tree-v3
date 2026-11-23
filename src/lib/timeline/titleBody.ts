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
