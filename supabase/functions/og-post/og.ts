/**
 * og-post: thẻ chia sẻ (Open Graph) cho một bài Bảng tin, dành cho TRÌNH QUÉT của Zalo / Facebook / Twitter
 * (docs/plan-trang-dong-ho.md, mục 6b). Trang dòng họ là SPA nên không có thẻ OG theo từng bài; máy chủ web chuyển riêng
 * trình quét sang function này, người thật vẫn nhận ứng dụng. Cổng kiểm tra y hệt share-view?part=post: link còn hiệu
 * lực + loại link xem được cây + mục Bảng tin đang bật + bài đã đăng. Mọi lỗi đều trả 404 trơn, không lộ lý do.
 * Không import Deno-only nên test được bằng vitest.
 */

import { firstImageUrl, postExcerpt } from "../_shared/vendor/postMarkdown.ts";
import { resolveShareAccess } from "../share-view/access.ts";
import { handlePart } from "../share-view/parts.ts";

// deno-lint-ignore no-explicit-any
type Sb = any;

export interface OgEnv {
  /** Gốc địa chỉ công khai của ứng dụng, vd https://example.com (không có dấu / cuối). */
  siteOrigin: string;
  /** Ảnh chung khi bài không có ảnh bìa. */
  defaultImage: string;
  siteName: string;
  /** Gốc URL công khai của bucket card-shares (ảnh OG dòng họ); thiếu thì dùng ảnh chung. */
  cardImageBase?: string;
}

export interface OgParams {
  token: string | null;
  clan: string | null;
  id: string | null;
  /** "person": hồ sơ một người (`id` là id người); "clan": trang chủ dòng họ (không cần id); mặc định là bài Bảng tin. */
  kind?: string | null;
  /** "1": địa chỉ ngắn /s/<mã> (link dành cho Facebook, tránh đường dẫn /share/ mà Facebook đã nhớ là bị robots.txt chặn): og:url trỏ về chính nó. */
  alias?: string | null;
}

export type OgResult = { status: 200; html: string; noindex: boolean } | { status: 404 };

