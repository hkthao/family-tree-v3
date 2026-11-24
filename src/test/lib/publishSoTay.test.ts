import { describe, expect, it, vi } from "vitest";

import { buildMarkdownFile, EMPTY_DRAFT } from "@/lib/customs/compose";
import {
  buildFile,
  CONTENT_DIR,
  dispatchDeploy,
  existingFile,
  isRichArticle,
  putFile,
  slugOf,
  validate,
  type GithubConfig,
} from "../../../supabase/functions/publish-so-tay/core";

const OK = {
  title: "Lễ nhập trạch (về nhà mới)",
  description: "Lễ trình báo Thổ Công khi dọn đến nơi ở mới, cầu bình an.",
  category: "tho_cung",
  tags: ["Miền Bắc", " Gia đình "],
  aliases: ["nhà mới"],
  regions: ["Miền Bắc"],
  timing: "Chọn ngày giờ hợp tuổi",
  body: "## Ý nghĩa\n\nNội dung",
  status: "published",
};

describe("publish-so-tay: kiểm tra dữ liệu", () => {
  it("nhận bài hợp lệ, tự tạo slug không dấu", () => {
    const v = validate(OK);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.value.slug).toBe("le-nhap-trach");
      expect(v.value.tags).toEqual(["Miền Bắc", "Gia đình"]);
      expect(v.value.overwrite).toBe(false);
    }
  });

  it("từ chối thiếu/sai trường", () => {
    expect(validate(null).ok).toBe(false);
    expect(validate({ ...OK, title: "" }).ok).toBe(false);
    expect(validate({ ...OK, description: "ngắn" }).ok).toBe(false);
    expect(validate({ ...OK, category: "khac" }).ok).toBe(false);
    expect(validate({ ...OK, body: "  " }).ok).toBe(false);
    expect(validate({ ...OK, status: "draft" }).ok).toBe(false);
  });

  it("chặn script/iframe/onclick/javascript: và slug lạ, slug dành riêng", () => {
    for (const bad of ["<script>x</script>", "<IFRAME src=x>", '<a onclick="x">a</a>', "[a](javascript:alert(1))"]) {
      expect(validate({ ...OK, body: `## A\n\n${bad}` }).ok).toBe(false);
    }
    expect(validate({ ...OK, slug: "../etc" }).ok).toBe(false);
    expect(validate({ ...OK, slug: "index" }).ok).toBe(false);
    expect(validate({ ...OK, title: "!!!", slug: undefined }).ok).toBe(false);
  });

  it("slugOf bỏ dấu và phần trong ngoặc", () => {
    expect(slugOf("Đền Hùng: Giỗ Tổ")).toBe("den-hung-gio-to");
  });
});

describe("publish-so-tay: dựng tệp", () => {
  it("khớp với bản dựng tệp ở phía app (chỉ khác status)", () => {
    const draft = { ...EMPTY_DRAFT, title: 'Lễ "Vu Lan": báo hiếu', description: "Mô tả đủ dài để qua kiểm tra.", tags: "Miền Bắc, Hà Nội", aliases: "a, b", regions: "Miền Bắc", timing: "Rằm", category: "le_tet" as const, body: "## Ý\n\nNội dung" };
    const app = buildMarkdownFile(draft, "2026-11-25");
    const server = buildFile(
      { title: draft.title, description: draft.description, category: draft.category, tags: ["Miền Bắc", "Hà Nội"], aliases: ["a", "b"], regions: ["Miền Bắc"], timing: "Rằm", body: draft.body, status: "needs_review" },
      "2026-11-25",
    );
    expect(server).toBe(app);
  });
});

const CFG: GithubConfig = { token: "tok", repo: "owner/repo", branch: "main", workflow: "deploy-vps.yml" };
const res = (status: number, body: unknown = {}) => new Response(status === 204 ? null : JSON.stringify(body), { status });

describe("publish-so-tay: GitHub", () => {
  it("existingFile: 404 → null, 200 → sha + nội dung giải mã UTF-8", async () => {
    expect(await existingFile(CFG, "a.md", vi.fn(async () => res(404)) as unknown as typeof fetch)).toBeNull();
    const b64 = btoa(String.fromCharCode(...new TextEncoder().encode("Tiếng Việt")));
    const r = await existingFile(CFG, "a.md", vi.fn(async () => res(200, { sha: "abc", content: `${b64.slice(0, 8)}\n${b64.slice(8)}` })) as unknown as typeof fetch);
    expect(r).toEqual({ sha: "abc", text: "Tiếng Việt" });
  });

  it("isRichArticle: nhận ra bài có infobox/ảnh/FAQ/nguồn, bỏ qua danh sách rỗng", () => {
    expect(isRichArticle("---\ntitle: x\ninfobox:\n  - label: a\n---")).toBe(true);
    expect(isRichArticle("---\nfaq:\n  - q: a\n---")).toBe(true);
    expect(isRichArticle("---\ntags: []\naliases: []\nregions: []\n---\n\n## A")).toBe(false);
  });

  it("putFile: gửi nội dung base64 UTF-8, nhánh, sha cũ và token", async () => {
    const f = vi.fn(async () => res(201, { commit: { html_url: "https://github.com/x/commit/1" } }));
    const r = await putFile(CFG, `${CONTENT_DIR}/a.md`, "Tiếng Việt ✓", "msg", "oldsha", f as unknown as typeof fetch);
    expect(r.commitUrl).toBe("https://github.com/x/commit/1");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.github.com/repos/owner/repo/contents/${CONTENT_DIR}/a.md`);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ message: "msg", branch: "main", sha: "oldsha" });
    expect(new TextDecoder().decode(Uint8Array.from(atob(body.content), (c) => c.charCodeAt(0)))).toBe("Tiếng Việt ✓");
  });

  it("putFile lỗi 409 báo rõ; dispatchDeploy chỉ chấp nhận 204", async () => {
    await expect(putFile(CFG, "a.md", "x", "m", null, vi.fn(async () => res(409)) as unknown as typeof fetch)).rejects.toThrow(/409/);
    await expect(dispatchDeploy(CFG, vi.fn(async () => res(204)) as unknown as typeof fetch)).resolves.toBeUndefined();
    await expect(dispatchDeploy(CFG, vi.fn(async () => res(403)) as unknown as typeof fetch)).rejects.toThrow(/403/);
  });
});

describe("danh mục Blog đồng bộ giữa app, hàm đăng bài và content-site", () => {
  it("cùng một danh sách ở ba nơi", async () => {
    const { BLOG_CATEGORIES } = await import("@/lib/customs/compose");
    const { CATEGORIES } = await import("../../../supabase/functions/publish-so-tay/core");
    const { readFileSync } = await import("node:fs");
    const tax = readFileSync("content-site/src/taxonomy.ts", "utf8");
    const fromTaxonomy = [...tax.matchAll(/\{ slug: "([a-z_]+)", channel:/g)].map((m) => m[1]);
    expect(BLOG_CATEGORIES.map((c) => c.value)).toEqual([...CATEGORIES]);
    expect([...CATEGORIES].sort()).toEqual(fromTaxonomy.sort());
  });
});
