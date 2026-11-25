/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * reCAPTCHA phía trình duyệt: không có site key thì im lặng bỏ qua; có key thì chỉ nạp script khi cần, lấy mã bằng đúng action
 * và KHÔNG BAO GIỜ ném lỗi / treo (Google lỗi → null để máy chủ quyết).
 */
const load = async () => {
  vi.resetModules();
  return import("@/lib/recaptcha");
};

beforeEach(() => {
  document.head.innerHTML = "";
  delete (window as unknown as { grecaptcha?: unknown }).grecaptcha;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("không có site key", () => {
  it("tắt hoàn toàn: không nạp script, token null", async () => {
    vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "");
    const m = await load();
    expect(m.captchaEnabled()).toBe(false);
    expect(await m.preloadRecaptcha()).toBe(false);
    expect(await m.getCaptchaToken("guest_memory")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
  });
});

describe("có site key", () => {
  beforeEach(() => vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "SITEKEY"));
  const fakeGrecaptcha = (execute: (k: string, o: { action: string }) => Promise<string>) => {
    (window as unknown as { grecaptcha: unknown }).grecaptcha = { ready: (cb: () => void) => cb(), execute };
  };

  it("nạp script đúng địa chỉ, chỉ một lần dù gọi nhiều lần", async () => {
    const m = await load();
    expect(m.captchaEnabled()).toBe(true);
    void m.preloadRecaptcha();
    void m.preloadRecaptcha();
    const scripts = document.querySelectorAll("script");
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe("https://www.google.com/recaptcha/api.js?render=SITEKEY");
  });

  it("lấy mã với đúng action và site key", async () => {
    const execute = vi.fn(async () => "TOKEN-1");
    fakeGrecaptcha(execute);
    const m = await load();
    expect(await m.getCaptchaToken("guest_face")).toBe("TOKEN-1");
    expect(execute).toHaveBeenCalledWith("SITEKEY", { action: "guest_face" });
  });

  it("execute lỗi → null, không ném", async () => {
    fakeGrecaptcha(async () => {
      throw new Error("boom");
    });
    const m = await load();
    expect(await m.getCaptchaToken("guest_memory")).toBeNull();
  });

  it("script không tải được (trình chặn quảng cáo) → null và cho thử lại lần sau", async () => {
    const m = await load();
    const p = m.getCaptchaToken("guest_memory", 2000);
    (document.querySelector("script") as HTMLScriptElement).onerror?.(new Event("error"));
    expect(await p).toBeNull();
    void m.preloadRecaptcha();
    expect(document.querySelectorAll("script").length).toBeGreaterThanOrEqual(1);
  });

  it("quá chậm → null sau thời hạn, không treo nút gửi", async () => {
    vi.useFakeTimers();
    fakeGrecaptcha(() => new Promise<string>(() => {}));
    const m = await load();
    const p = m.getCaptchaToken("guest_memory", 500);
    await vi.advanceTimersByTimeAsync(600);
    expect(await p).toBeNull();
  });
});