const SITE_SCOPES = ["tree_view", "contribute"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Địa chỉ trang bài trong ứng dụng (đúng địa chỉ người dùng đã chia sẻ). */
export function postPageUrl(origin: string, p: { token: string | null; clan: string | null }, postId: string): string {
  const base = p.token ? `/share/${encodeURIComponent(p.token)}` : `/xem/clans/${encodeURIComponent(p.clan ?? "")}`;
  return `${origin.replace(/\/+$/, "")}${base}/bang-tin/${postId}`;
}

export function buildOgHtml(o: { title: string; description: string; image: string; url: string; siteName: string; noindex: boolean; type?: string; imageSize?: { w: number; h: number } }): string {
  const t = escapeHtml(o.title);
  const d = escapeHtml(o.description);
  const img = escapeHtml(o.image);
  const url = escapeHtml(o.url);
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>${t}</title>
<meta name="description" content="${d}">
${o.noindex ? '<meta name="robots" content="noindex, nofollow">\n' : ""}<meta property="og:type" content="${escapeHtml(o.type ?? "article")}">
<meta property="og:site_name" content="${escapeHtml(o.siteName)}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${img}">
${o.imageSize ? `<meta property="og:image:width" content="${o.imageSize.w}">
<meta property="og:image:height" content="${o.imageSize.h}">
` : ""}
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${img}">
<link rel="canonical" href="${url}">
<meta http-equiv="refresh" content="0;url=${url}">
</head>
<body><p><a href="${url}">${t}</a></p></body>
</html>
`;
}

/** Địa chỉ trang hồ sơ người trong ứng dụng. */
export function personPageUrl(origin: string, p: { token: string | null; clan: string | null }, personId: string): string {
  const base = p.token ? `/share/${encodeURIComponent(p.token)}` : `/xem/clans/${encodeURIComponent(p.clan ?? "")}`;
  return `${origin.replace(/\/+$/, "")}${base}/nguoi/${personId}`;
}

/**
 * Thẻ chia sẻ cho hồ sơ một người. Cổng như share-view?part=person: link hợp lệ (đúng phạm vi cây con), người ĐÃ MẤT;
 * người còn sống → 404 (không lộ tên). Tiểu sử chỉ vào mô tả khi kênh công khai hoặc link có khoá `profiles`.
 * Ảnh luôn là ảnh chung (ảnh người nằm trong bucket riêng, URL ký hết hạn nên không dùng cho thẻ).
 */
async function renderOgPerson(sb: Sb, params: OgParams, env: OgEnv): Promise<OgResult> {
  const { token, clan, id } = params;
  const access = await resolveShareAccess(sb, token, clan);
  if (!access.ok || !SITE_SCOPES.includes(access.link.scope)) return { status: 404 };
  const clanId = access.link.clan_id;
  const { data: clanRow } = await sb.from("clans").select("name, hide_photos_in_share, share_sections").eq("id", clanId).maybeSingle();
  const sections = (clanRow?.share_sections as string[] | null) ?? [];
  const r = await handlePart(
    { sb, clanId, hidePhotos: !!clanRow?.hide_photos_in_share, sections, publicChannel: !token, rootPersonId: access.link.root_person_id ?? null, sign: async () => new Map() },
    "person",
    new URLSearchParams({ id: id! }),
  );
  if (r.status !== 200) return { status: 404 };
  const p = r.body as { living: boolean; full_name?: string; bio?: string | null; profile?: boolean };
  if (p.living) return { status: 404 };
  // Tên người nằm trong payload cây (không có trong phần chi tiết của người đã mất) → đọc riêng.
  const { data: row } = await sb.from("persons").select("full_name, generation").eq("id", id).eq("clan_id", clanId).maybeSingle();
  if (!row) return { status: 404 };
  const clanName = (clanRow?.name as string | null) ?? env.siteName;
  const bio = p.profile && p.bio ? postExcerpt(p.bio, 200) : "";
  return {
    status: 200,
    noindex: !!token,
    html: buildOgHtml({
      title: `${row.full_name} — ${clanName}`,
      description: bio || `Hồ sơ ${row.full_name} trong gia phả ${clanName}.`,
      image: env.defaultImage,
      url: personPageUrl(env.siteOrigin, { token, clan }, id!),
      siteName: env.siteName,
      noindex: !!token,
      type: "profile",
    }),
  };
}

/** Địa chỉ trang chủ dòng họ trong ứng dụng. */
export function clanPageUrl(origin: string, p: { token: string | null; clan: string | null; alias?: boolean }): string {
  if (p.alias && p.token) return `${origin.replace(/\/+$/, "")}/s/${encodeURIComponent(p.token)}`;
  const base = p.token ? `/share/${encodeURIComponent(p.token)}` : `/xem/clans/${encodeURIComponent(p.clan ?? "")}`;
  return `${origin.replace(/\/+$/, "")}${base}`;
}

/**
 * Thẻ chia sẻ cho TRANG CHỦ dòng họ. Cổng như các thẻ khác (link hợp lệ + loại link xem được cây). Chỉ khi admin ĐÃ thiết kế
 * ảnh chia sẻ (clans.share_og_path) mới lộ tên + mô tả + ảnh dòng họ; chưa thiết kế → thẻ chung của ứng dụng, y như trước.
 * Link hỏng / thu hồi → 404 (nginx cho bot vào trang 404, người thật không đi qua đây).
 */
async function renderOgClan(sb: Sb, params: OgParams, env: OgEnv): Promise<OgResult> {
  const { token, clan } = params;
  const access = await resolveShareAccess(sb, token, clan);
  if (!access.ok || !SITE_SCOPES.includes(access.link.scope)) return { status: 404 };
  const { data: c } = await sb.from("clans").select("name, description, share_og_path, share_og_updated_at").eq("id", access.link.clan_id).maybeSingle();
  const path = (c?.share_og_path as string | null) ?? null;
  const url = clanPageUrl(env.siteOrigin, { token, clan, alias: params.alias === "1" });
  if (!c || !path || !env.cardImageBase) {
    return {
      status: 200,
      noindex: !!token,
      html: buildOgHtml({
        title: env.siteName,
        description: "Gia phả dòng họ trên " + env.siteName,
        image: env.defaultImage,
        url,
        siteName: env.siteName,
        noindex: !!token,
        type: "website",
      }),
    };
  }
  const v = c.share_og_updated_at ? `?v=${encodeURIComponent(String(Date.parse(c.share_og_updated_at as string) || ""))}` : "";
  const name = (c.name as string) || env.siteName;
  return {
    status: 200,
    noindex: !!token,
    html: buildOgHtml({
      title: `Gia phả ${name}`,
      description: postExcerpt((c.description as string | null) ?? "", 200) || `Xem gia phả, ngày giỗ và những câu chuyện của ${name}.`,
      image: `${env.cardImageBase.replace(/\/+$/, "")}/${path}${v}`,
      url,
      siteName: env.siteName,
      noindex: !!token,
      type: "website",
      imageSize: { w: 1200, h: 630 },
    }),
  };
}

export async function renderOgPost(sb: Sb, params: OgParams, env: OgEnv): Promise<OgResult> {
  const { token, clan, id } = params;
  if (params.kind === "clan") return !token && !clan ? { status: 404 } : renderOgClan(sb, params, env);
  if (!id || !UUID.test(id) || (!token && !clan)) return { status: 404 };
  if (params.kind === "person") return renderOgPerson(sb, params, env);
  const access = await resolveShareAccess(sb, token, clan);
  if (!access.ok || !SITE_SCOPES.includes(access.link.scope)) return { status: 404 };
  const clanId = access.link.clan_id;

  const { data: clanRow } = await sb.from("clans").select("name, hide_photos_in_share, share_sections").eq("id", clanId).maybeSingle();
  const sections = (clanRow?.share_sections as string[] | null) ?? [];
  if (!sections.includes("board")) return { status: 404 };

  const r = await handlePart({ sb, clanId, hidePhotos: !!clanRow?.hide_photos_in_share, sections, sign: async () => new Map() }, "post", new URLSearchParams({ id }));
  if (r.status !== 200) return { status: 404 };
  const post = r.body as { title: string; body: string };

  const clanName = (clanRow?.name as string | null) ?? env.siteName;
  const cover = clanRow?.hide_photos_in_share ? null : firstImageUrl(post.body);
  return {
    status: 200,
    noindex: !!token, // link riêng tư: URL là mật khẩu → không cho công cụ tìm kiếm lập chỉ mục
    html: buildOgHtml({
      title: `${post.title} — ${clanName}`,
      description: postExcerpt(post.body, 200) || clanName,
      image: cover ?? env.defaultImage,
      url: postPageUrl(env.siteOrigin, { token, clan }, id),
      siteName: env.siteName,
      noindex: !!token,
    }),
  };
}
