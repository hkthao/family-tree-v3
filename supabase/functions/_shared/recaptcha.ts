/**
 * Xác minh Google reCAPTCHA v3 phía máy chủ (docs/plan-recaptcha-public.md, mục 2). Dùng cho các function nhận dữ liệu của KHÁCH
 * (community-submit, submit-contribution). Không import Deno-only nên test được bằng vitest.
 *
 * Chế độ (RECAPTCHA_MODE): `off` bỏ qua · `log` xác minh + ghi điểm nhưng KHÔNG chặn (để chỉnh ngưỡng) · `enforce` chặn.
 * Khi Google lỗi / chậm, mặc định "mở có kiểm soát": cho qua nhưng ép đóng góp vào hàng chờ duyệt (`forceReview`);
 * RECAPTCHA_FAIL_OPEN=0 để đóng hẳn. Thiếu khoá bí mật = coi như chưa cấu hình (không khoá người dùng thật).
 */

export type CaptchaMode = "off" | "log" | "enforce";

export interface CaptchaConfig {
  mode: CaptchaMode;
  secret: string;
  /** Dưới ngưỡng này (nhưng >= blockScore) → cho qua nhưng ép chờ duyệt. */
  minScore: number;
  /** Dưới ngưỡng này → chặn (khi enforce). */
  blockScore: number;
  /** Tên miền được phép (hostname Google trả về); rỗng = không kiểm. */
  hostnames: string[];
  failOpen: boolean;
  timeoutMs: number;
  /** Mã thông báo quá cũ (giây) thì bỏ. */
  maxAgeSec: number;
}

export interface CaptchaResult {
  /** Có cho phép tiếp tục không (đã tính theo chế độ). */
  allow: boolean;
  /** Dù cho qua, đóng góp phải vào hàng chờ duyệt. */
  forceReview: boolean;
  mode: CaptchaMode;
  /** Kết quả xác minh thật, bất kể chế độ. */
  verdict: "pass" | "review" | "fail" | "skipped" | "unavailable";
  score?: number;
  reason?: string;
}

const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

export function configFromEnv(get: (k: string) => string | undefined): CaptchaConfig {
  const mode = (get("RECAPTCHA_MODE") ?? "off").toLowerCase();
  const num = (k: string, d: number) => {
    const n = Number(get(k));
    return get(k) !== undefined && Number.isFinite(n) ? n : d;
  };
  return {
    mode: mode === "log" || mode === "enforce" ? mode : "off",
    secret: get("RECAPTCHA_SECRET") ?? "",
    minScore: num("RECAPTCHA_MIN_SCORE", 0.5),
    blockScore: num("RECAPTCHA_BLOCK_SCORE", 0.3),
    hostnames: (get("RECAPTCHA_HOSTNAMES") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    failOpen: get("RECAPTCHA_FAIL_OPEN") !== "0",
    timeoutMs: num("RECAPTCHA_TIMEOUT_MS", 3000),
    maxAgeSec: 300,
  };
}

interface GoogleReply {
  success?: boolean;
  score?: number;
  action?: string;
  hostname?: string;
  challenge_ts?: string;
  "error-codes"?: string[];
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** Xác minh một mã thông báo cho đúng `action`. `fetchImpl` để test. */
export async function verifyCaptcha(
  token: string | null | undefined,
  action: string,
  cfg: CaptchaConfig,
  opts: { ip?: string; fetchImpl?: Fetch; now?: number } = {},
): Promise<CaptchaResult> {
  const base = { mode: cfg.mode };
  if (cfg.mode === "off") return { ...base, allow: true, forceReview: false, verdict: "skipped", reason: "off" };
  if (!cfg.secret) return { ...base, allow: true, forceReview: false, verdict: "skipped", reason: "no_secret" };

  // Quyết định cuối theo chế độ: log không bao giờ chặn.
  const decide = (verdict: CaptchaResult["verdict"], extra: { score?: number; reason?: string }, forceReview = false): CaptchaResult => ({
    ...base,
    ...extra,
    verdict,
    forceReview,
    allow: cfg.mode === "log" ? true : verdict !== "fail",
  });

  if (!token) return decide("fail", { reason: "missing_token" });

  const doFetch = opts.fetchImpl ?? ((u, i) => fetch(u, i));
  let reply: GoogleReply;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), cfg.timeoutMs);
    const body = new URLSearchParams({ secret: cfg.secret, response: token });
    if (opts.ip && opts.ip !== "unknown") body.set("remoteip", opts.ip);
    const res = await doFetch(VERIFY_URL, { method: "POST", body, signal: ctl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`http_${res.status}`);
    reply = (await res.json()) as GoogleReply;
  } catch (e) {
    // Google lỗi / chậm: không khoá người dùng thật — mở có kiểm soát (ép chờ duyệt) trừ khi cấu hình đóng.
    const reason = `unavailable:${(e as Error).message || "error"}`;
    return cfg.failOpen ? { ...base, allow: true, forceReview: true, verdict: "unavailable", reason } : decide("fail", { reason });
  }

  const score = typeof reply.score === "number" ? reply.score : undefined;
  if (!reply.success) return decide("fail", { score, reason: `google:${(reply["error-codes"] ?? ["rejected"]).join(",")}` });
  if (reply.action !== action) return decide("fail", { score, reason: `action_mismatch:${reply.action ?? "none"}` });
  if (cfg.hostnames.length > 0 && !cfg.hostnames.includes((reply.hostname ?? "").toLowerCase())) return decide("fail", { score, reason: `hostname:${reply.hostname ?? "none"}` });
  if (reply.challenge_ts) {
    const age = ((opts.now ?? Date.now()) - Date.parse(reply.challenge_ts)) / 1000;
    if (Number.isFinite(age) && age > cfg.maxAgeSec) return decide("fail", { score, reason: "expired" });
  }
  if (score === undefined) return decide("fail", { reason: "no_score" });
  if (score < cfg.blockScore) return decide("fail", { score, reason: "low_score" });
  if (score < cfg.minScore) return decide("review", { score, reason: "borderline" }, true);
  return decide("pass", { score });
}

/** Một dòng log gọn (không chứa mã thông báo / IP) để chỉnh ngưỡng và thấy đợt tấn công. */
export function captchaLogLine(action: string, r: CaptchaResult): string {
  return JSON.stringify({ evt: "captcha", action, mode: r.mode, verdict: r.verdict, allow: r.allow, review: r.forceReview, score: r.score ?? null, reason: r.reason ?? null });
}
