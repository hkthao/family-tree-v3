/**
 * Bài Sổ tay Văn hoá / Blog cho token admin: AI viết bài rồi ĐĂNG thay admin hệ thống.
 *
 * Bài nằm ở kho tệp `content-site/content/so-tay/*.md` (không còn trong DB). Đăng = commit tệp .md qua GitHub API, rồi nếu công
 * khai thì chạy workflow deploy — dùng chung lõi với edge function `publish-so-tay` (validate, dựng khuôn, chặn mã nguy hiểm,
 * từ chối ghi đè bài giàu nội dung).
 *
 * Cấu hình CỦA MÁY CHỦ MCP (biến môi trường, KHÔNG đưa giá trị thật vào repo):
 *   GITHUB_TOKEN            fine-grained token chỉ cho repo này: Contents = Read and write, Actions = Read and write
 *   GITHUB_REPO             "chủ/tên-repo"
 *   GITHUB_BRANCH           mặc định main
 *   GITHUB_DEPLOY_WORKFLOW  mặc định deploy-vps.yml
 * Chưa cấu hình thì các tool này trả thông báo rõ ràng, không đụng gì khác của MCP.
 *
 * An toàn: chỉ ghi được vào đúng thư mục CONTENT_DIR (slug được kiểm chặt), nội dung bị chặn script/iframe/onclick; đăng CÔNG KHAI
 * bắt buộc confirm=true + reason (ghi vào mcp_admin_log); lưu "needs_review" không hiện ra ngoài và không deploy.
 */

import {
  CONTENT_DIR,
  buildFile,
  dispatchDeploy,
  existingFile,
  gh,
  isRichArticle,
  putFile,
  validate,
  type GithubConfig,
} from "../../supabase/functions/publish-so-tay/core.ts";
import type { AdminCtx } from "./admin.ts";
import { requireConfirm, UserError } from "./fields.ts";

type Args = Record<string, unknown>;

export function githubConfig(env: Record<string, string | undefined> = process.env): GithubConfig {
  const cfg: GithubConfig = {
    token: env.GITHUB_TOKEN ?? "",
    repo: env.GITHUB_REPO ?? "",
    branch: env.GITHUB_BRANCH || "main",
    workflow: env.GITHUB_DEPLOY_WORKFLOW || "deploy-vps.yml",
  };
  if (!cfg.token || !/^[\w.-]+\/[\w.-]+$/.test(cfg.repo)) {
    throw new UserError("Máy chủ MCP chưa được cấu hình đăng bài (thiếu GITHUB_TOKEN hoặc GITHUB_REPO). Báo người quản trị hệ thống.");
  }
  return cfg;
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const slugArg = (v: unknown): string => {
  if (typeof v !== "string" || !SLUG_RE.test(v) || v.length < 3 || v.length > 80) throw new UserError("slug không hợp lệ (chữ thường không dấu, số và dấu gạch ngang).");
  return v;
};

function front(text: string, key: string): string {
  const m = text.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return m ? m[1].trim().replace(/^"(.*)"$/, "$1") : "";
}

export async function listArticles(_c: AdminCtx, a: Args): Promise<string> {
  const cfg = githubConfig();
  const res = await gh(cfg, `/contents/${CONTENT_DIR}?ref=${encodeURIComponent(cfg.branch)}`, { method: "GET" }, fetch);
  if (!res.ok) throw new UserError(`Không đọc được danh sách bài (GitHub ${res.status}).`);
  const files = ((await res.json()) as Array<{ name: string; type: string }>).filter((f) => f.type === "file" && f.name.endsWith(".md"));
  const q = typeof a.q === "string" ? a.q.trim().toLowerCase() : "";
  const names = files.map((f) => f.name.replace(/\.md$/, "")).filter((s) => !q || s.includes(q)).slice(0, 80);
  if (!names.length) return "Không có bài nào.";
  const rows = await Promise.all(
    names.map(async (slug) => {
      const f = await existingFile(cfg, `${CONTENT_DIR}/${slug}.md`).catch(() => null);
      const t = f?.text ?? "";
      return `${slug} · ${front(t, "status") || "?"} · ${front(t, "category") || "?"} · ${front(t, "title")}${isRichArticle(t) ? " · [giàu nội dung: chỉ sửa trong tệp]" : ""}`;
    }),
  );
  return rows.join("\n");
}

export async function getArticle(_c: AdminCtx, a: Args): Promise<string> {
  const cfg = githubConfig();
  const slug = slugArg(a.slug);
  const f = await existingFile(cfg, `${CONTENT_DIR}/${slug}.md`);
  if (!f) throw new UserError(`Không có bài "${slug}".`);
  return f.text.length > 60_000 ? `${f.text.slice(0, 60_000)}\n…(cắt bớt)` : f.text;
}

export async function publishArticle(c: AdminCtx, a: Args): Promise<string> {
  const cfg = githubConfig();
  const v = validate({ ...a, status: a.status ?? "needs_review" });
  if (!v.ok) throw new UserError(v.error);
  const art = v.value;
  if (art.status === "published") requireConfirm(a);
  const path = `${CONTENT_DIR}/${art.slug}.md`;
  const existing = await existingFile(cfg, path);
  if (existing && isRichArticle(existing.text)) {
    throw new UserError(`Bài "${art.slug}" có thông tin nhanh/ảnh/FAQ/nguồn mà công cụ này không giữ được — sửa trực tiếp trong tệp .md, hoặc dùng tiêu đề/slug khác để tạo bài mới.`);
  }
  if (existing && !art.overwrite) throw new UserError(`Đã có bài "${art.slug}". Đặt overwrite=true nếu thật sự muốn thay bài cũ (dùng admin_get_article để xem trước).`);
  const today = new Date().toISOString().slice(0, 10);
  const verb = art.status === "published" ? "đăng" : "lưu chờ duyệt";
  const { commitUrl } = await putFile(cfg, path, buildFile(art, today), `content(so-tay): ${verb} "${art.title}" (qua MCP, admin ${c.userId.slice(0, 8)})`, existing?.sha ?? null);
  if (art.status !== "published") return `Đã lưu bài "${art.title}" ở dạng CHỜ DUYỆT (slug ${art.slug}), chưa hiện ra web/app. Commit: ${commitUrl}`;
  try {
    await dispatchDeploy(cfg);
    return `Đã đăng bài "${art.title}" (slug ${art.slug}) — đang deploy, hiện ra web và app sau vài phút. Commit: ${commitUrl}`;
  } catch (e) {
    return `Đã commit bài "${art.title}" (slug ${art.slug}) nhưng CHƯA chạy được deploy: ${(e as Error).message}. Chạy deploy-vps thủ công. Commit: ${commitUrl}`;
  }
}
