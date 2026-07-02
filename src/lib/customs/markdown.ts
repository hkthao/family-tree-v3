// Parse "thân Markdown" (không frontmatter) thành 1 bài Sổ tay Văn hoá.
//
// Quy ước (thống nhất với editor & skill so-tay-viet-bai):
//   # Tiêu đề            → title (H1 đầu tiên)
//   đoạn mở đầu          → short_description (mọi dòng trước ## đầu tiên)
//   ## Heading           → 1 đoạn {heading, body}
//   ![chú thích](https)  → ảnh minh hoạ đầu tiên trong đoạn (image_url + image_caption)
//   ## Câu hỏi thường gặp → parse ### thành faq[{q,a}]
//
// Nội dung được render dạng plain-text (whitespace-pre-wrap) nên body chỉ cần
// làm sạch cú pháp inline nhẹ (bỏ **đậm**, [text](url) → text). Không cần AST
// markdown đầy đủ → tránh thêm dependency.

import type { CustomFaq, CustomSection } from "@/lib/queries/customs";

export interface ParsedCustomEntry {
  title: string;
  short_description: string;
  sections: CustomSection[];
  faq: CustomFaq[];
}

// Heading (đã bỏ dấu, thường) coi là khối FAQ.
const FAQ_HEADINGS = new Set([
  "faq",
  "cau hoi thuong gap",
  "cac cau hoi thuong gap",
  "hoi dap",
  "cau hoi",
]);

// Bỏ dấu tiếng Việt đơn giản để so khớp heading FAQ (độc lập với lib unaccent).
function deburr(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const IMG_RE = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/;

/** Tách ảnh minh hoạ đầu tiên (chỉ https) ra khỏi thân đoạn. */
function extractImage(body: string): {
  body: string;
  image_url?: string;
  image_caption?: string;
} {
  const m = body.match(IMG_RE);
  if (!m || !/^https:\/\//i.test(m[2])) return { body };
  const image_url = m[2].trim();
  const image_caption = m[1].trim() || undefined;
  const stripped = body.replace(m[0], "").trim();
  return { body: stripped, image_url, image_caption };
}

/** Làm sạch cú pháp inline để hiển thị plain-text cho dễ đọc. */
function cleanInline(line: string): string {
  return line
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // ảnh còn sót → chú thích
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1") // [text](url) → text
    .replace(/\*\*([^*]+)\*\*/g, "$1") // **đậm** → đậm
    .replace(/__([^_]+)__/g, "$1") // __đậm__ → đậm
    .replace(/`([^`]+)`/g, "$1") // `code` → code
    .replace(/^\s{0,3}#{1,6}\s+/, "") // #### heading con → text
    .replace(/^\s{0,3}>\s?/, ""); // > blockquote → text
}

/** Chuẩn hoá thân đoạn: làm sạch từng dòng, gộp dòng trống liên tiếp. */
function normalizeBody(raw: string): string {
  const cleaned = raw
    .split("\n")
    .map((l) => cleanInline(l).replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
  return cleaned.trim();
}

/** Parse khối FAQ: mỗi `###` (hoặc dòng đậm/kết thúc `?`) là 1 câu hỏi. */
function parseFaq(body: string): CustomFaq[] {
  const lines = body.split("\n");
  const out: CustomFaq[] = [];
  let cur: { q: string; a: string[] } | null = null;
  const push = () => {
    if (cur && (cur.q || cur.a.length)) {
      out.push({ q: cur.q.trim(), a: normalizeBody(cur.a.join("\n")) });
    }
  };
  for (const line of lines) {
    const h = line.match(/^\s{0,3}#{3,6}\s+(.+)$/);
    if (h) {
      push();
      cur = { q: cleanInline(h[1]).trim(), a: [] };
    } else if (cur) {
      cur.a.push(line);
    }
  }
  push();
  return out.filter((f) => f.q || f.a);
}

/**
 * Parse 1 bài từ thân markdown. Không ném lỗi — trả về best-effort; caller kiểm
 * `title` rỗng để cảnh báo.
 */
export function parseCustomMarkdown(md: string): ParsedCustomEntry {
  const src = md.replace(/\r\n?/g, "\n");
  const lines = src.split("\n");

  let title = "";
  const intro: string[] = [];
  const sections: CustomSection[] = [];
  let faq: CustomFaq[] = [];

  let cur: { heading: string; body: string[] } | null = null;
  let inFence = false;
  let seenH1 = false;

  const flush = () => {
    if (!cur) return;
    const rawBody = cur.body.join("\n");
    if (FAQ_HEADINGS.has(deburr(cur.heading))) {
      const parsed = parseFaq(rawBody);
      if (parsed.length) {
        faq = faq.concat(parsed);
        cur = null;
        return;
      }
      // Không tách được câu hỏi → giữ như đoạn thường.
    }
    // Tách ảnh TRƯỚC khi làm sạch inline (cleanInline sẽ biến ![](url) thành
    // chú thích, mất mất URL nếu chạy trước).
    const img = extractImage(rawBody);
    const body = normalizeBody(img.body);
    const { image_url, image_caption } = img;
    const sec: CustomSection = { heading: cur.heading, body };
    if (image_url) sec.image_url = image_url;
    if (image_caption) sec.image_caption = image_caption;
    if (sec.heading || sec.body || sec.image_url) sections.push(sec);
    cur = null;
  };

  for (const line of lines) {
    if (/^\s{0,3}```/.test(line)) inFence = !inFence;

    if (!inFence) {
      const h1 = line.match(/^#\s+(.+)$/);
      const h2 = line.match(/^##\s+(.+)$/);
      if (h1 && !seenH1) {
        title = cleanInline(h1[1]).trim();
        seenH1 = true;
        continue;
      }
      if (h2) {
        flush();
        cur = { heading: cleanInline(h2[1]).trim(), body: [] };
        continue;
      }
    }

    if (cur) cur.body.push(line);
    else if (seenH1 || line.trim()) intro.push(line);
  }
  flush();

  return {
    title,
    short_description: normalizeBody(intro.join("\n")),
    sections,
    faq,
  };
}

/**
 * Tách một tài liệu nhiều bài thành từng khối theo H1 (`# `). Mỗi khối bắt đầu
 * ở một dòng H1 và gồm toàn bộ nội dung tới H1 kế tiếp. Bỏ qua nội dung trước
 * H1 đầu tiên. Có nhận biết code-fence để không cắt nhầm.
 */
export function splitMarkdownEntries(md: string): string[] {
  const src = md.replace(/\r\n?/g, "\n");
  const lines = src.split("\n");
  const chunks: string[] = [];
  let cur: string[] | null = null;
  let inFence = false;
  for (const line of lines) {
    if (/^\s{0,3}```/.test(line)) inFence = !inFence;
    if (!inFence && /^#\s+.+$/.test(line)) {
      if (cur) chunks.push(cur.join("\n").trim());
      cur = [line];
    } else if (cur) {
      cur.push(line);
    }
  }
  if (cur) chunks.push(cur.join("\n").trim());
  return chunks.filter(Boolean);
}
