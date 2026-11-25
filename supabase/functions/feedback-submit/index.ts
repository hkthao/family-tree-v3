/**
 * feedback-submit: nhận phản hồi / liên hệ của khách chưa đăng nhập (xem core.ts). POST JSON. Người đã đăng nhập vẫn có thể gọi
 * (gửi kèm JWT thật) và không bị hỏi captcha. Khách phải có mã reCAPTCHA hợp lệ (action `feedback`) khi RECAPTCHA_MODE=enforce.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

import {
  captchaLogLine,
  configFromEnv,
  verifyCaptcha,
} from "../_shared/recaptcha.ts";
import { clientIp, isPrivateIp } from "../_shared/clientIp.ts";
import { processFeedback, type FeedbackBody } from "./core.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const MAX_BYTES = 32 * 1024;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (Number(req.headers.get("content-length") ?? "0") > MAX_BYTES)
    return json({ error: "Dữ liệu gửi lên quá lớn" }, 413);

  let body: FeedbackBody & { captcha_token?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Dữ liệu gửi lên không hợp lệ" }, 400);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const ip = clientIp(req.headers);

  // Người đăng nhập: JWT thật (khác khoá anon). Chỉ tin người dùng đã được GoTrue xác minh.
  let userId: string | null = null;
  const bearer =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (bearer && bearer !== ANON_KEY) {
    const { data } = await sb.auth.getUser(bearer);
    userId = data.user?.id ?? null;
  }

  if (!userId) {
    const captcha = await verifyCaptcha(
      typeof body.captcha_token === "string"
        ? body.captcha_token.slice(0, 4000)
        : null,
      "feedback",
      configFromEnv((k) => Deno.env.get(k)),
      { ip },
    );
    if (captcha.mode !== "off")
      console.log(captchaLogLine("feedback", captcha));
    if (!captcha.allow)
      return json(
        { error: "Chưa xác minh được bạn là người thật, hãy thử lại." },
        403,
      );
  }

  try {
    const r = await processFeedback({
      sb,
      body,
      userId,
      ipHash: await sha256(`feedback:${ip}`),
      ipKnown: !isPrivateIp(ip),
      userAgent: req.headers.get("user-agent"),
    });
    return json(r.body, r.status);
  } catch (e) {
    console.error("feedback-submit", (e as Error).message);
    return json({ error: "Không gửi được lúc này, hãy thử lại sau." }, 500);
  }
});
