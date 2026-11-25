// ⚠️ FILE ĐƯỢC SAO CHÉP — KHÔNG SỬA Ở ĐÂY.
//
// Bản sao nguyên văn của src/lib/postMarkdown.ts, để Edge Function share-view dựng đoạn trích / ảnh bìa / tiêu đề
// bài Bảng tin giống hệt phía trình duyệt. Deploy edge function là scp riêng thư mục supabase/functions/ nên không
// import ra ngoài được.
//
// Chống trôi: src/test/lib/kinshipVendorCopy.test.ts so sánh hai file phải GIỐNG HỆT nhau. Sửa bản gốc rồi chạy:
//     cp src/lib/postMarkdown.ts supabase/functions/_shared/vendor/postMarkdown.ts
// và chèn lại khối chú thích này lên đầu.

// ─── nguyên văn src/lib/postMarkdown.ts ───────────────────────────────
/**
 * Bài Bảng tin viết bằng Markdown (docs/plan-trang-dong-ho.md, mục 2.1). Bài cũ là chữ thường, xuống dòng đơn
 * phải còn nguyên khi hiển thị → chuyển thành xuống dòng cứng, trừ trong khối code và giữa các dòng danh sách.
 */

const FENCE = /^\s*(```|~~~)/;
const LIST_OR_QUOTE = /^\s*([-*+]\s|\d+[.)]\s|>)/;

export function normalizePostMarkdown(md: string): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  let inFence = false;
  return lines
    .map((line, i) => {
      if (FENCE.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      const next = lines[i + 1];
      const keepSoft =
        next === undefined ||
        line.trim() === "" ||
        next.trim() === "" ||
        LIST_OR_QUOTE.test(line) ||
        LIST_OR_QUOTE.test(next) ||
        /\s{2}$/.test(line) ||
        FENCE.test(next);
      return keepSoft ? line : `${line}  `;
    })
    .join("\n");
}

/** Ảnh Markdown (`![alt](url)`) hoặc `<img src>` đầu tiên trong bài; chỉ nhận https. */
export function firstImageUrl(md: string): string | null {
  const m = md.match(/!\[[^\]]*\]\(\s*(https:\/\/[^\s)]+)/) ?? md.match(/<img[^>]+src=["'](https:\/\/[^"']+)["']/i);
  return m ? m[1] : null;
}

/** Gỡ định dạng Markdown để lấy đoạn trích thuần chữ. */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*([-*+]|\d+[.)])\s+/gm, "")
    .replace(/(\*\*|__|\*|_|~~|`)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function postExcerpt(md: string, max = 200): string {
  const s = stripMarkdown(md);
  if (s.length <= max) return s;
  return `${s.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

/** Tiêu đề hiển thị: `title` nếu có, không thì dòng chữ đầu tiên của bài. */
export function postDisplayTitle(title: string | null | undefined, body: string, max = 80): string {
  const t = (title ?? "").trim();
  if (t) return t;
  const first = stripMarkdown(body.split("\n").find((l) => stripMarkdown(l)) ?? "");
  return first.length > max ? `${first.slice(0, max).replace(/\s+\S*$/, "")}…` : first;
}

/** Số phút đọc, ~200 từ/phút, tối thiểu 1. */
export function readMinutes(md: string): number {
  const words = stripMarkdown(md).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
