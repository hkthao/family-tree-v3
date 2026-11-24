import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { githubConfig, getArticle, listArticles, publishArticle } from "../../../mcp-server/src/articles";
import { ADMIN_OPS, createAnnouncement } from "../../../mcp-server/src/admin";
import { MCP_ADMIN_TOOLS } from "../../../mcp-server/src/specs";

const ctx = { userId: "11111111-2222-3333-4444-555555555555" } as never;
const GOOD = {
  title: "Cúng rằm tháng Giêng",
  description: "Lễ cúng rằm tháng Giêng (Thượng nguyên): thời điểm, lễ vật và ý nghĩa.",
  category: "le_tet",
  body: "## Ý nghĩa\n\nRằm tháng Giêng là rằm đầu tiên của năm.",
};

type Call = { url: string; method: string; body?: Record<string, unknown> };
let calls: Call[];
/** Kho GitHub giả: path → nội dung. */
let repo: Record<string, string>;

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? "GET";
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method, body });
      const path = decodeURIComponent(url.replace(/^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+/, "").replace(/\?.*$/, ""));
      if (path.startsWith("/actions/workflows/")) return new Response(null, { status: 204 });
      const file = path.replace("/contents/", "");
      if (method === "PUT") {
        repo[file] = Buffer.from(String(body?.content), "base64").toString("utf8");
        return new Response(JSON.stringify({ commit: { html_url: "https://example.test/c/1" } }), { status: 200 });
      }
      if (file.endsWith("/so-tay")) {
        return new Response(JSON.stringify(Object.keys(repo).map((k) => ({ name: k.split("/").pop(), type: "file" }))), { status: 200 });
      }
      if (!(file in repo)) return new Response("", { status: 404 });
      return new Response(JSON.stringify({ sha: "abc", content: Buffer.from(repo[file]).toString("base64") }), { status: 200 });
    }),
  );
}

beforeEach(() => {
  calls = [];
  repo = {};
  process.env.GITHUB_TOKEN = "t";
  process.env.GITHUB_REPO = "owner/repo";
  stubFetch();
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_REPO;
});

describe("MCP admin: viết và đăng bài thay admin", () => {
  it("chưa cấu hình GitHub → báo rõ, không gọi mạng", async () => {
    delete process.env.GITHUB_TOKEN;
    await expect(publishArticle(ctx, GOOD)).rejects.toThrow(/chưa được cấu hình/);
    expect(calls).toHaveLength(0);
    expect(() => githubConfig({ GITHUB_TOKEN: "x", GITHUB_REPO: "không-hợp-lệ" })).toThrow();
  });

  it("mặc định chỉ LƯU CHỜ DUYỆT: commit vào đúng thư mục, không deploy", async () => {
    const out = await publishArticle(ctx, GOOD);
    expect(out).toMatch(/CHỜ DUYỆT/);
    const put = calls.find((c) => c.method === "PUT")!;
    expect(put.url).toContain("/contents/content-site/content/so-tay/cung-ram-thang-gieng.md");
    expect(repo["content-site/content/so-tay/cung-ram-thang-gieng.md"]).toMatch(/^---\nstatus: needs_review\n/);
    expect(calls.some((c) => c.url.includes("/actions/"))).toBe(false);
  });

  it("đăng công khai bắt buộc confirm + reason; có đủ thì commit rồi chạy deploy", async () => {
    await expect(publishArticle(ctx, { ...GOOD, status: "published" })).rejects.toThrow(/confirm=true/);
    await expect(publishArticle(ctx, { ...GOOD, status: "published", confirm: true, reason: "x" })).rejects.toThrow(/reason/);
    expect(calls).toHaveLength(0);
    const out = await publishArticle(ctx, { ...GOOD, status: "published", confirm: true, reason: "Người dùng yêu cầu đăng bài này" });
    expect(out).toMatch(/Đã đăng bài/);
    expect(repo["content-site/content/so-tay/cung-ram-thang-gieng.md"]).toMatch(/^---\nstatus: published\n/);
    expect(calls.some((c) => c.method === "POST" && c.url.includes("/actions/workflows/deploy-vps.yml/dispatches"))).toBe(true);
  });

  it("không ghi đè bài có sẵn nếu thiếu overwrite; bài giàu nội dung không bao giờ bị ghi đè", async () => {
    await publishArticle(ctx, GOOD);
    await expect(publishArticle(ctx, GOOD)).rejects.toThrow(/overwrite=true/);
    await expect(publishArticle(ctx, { ...GOOD, overwrite: true })).resolves.toMatch(/CHỜ DUYỆT/);
    repo["content-site/content/so-tay/cung-ram-thang-gieng.md"] = "---\ntitle: x\ninfobox:\n  a: b\n---\nthân";
    await expect(publishArticle(ctx, { ...GOOD, overwrite: true })).rejects.toThrow(/thông tin nhanh/);
  });

  it("chặn mã nguy hiểm, chủ đề sai, slug thoát thư mục", async () => {
    await expect(publishArticle(ctx, { ...GOOD, body: "<script>alert(1)</script>" })).rejects.toThrow(/không được phép/);
    await expect(publishArticle(ctx, { ...GOOD, category: "khac" })).rejects.toThrow(/Chủ đề/);
    await expect(publishArticle(ctx, { ...GOOD, slug: "../../.github/workflows/x" })).rejects.toThrow();
    await expect(getArticle(ctx, { slug: "../secret" })).rejects.toThrow(/slug/);
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(0);
  });

  it("liệt kê và đọc bài", async () => {
    await publishArticle(ctx, GOOD);
    expect(await listArticles(ctx, {})).toMatch(/cung-ram-thang-gieng · needs_review · le_tet · Cúng rằm tháng Giêng/);
    expect(await listArticles(ctx, { q: "khong-co" })).toBe("Không có bài nào.");
    expect(await getArticle(ctx, { slug: "cung-ram-thang-gieng" })).toContain("Rằm tháng Giêng là rằm đầu tiên");
    await expect(getArticle(ctx, { slug: "khong-co-bai" })).rejects.toThrow(/Không có bài/);
  });

  it("tool được khai báo cho gói admin và có handler", () => {
    for (const n of ["admin_list_articles", "admin_get_article", "admin_publish_article"]) {
      expect(MCP_ADMIN_TOOLS.find((t) => t.name === n)?.needs).toBe("admin");
      expect(ADMIN_OPS[n]).toBeTypeOf("function");
    }
    const props = MCP_ADMIN_TOOLS.find((t) => t.name === "admin_publish_article")!.inputSchema.properties as Record<string, { enum?: string[] }>;
    expect(props.category.enum).toContain("le_tet");
  });
});

describe("MCP admin: đăng thông báo ngay", () => {
  it("publish_now đặt published_at = bây giờ; không có thì vẫn là nháp", async () => {
    const rows: Record<string, unknown>[] = [];
    const db = { from: () => ({ insert: (r: Record<string, unknown>) => (rows.push(r), { select: () => ({ single: async () => ({ data: { id: "i" }, error: null }) }) }) }) };
    const c = { db, userId: "u" } as never;
    await createAnnouncement(c, { title: "t", body: "b", is_public: true, publish_now: true });
    expect(typeof rows[0].published_at).toBe("string");
    await createAnnouncement(c, { title: "t", body: "b" });
    expect(rows[1].published_at).toBeNull();
  });
});
