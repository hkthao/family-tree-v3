/**
 * og-post: thẻ Open Graph cho một bài Bảng tin (xem og.ts). GET ?token=…|clan=… &id=<postId>.
 * Máy chủ web chuyển TRÌNH QUÉT (Zalo / Facebook / Twitter) từ địa chỉ bài của ứng dụng sang đây; xem docs/og-post-nginx.md.
 *
 * Cấu hình qua biến môi trường của function:
 *   SITE_ORIGIN   gốc địa chỉ công khai của ứng dụng (bắt buộc, vd https://example.com)
 *   OG_IMAGE      ảnh chung khi bài không có ảnh bìa (mặc định: <SITE_ORIGIN>/icons/og-banner.png)
 *   OG_SITE_NAME  tên hiển thị (mặc định "Dòng Họ Việt")
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

import { renderOgPost } from "./og.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const notFound = () => new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

Deno.serve(async (req) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const siteOrigin = (Deno.env.get("SITE_ORIGIN") ?? "").replace(/\/+$/, "");
  if (!siteOrigin) return new Response("SITE_ORIGIN is not configured", { status: 500 });

  const url = new URL(req.url);
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const r = await renderOgPost(
    sb,
    { token: url.searchParams.get("token"), clan: url.searchParams.get("clan"), id: url.searchParams.get("id"), kind: url.searchParams.get("kind"), alias: url.searchParams.get("alias") },
    {
      siteOrigin,
      defaultImage: Deno.env.get("OG_IMAGE") ?? `${siteOrigin}/icons/og-banner.png`,
      siteName: Deno.env.get("OG_SITE_NAME") ?? "Dòng Họ Việt",
      cardImageBase: Deno.env.get("CARD_IMAGE_BASE") ?? `${SUPABASE_URL}/storage/v1/object/public/card-shares`,
    },
  );
  if (r.status !== 200) return notFound();
  return new Response(r.html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Link có thể bị thu hồi / bài bị ẩn: chỉ cache ngắn.
      "Cache-Control": "public, max-age=300",
      ...(r.noindex ? { "X-Robots-Tag": "noindex, nofollow" } : {}),
    },
  });
});
