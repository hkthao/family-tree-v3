/**
 * Lõi thuần của publish-so-tay: kiểm tra dữ liệu bài, dựng tệp Markdown đúng khuôn content-site, gọi GitHub (commit + chạy
 * deploy). Không đụng Deno/Supabase nên test được bằng vitest (src/test/lib/publishSoTay.test.ts).
 */

export const CATEGORIES = ["tho_cung", "vong_doi", "le_tet", "le_hoi", "sinh_hoat", "van_khan"] as const;
export type Category = (typeof CATEGORIES)[number];
export type PublishStatus = "needs_review" | "published";

export interface PublishInput {
  title: string;
  description: string;
  category: Category;
  tags?: string[];
  aliases?: string[];
  regions?: string[];
  timing?: string;
  body: string;
  /** needs_review: chỉ lưu vào kho, chưa hiện ra web/app, không deploy. published: hiện ra và chạy deploy. */
  status: PublishStatus;
  /** Cho phép ghi đè bài đã có cùng slug. Mặc định từ chối để khỏi đè mất bài người khác. */
  overwrite?: boolean;
  slug?: string;
}

export const CONTENT_DIR = "content-site/content/so-tay";
const RESERVED = new Set(["index", "fulltext"]);
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Nội dung do admin viết nhưng vẫn chặn các mẫu nguy hiểm để lỡ tay dán từ nguồn lạ cũng không lên web.
const DANGEROUS = /<\s*(script|iframe|object|embed|style|link|meta|form)\b|javascript\s*:|\son[a-z]+\s*=/i;

export function slugOf(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const list = (a: unknown, max = 30, len = 80): string[] =>
  (Array.isArray(a) ? a : []).map((x) => String(x).trim()).filter(Boolean).slice(0, max).map((x) => x.slice(0, len));

export type Validated = { ok: true; value: Required<Omit<PublishInput, "timing" | "overwrite" | "slug">> & { timing: string; overwrite: boolean; slug: string } } | { ok: false; error: string };

export function validate(raw: unknown): Validated {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Dữ liệu bài không hợp lệ." };
  const r = raw as Record<string, unknown>;
  const title = String(r.title ?? "").trim();
  const description = String(r.description ?? "").trim();
  const body = String(r.body ?? "").trim();
  const timing = String(r.timing ?? "").trim().slice(0, 200);
  if (!title || title.length > 140) return { ok: false, error: "Tiêu đề cần từ 1 đến 140 ký tự." };
  if (description.length < 20 || description.length > 320) return { ok: false, error: "Mô tả cần từ 20 đến 320 ký tự." };
  if (!(CATEGORIES as readonly string[]).includes(String(r.category))) return { ok: false, error: "Chủ đề không hợp lệ." };
  if (!body) return { ok: false, error: "Nội dung bài đang trống." };
  if (body.length > 200_000) return { ok: false, error: "Nội dung quá dài." };
  if (DANGEROUS.test(`${title}\n${description}\n${body}\n${timing}`)) {
    return { ok: false, error: "Nội dung có đoạn mã không được phép (script, iframe, onclick…). Hãy xoá đoạn đó." };
  }
  if (r.status !== "needs_review" && r.status !== "published") return { ok: false, error: "Trạng thái không hợp lệ." };
  const slug = String(r.slug ?? "").trim() || slugOf(title);
  if (!SLUG_RE.test(slug) || slug.length > 80 || slug.length < 3 || RESERVED.has(slug)) {
    return { ok: false, error: "Không tạo được địa chỉ bài từ tiêu đề. Hãy đổi tiêu đề (chỉ cần có chữ cái)." };
  }
  return {
    ok: true,
    value: {
      title,
      description,
      category: r.category as Category,
      tags: list(r.tags),
      aliases: list(r.aliases),
      regions: list(r.regions),
      timing,
      body,
      status: r.status,
      overwrite: r.overwrite === true,
      slug,
    },
  };
}

const y = (s: string) => JSON.stringify(s);

/** Phải ra đúng như buildMarkdownFile ở src/lib/customs/compose.ts (có test so khớp), chỉ khác status. */
export function buildFile(v: { title: string; description: string; category: string; tags: string[]; aliases: string[]; regions: string[]; timing: string; body: string; status: string }, today: string): string {
  const arr = (a: string[]) => `[${a.map(y).join(", ")}]`;
  return [
    "---",
    `status: ${v.status}`,
    `title: ${y(v.title)}`,
    `description: ${y(v.description)}`,
    `updated: ${today}`,
    `category: ${v.category}`,
    `tags: ${arr(v.tags)}`,
    `aliases: ${arr(v.aliases)}`,
    `regions: ${arr(v.regions)}`,
    ...(v.timing ? [`timing: ${y(v.timing)}`] : []),
    "---",
    "",
    v.body.trim(),
    "",
  ].join("\n");
}

// ── GitHub ─────────────────────────────────────────────────────────────────

export interface GithubConfig {
  token: string;
  /** "chủ/tên-repo" */
  repo: string;
  branch: string;
  workflow: string;
}

type Fetch = typeof fetch;

const gh = (cfg: GithubConfig, path: string, init: RequestInit, f: Fetch) =>
  f(`https://api.github.com/repos/${cfg.repo}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "dong-ho-viet-publish",
      ...(init.headers ?? {}),
    },
  });

const toBase64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

/** sha + nội dung của tệp hiện có trên nhánh, hoặc null nếu chưa có. */
export async function existingFile(cfg: GithubConfig, path: string, f: Fetch = fetch): Promise<{ sha: string; text: string } | null> {
  const res = await gh(cfg, `/contents/${path}?ref=${encodeURIComponent(cfg.branch)}`, { method: "GET" }, f);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub đọc tệp lỗi ${res.status}`);
  const j = (await res.json()) as { sha?: string; content?: string };
  if (!j.sha) return null;
  let text = "";
  try {
    text = new TextDecoder().decode(Uint8Array.from(atob((j.content ?? "").replace(/\s/g, "")), (c) => c.charCodeAt(0)));
  } catch {
    /* nội dung không đọc được: coi như rỗng, bước kiểm tra "giàu nội dung" sẽ bỏ qua */
  }
  return { sha: j.sha, text };
}

