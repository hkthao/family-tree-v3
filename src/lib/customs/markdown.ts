// Parse "thân Markdown" thành 1 bài Sổ tay Văn hoá.
//
// Quy ước:
//   ---                  → frontmatter TUỲ CHỌN ở đầu file (category, regions,
//   category: le_tet        mandatory_level, reliability, origins, aliases,
//   ---                     timing, applicable_to, cover_image_url, scope…).
//                           Có thì dùng, không có thì chọn trong app.
//   # Tiêu đề            → title (H1 đầu tiên)
//   đoạn mở đầu          → short_description (mọi dòng trước ## đầu tiên)
//   ## Heading           → 1 đoạn {heading, body}
//   ![chú thích](https)  → ảnh minh hoạ đầu tiên trong đoạn (image_url + image_caption)
//   ## Câu hỏi thường gặp → parse ### thành faq[{q,a}]
//
// Nội dung được render dạng plain-text (whitespace-pre-wrap) nên body chỉ cần
// làm sạch cú pháp inline nhẹ (bỏ **đậm**, [text](url) → text). Không cần AST
// markdown đầy đủ → tránh thêm dependency.

import {
  CUSTOM_CATEGORY_LABEL,
  CUSTOM_MANDATORY_LABEL,
  CUSTOM_ORIGIN_LABEL,
  CUSTOM_SCOPE_LABEL,
  type CustomCategory,
  type CustomFaq,
  type CustomMandatory,
  type CustomOrigin,
  type CustomScope,
  type CustomSection,
} from "@/lib/queries/customs";

/** Metadata tuỳ chọn lấy từ frontmatter (chỉ các trường hợp lệ mới có mặt). */
export interface ParsedMeta {
  category?: CustomCategory;
  regions?: string[];
  aliases?: string[];
  origins?: CustomOrigin[];
  mandatory_level?: CustomMandatory;
  scope?: CustomScope;
  reliability?: number;
  lunar_month?: number;
  timing?: string;
  applicable_to?: string;
  cover_image_url?: string;
  sources?: string;
}

export interface ParsedCustomEntry {
  title: string;
  short_description: string;
  sections: CustomSection[];
  faq: CustomFaq[];
  /** Từ frontmatter; rỗng nếu không có frontmatter. */
  meta: ParsedMeta;
}

// ─── Frontmatter (tuỳ chọn) ─────────────────────────────────────────────────

/** Tách khối frontmatter `---\n…\n---` ở đầu (nếu có) khỏi thân. */
function splitFrontmatter(src: string): { fm: string | null; body: string } {
  const m = src.match(/^﻿?---[ \t]*\n([\s\S]*?)\n---[ \t]*\n?/);
  if (!m) return { fm: null, body: src };
  return { fm: m[1], body: src.slice(m[0].length) };
}

/** Parse các dòng `key: value` trong frontmatter thành map (key thường hoá). */
function parseFmLines(fm: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of fm.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (m) out[m[1].toLowerCase()] = m[2].trim();
  }
  return out;
}

const fmNorm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .toLowerCase()
    .trim();

