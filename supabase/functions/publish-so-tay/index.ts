/**
 * publish-so-tay: admin nền tảng soạn bài Sổ tay trong app rồi "Đăng" — hàm commit tệp .md vào repo (content-site) qua
 * GitHub API và (khi đăng công khai) chạy workflow deploy để cả web lẫn app cập nhật.
 *
 * Quyền: chỉ platform admin (JWT người gọi + profiles.is_platform_admin, như admin-action).
 * Cấu hình (biến môi trường của hàm, KHÔNG đặt vào repo):
 *   GITHUB_TOKEN            fine-grained token cho đúng repo: Contents = Read and write, Actions = Read and write
 *   GITHUB_REPO             "chủ/tên-repo"
 *   GITHUB_BRANCH           mặc định main
 *   GITHUB_DEPLOY_WORKFLOW  mặc định deploy-vps.yml
 *
 * Request: POST JSON { title, description, category, tags?, aliases?, regions?, timing?, body, status, overwrite? }
 *   status "needs_review" → chỉ lưu, không deploy; "published" → lưu rồi chạy deploy.
 * Response: { slug, path, commitUrl, deploying, deployError? } hoặc { error, code? } (code "exists" = trùng bài, cần overwrite).
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

import { err, json, preflight } from "../_shared/cors.ts";
import { buildFile, CONTENT_DIR, dispatchDeploy, existingFile, isRichArticle, putFile, validate, type GithubConfig } from "./core.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return err("Method not allowed", 405);

  // 1. Người gọi phải là admin nền tảng.
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return err("Cần đăng nhập.", 401);
  const callerSb = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userResp, error: userErr } = await callerSb.auth.getUser(token);
  if (userErr || !userResp.user) return err("Phiên đăng nhập không hợp lệ, hãy đăng nhập lại.", 401);
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: prof, error: profErr } = await sb
    .from("profiles")
    .select("is_platform_admin, is_suspended")
    .eq("id", userResp.user.id)
    .maybeSingle();
  if (profErr) return err("Không kiểm tra được quyền.", 500);
  if (!prof?.is_platform_admin || prof.is_suspended) return err("Chỉ quản trị nền tảng được đăng bài Sổ tay.", 403);

  // 2. Cấu hình GitHub.
  const cfg: GithubConfig = {
    token: Deno.env.get("GITHUB_TOKEN") ?? "",
    repo: Deno.env.get("GITHUB_REPO") ?? "",
    branch: Deno.env.get("GITHUB_BRANCH") || "main",
    workflow: Deno.env.get("GITHUB_DEPLOY_WORKFLOW") || "deploy-vps.yml",
  };
  if (!cfg.token || !/^[\w.-]+\/[\w.-]+$/.test(cfg.repo)) {
    return err("Máy chủ chưa được cấu hình để đăng bài (thiếu GITHUB_TOKEN hoặc GITHUB_REPO). Hãy báo người quản trị hệ thống.", 503);
  }

  // 3. Kiểm tra dữ liệu.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return err("Dữ liệu gửi lên không đọc được.", 400);
  }
  const v = validate(raw);
  if (!v.ok) return err(v.error, 400);
  const a = v.value;
  const path = `${CONTENT_DIR}/${a.slug}.md`;

  try {
    // 4. Có sẵn thì chỉ ghi đè khi được phép.
    const existing = await existingFile(cfg, path);
    const sha = existing?.sha ?? null;
    if (existing && isRichArticle(existing.text)) {
      return json({ error: "Bài này có thông tin nhanh, ảnh, câu hỏi hoặc nguồn mà trang soạn nhanh không giữ được. Hãy sửa bài ở CMS (/admin) hoặc đổi tiêu đề để tạo bài mới.", code: "rich", slug: a.slug }, { status: 409 });
    }
    if (existing && !a.overwrite) {
      return json({ error: "Đã có bài cùng địa chỉ này. Bấm đồng ý ghi đè nếu muốn thay bài cũ.", code: "exists", slug: a.slug }, { status: 409 });
    }
    // 5. Commit.
    const today = new Date().toISOString().slice(0, 10);
    const verb = a.status === "published" ? "đăng" : "lưu chờ duyệt";
    const { commitUrl } = await putFile(cfg, path, buildFile(a, today), `content(so-tay): ${verb} "${a.title}"`, sha);
    // 6. Deploy khi đăng công khai. Commit đã xong thì lỗi deploy chỉ báo kèm, không coi là thất bại.
    let deploying = false;
    let deployError: string | undefined;
    if (a.status === "published") {
      try {
        await dispatchDeploy(cfg);
        deploying = true;
      } catch (e) {
        deployError = (e as Error).message;
      }
    }
    return json({ slug: a.slug, path, commitUrl, deploying, ...(deployError ? { deployError } : {}) });
  } catch (e) {
    console.error("publish-so-tay", (e as Error).message);
    return err("Không đăng được bài lên kho nội dung. Thử lại sau ít phút hoặc báo người quản trị.", 502);
  }
});