/**
 * Bài có các trường nâng cao (thông tin nhanh, ảnh có ghi công, FAQ, nguồn, bài liên quan) mà trang soạn nhanh không tạo
 * được: ghi đè sẽ làm mất chúng, nên từ chối và hướng sang CMS.
 */
export function isRichArticle(text: string): boolean {
  return /^(infobox|images|faq|sources|related):\s*$/m.test(text);
}

export async function putFile(
  cfg: GithubConfig,
  path: string,
  content: string,
  message: string,
  sha: string | null,
  f: Fetch = fetch,
): Promise<{ commitUrl: string }> {
  const res = await gh(
    cfg,
    `/contents/${path}`,
    { method: "PUT", body: JSON.stringify({ message, content: toBase64(content), branch: cfg.branch, ...(sha ? { sha } : {}) }) },
    f,
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`GitHub ghi tệp lỗi ${res.status}${res.status === 409 ? " (có người vừa sửa tệp này, thử lại)" : ""} ${detail.slice(0, 120)}`);
  }
  const j = (await res.json()) as { commit?: { html_url?: string } };
  return { commitUrl: j.commit?.html_url ?? "" };
}

export async function dispatchDeploy(cfg: GithubConfig, f: Fetch = fetch): Promise<void> {
  const res = await gh(cfg, `/actions/workflows/${encodeURIComponent(cfg.workflow)}/dispatches`, { method: "POST", body: JSON.stringify({ ref: cfg.branch }) }, f);
  if (res.status !== 204) throw new Error(`GitHub chạy deploy lỗi ${res.status}`);
}