/** Chuỗi → mảng: chấp nhận `[a, b]` hoặc `a, b`; bỏ nháy quanh phần tử. */
function fmArray(v: string | undefined): string[] | undefined {
  if (!v) return undefined;
  let s = v.trim();
  if (s.startsWith("[") && s.endsWith("]")) s = s.slice(1, -1);
  const arr = s
    .split(",")
    .map((x) => x.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
  return arr.length ? arr : undefined;
}

/** Khớp giá trị (key enum HOẶC nhãn tiếng Việt) → key enum. */
function fmEnum<T extends string>(
  v: string | undefined,
  labels: Record<T, string>,
): T | undefined {
  if (!v) return undefined;
  const n = fmNorm(v.replace(/^["']|["']$/g, ""));
  for (const key of Object.keys(labels) as T[]) {
    if (fmNorm(key) === n || fmNorm(labels[key]) === n) return key;
  }
  return undefined;
}

/** Chuyển map frontmatter thô → ParsedMeta đã kiểm tra enum/số/https. */
function buildMeta(raw: Record<string, string>): ParsedMeta {
  const meta: ParsedMeta = {};
  const cat = fmEnum(raw.category ?? raw.chu_de, CUSTOM_CATEGORY_LABEL);
  if (cat) meta.category = cat;

  const regions = fmArray(raw.regions ?? raw.vung_mien);
  if (regions) meta.regions = regions;

  const aliases = fmArray(raw.aliases ?? raw.ten_goi_khac);
  if (aliases) meta.aliases = aliases;

  const originsRaw = fmArray(raw.origins ?? raw.nguon_goc);
  if (originsRaw) {
    const os = originsRaw
      .map((o) => fmEnum(o, CUSTOM_ORIGIN_LABEL))
      .filter((o): o is CustomOrigin => !!o);
    if (os.length) meta.origins = os;
  }

  const mand = fmEnum(raw.mandatory_level ?? raw.muc_bat_buoc, CUSTOM_MANDATORY_LABEL);
  if (mand) meta.mandatory_level = mand;

  const scope = fmEnum(raw.scope ?? raw.pham_vi, CUSTOM_SCOPE_LABEL);
  if (scope) meta.scope = scope;

  const rel = Number(raw.reliability ?? raw.do_tin_cay);
  if (Number.isInteger(rel) && rel >= 1 && rel <= 5) meta.reliability = rel;

  const lunar = Number(raw.lunar_month ?? raw.thang_am_lich);
  if (Number.isInteger(lunar) && lunar >= 1 && lunar <= 12) meta.lunar_month = lunar;

  if (raw.timing) meta.timing = raw.timing;
  if (raw.applicable_to ?? raw.doi_tuong) meta.applicable_to = raw.applicable_to ?? raw.doi_tuong;
  if (raw.cover_image_url && /^https:\/\//i.test(raw.cover_image_url))
    meta.cover_image_url = raw.cover_image_url.trim();
  if (raw.sources ?? raw.nguon) meta.sources = raw.sources ?? raw.nguon;
  return meta;
}

// ─── Thân bài ───────────────────────────────────────────────────────────────

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
  const raw = md.replace(/\r\n?/g, "\n");
  const { fm, body } = splitFrontmatter(raw);
  const meta = fm ? buildMeta(parseFmLines(fm)) : {};
  const src = body;
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
    meta,
  };
}

/**
 * Thân markdown không có ảnh bìa riêng → lấy ảnh MINH HOẠ đầu tiên làm ảnh
 * bìa (để card danh sách có hình), đồng thời gỡ ảnh đó khỏi đoạn để trang xem
 * không hiện trùng (bìa ở đầu + lại trong đoạn). Trả về cover + sections mới.
 */
export function extractCoverImage(sections: CustomSection[]): {
  cover_image_url: string | null;
  sections: CustomSection[];
} {
  const idx = sections.findIndex((s) => s.image_url);
  if (idx === -1) return { cover_image_url: null, sections };
  const cover_image_url = sections[idx].image_url ?? null;
  const trimmed = sections.map((s, i) =>
    i === idx ? { heading: s.heading, body: s.body } : s,
  );
  return { cover_image_url, sections: trimmed };
}

/**
 * Tách một tài liệu nhiều bài thành từng khối. Mỗi bài bắt đầu ở **khối
 * frontmatter mở** (`---` theo sau là dòng `key:`) HOẶC ở **H1** (`# `) nếu bài
 * không có frontmatter. Bỏ nội dung trước bài đầu. Nhận biết code-fence và
 * không nhầm `---` gạch ngang trong thân (vì đòi hỏi dòng kế là `key:`).
 */
export function splitMarkdownEntries(md: string): string[] {
  const src = md.replace(/\r\n?/g, "\n");
  const lines = src.split("\n");
  const chunks: string[] = [];
  let cur: string[] | null = null;
  let inFence = false;
  let inFm = false;
  const isFmKey = (l: string | undefined) => !!l && /^\s*[A-Za-z_][\w]*\s*:/.test(l);
  const push = () => {
    if (cur) chunks.push(cur.join("\n").trim());
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s{0,3}```/.test(line)) inFence = !inFence;

    if (!inFence && !inFm && line.trim() === "---" && isFmKey(lines[i + 1])) {
      // Mở frontmatter → bắt đầu bài mới.
      push();
      cur = [line];
      inFm = true;
      continue;
    }
    if (!inFence && inFm && line.trim() === "---") {
      inFm = false;
      if (cur) cur.push(line);
      continue;
    }
    if (!inFence && !inFm && /^#\s+.+$/.test(line)) {
      // H1: bài mới, TRỪ khi khối hiện tại vừa mở bằng frontmatter và chưa có H1.
      const curHasH1 = cur?.some((l) => /^#\s+.+$/.test(l));
      if (!cur || curHasH1) {
        push();
        cur = [line];
      } else {
        cur.push(line);
      }
      continue;
    }
    if (cur) cur.push(line);
  }
  push();
  return chunks.filter(Boolean);
}
