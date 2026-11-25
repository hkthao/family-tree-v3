/**
 * sitemap: XML bản đồ trang các dòng họ công khai (xem core.ts). GET, không tham số. Máy chủ web trỏ `/sitemap-dong-ho.xml` tới đây.
 * Biến môi trường: SITE_ORIGIN (bắt buộc).
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

import { loadSitemap } from "./core.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const origin = (Deno.env.get("SITE_ORIGIN") ?? "").replace(/\/+$/, "");
  if (!origin) return new Response("SITE_ORIGIN is not configured", { status: 500 });
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    return new Response(await loadSitemap(sb, origin), {
      headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
    });
  } catch (e) {
    console.error("sitemap", (e as Error).message);
    return new Response("Error", { status: 500 });
  }
});
