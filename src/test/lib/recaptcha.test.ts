import { describe, expect, it, vi } from "vitest";

import { captchaLogLine, configFromEnv, verifyCaptcha, type CaptchaConfig } from "../../../supabase/functions/_shared/recaptcha";

/**
 * Xác minh reCAPTCHA v3 (docs/plan-recaptcha-public.md, mục 2): `log` không bao giờ chặn, `enforce` chặn đúng ca,
 * Google lỗi thì mở có kiểm soát, mã sai action / hostname / quá cũ bị từ chối.
 */

const NOW = Date.parse("2026-11-25T10:00:00Z");
const cfg = (over: Partial<CaptchaConfig> = {}): CaptchaConfig => ({ mode: "enforce", secret: "sec", minScore: 0.5, blockScore: 0.3, hostnames: ["app.example"], failOpen: true, timeoutMs: 100, maxAgeSec: 300, ...over });
const google = (reply: Record<string, unknown>, ok = true) => vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => reply }) as Response);
const good = { success: true, score: 0.9, action: "guest_memory", hostname: "app.example", challenge_ts: new Date(NOW - 5000).toISOString() };
const run = (token: string | null, c: CaptchaConfig, f: ReturnType<typeof google>, action = "guest_memory") => verifyCaptcha(token, action, c, { fetchImpl: f, now: NOW, ip: "1.2.3.4" });

describe("configFromEnv", () => {
  const env = (o: Record<string, string>) => (k: string) => o[k];
  it("mặc định TẮT; chỉ nhận off|log|enforce; ngưỡng mặc định 0,5 / 0,3; mở có kiểm soát", () => {
    expect(configFromEnv(env({}))).toMatchObject({ mode: "off", secret: "", minScore: 0.5, blockScore: 0.3, failOpen: true, hostnames: [] });
    expect(configFromEnv(env({ RECAPTCHA_MODE: "ENFORCE" })).mode).toBe("enforce");
    expect(configFromEnv(env({ RECAPTCHA_MODE: "bậy" })).mode).toBe("off");
    expect(configFromEnv(env({ RECAPTCHA_FAIL_OPEN: "0", RECAPTCHA_HOSTNAMES: "A.com, b.com", RECAPTCHA_MIN_SCORE: "0.7" }))).toMatchObject({ failOpen: false, hostnames: ["a.com", "b.com"], minScore: 0.7 });
  });
});

describe("verifyCaptcha", () => {
  it("off / thiếu khoá bí mật: bỏ qua, không gọi Google", async () => {
    const f = google(good);
    expect(await run("t", cfg({ mode: "off" }), f)).toMatchObject({ allow: true, verdict: "skipped" });
    expect(await run("t", cfg({ secret: "" }), f)).toMatchObject({ allow: true, verdict: "skipped", reason: "no_secret" });
    expect(f).not.toHaveBeenCalled();
  });

  it("điểm cao, đúng action + hostname: pass; gửi secret / response / remoteip", async () => {
    const f = google(good);
    const r = await run("TOK", cfg(), f);
    expect(r).toMatchObject({ allow: true, forceReview: false, verdict: "pass", score: 0.9 });
    const body = (f.mock.calls[0] as unknown as [string, { body: URLSearchParams }])[1].body;
    expect(Object.fromEntries(body)).toEqual({ secret: "sec", response: "TOK", remoteip: "1.2.3.4" });
  });

  it("điểm lưng chừng (0,3–0,5): cho qua nhưng ép chờ duyệt; dưới 0,3: chặn", async () => {
    expect(await run("t", cfg(), google({ ...good, score: 0.4 }))).toMatchObject({ allow: true, forceReview: true, verdict: "review" });
    expect(await run("t", cfg(), google({ ...good, score: 0.1 }))).toMatchObject({ allow: false, verdict: "fail", reason: "low_score" });
  });

  it("từ chối: thiếu mã, Google báo lỗi, sai action, sai hostname, quá cũ", async () => {
    expect(await run(null, cfg(), google(good))).toMatchObject({ allow: false, reason: "missing_token" });
    expect(await run("t", cfg(), google({ success: false, "error-codes": ["timeout-or-duplicate"] }))).toMatchObject({ allow: false, reason: "google:timeout-or-duplicate" });
    expect(await run("t", cfg(), google(good), "guest_answer")).toMatchObject({ allow: false, reason: "action_mismatch:guest_memory" });
    expect(await run("t", cfg(), google({ ...good, hostname: "evil.example" }))).toMatchObject({ allow: false, reason: "hostname:evil.example" });
    expect(await run("t", cfg(), google({ ...good, challenge_ts: new Date(NOW - 600_000).toISOString() }))).toMatchObject({ allow: false, reason: "expired" });
    expect(await run("t", cfg({ hostnames: [] }), google({ ...good, hostname: "bất kỳ" }))).toMatchObject({ allow: true });
  });

  it("chế độ log: ghi kết quả thật nhưng KHÔNG chặn", async () => {
    const r = await run("t", cfg({ mode: "log" }), google({ ...good, score: 0.05 }));
    expect(r).toMatchObject({ allow: true, verdict: "fail", reason: "low_score", mode: "log" });
    expect(await run(null, cfg({ mode: "log" }), google(good))).toMatchObject({ allow: true, verdict: "fail" });
  });

  it("Google lỗi mạng / HTTP 500 / chậm: mở có kiểm soát (ép chờ duyệt); FAIL_OPEN=0 thì đóng ở enforce", async () => {
    const boom = vi.fn(async () => {
      throw new Error("network");
    });
    expect(await run("t", cfg(), boom as never)).toMatchObject({ allow: true, forceReview: true, verdict: "unavailable" });
    expect(await run("t", cfg(), google({}, false))).toMatchObject({ allow: true, forceReview: true, reason: "unavailable:http_500" });
    expect(await run("t", cfg({ failOpen: false }), boom as never)).toMatchObject({ allow: false, verdict: "fail" });
    const slow = vi.fn((_u: string, init: RequestInit) => new Promise<Response>((_res, rej) => init.signal?.addEventListener("abort", () => rej(new Error("aborted")))));
    expect(await run("t", cfg({ timeoutMs: 10 }), slow as never)).toMatchObject({ allow: true, forceReview: true, verdict: "unavailable" });
  });

  it("dòng log không chứa mã thông báo hay IP", async () => {
    const r = await run("SECRET-TOKEN", cfg(), google(good));
    const line = captchaLogLine("guest_memory", r);
    expect(line).not.toContain("SECRET-TOKEN");
    expect(line).not.toContain("1.2.3.4");
    expect(JSON.parse(line)).toMatchObject({ evt: "captcha", action: "guest_memory", verdict: "pass" });
  });
});
