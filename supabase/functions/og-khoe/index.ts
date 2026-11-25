/**
 * og-khoe: thẻ Open Graph cho thiệp /khoe/:token (xem og.ts). GET ?token=…
 * nginx chuyển TRÌNH QUÉT (Zalo / Facebook / Twitter) từ /khoe/:token sang đây; xem docs/og-post-nginx.md.
 *
 * Biến môi trường: SITE_ORIGIN (bắt buộc), OG_IMAGE (ảnh chung), OG_SITE_NAME, và CARD_IMAGE_BASE
 * (mặc định <SUPABASE_URL>/storage/v1/object/public/card-shares).
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

import { renderOgKhoe } from "./og.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const siteOrigin = (Deno.env.get("SITE_ORIGIN") ?? "").replace(/\/+$/, "");
  if (!siteOrigin) return new Response("SITE_ORIGIN is not configured", { status: 500 });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const r = await renderOgKhoe(sb, new URL(req.url).searchParams.get("token"), {
    siteOrigin,
    cardImageBase: Deno.env.get("CARD_IMAGE_BASE") ?? `${SUPABASE_URL}/storage/v1/object/public/card-shares`,
    defaultImage: Deno.env.get("OG_IMAGE") ?? `${siteOrigin}/icons/og-banner.png`,
    siteName: Deno.env.get("OG_SITE_NAME") ?? "Dòng Họ Việt",
  });
  if (r.status !== 200) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(r.html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300", "X-Robots-Tag": "noindex, nofollow" },
  });
});
