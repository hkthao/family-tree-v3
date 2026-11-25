/**
 * og-khoe: thẻ chia sẻ (Open Graph) cho trang thiệp /khoe/:token (docs/plan-thiep-khoe-design.md, mục 4.1).
 * Thay trang OG tĩnh chung `khoe-og.html`: dán link khoe vào Zalo / Facebook ra đúng ẢNH THIỆP THẬT + tiêu đề của thiệp đó.
 * Cổng: dòng còn hạn (`expires_at > now`); mọi lỗi / hết hạn / không thấy → 404 trơn, không lộ lý do.
 * Luôn noindex (link khoe có hạn, URL là bí mật). Không import Deno-only nên test được bằng vitest.
 */

import { buildOgHtml } from "../og-post/og.ts";

// deno-lint-ignore no-explicit-any
type Sb = any;

export interface OgKhoeEnv {
  siteOrigin: string;
  /** Gốc địa chỉ công khai của kho ảnh thiệp: <storage>/object/public/card-shares */
  cardImageBase: string;
  defaultImage: string;
  siteName: string;
}

export type OgKhoeResult = { status: 200; html: string } | { status: 404 };

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

/** Đường dẫn trong bucket → URL ảnh công khai; mỗi đoạn được mã hoá, không cho thoát khỏi thư mục bucket. */
export function cardImageUrl(base: string, path: string): string | null {
  const segs = path.split("/");
  if (segs.some((s) => s === "" || s === "." || s === "..")) return null;
  return `${base.replace(/\/+$/, "")}/${segs.map(encodeURIComponent).join("/")}`;
}

export async function renderOgKhoe(sb: Sb, token: string | null, env: OgKhoeEnv): Promise<OgKhoeResult> {
  if (!token || !TOKEN.test(token)) return { status: 404 };
  const { data: row } = await sb
    .from("card_shares")
    .select("title, subtitle, image_path, og_image_path, clan_id, expires_at")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!row) return { status: 404 };

  const { data: clan } = await sb.from("clans").select("name").eq("id", row.clan_id).maybeSingle();
  const clanName = (clan?.name as string | null) ?? env.siteName;
  // Ảnh OG 1200×630 riêng (dựng lúc xuất bản) nếu có; không thì ảnh thiệp gốc (khổ vuông / dọc có thể bị cắt); không nữa thì ảnh chung.
  const ogImage = row.og_image_path ? cardImageUrl(env.cardImageBase, String(row.og_image_path)) : null;
  const image = ogImage ?? cardImageUrl(env.cardImageBase, String(row.image_path ?? "")) ?? env.defaultImage;
  const title = String(row.title ?? "").trim() || `Thiệp từ ${clanName}`;
  return {
    status: 200,
    html: buildOgHtml({
      title: `${title} — ${clanName}`,
      description: (row.subtitle as string | null)?.trim() || `Thiệp chia sẻ từ ${clanName} trên ${env.siteName}.`,
      image,
      url: `${env.siteOrigin.replace(/\/+$/, "")}/khoe/${token}`,
      siteName: env.siteName,
      noindex: true,
      imageSize: ogImage ? { w: 1200, h: 630 } : undefined,
    }),
  };
}
