import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/recaptcha", () => ({ getCaptchaToken: vi.fn(async () => "CAPTCHA-TOKEN") }));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
(globalThis as Record<string, unknown>).__APP_VERSION__ = "0.1.0";
(globalThis as Record<string, unknown>).__APP_COMMIT__ = "abc1234";

import { getCaptchaToken } from "@/lib/recaptcha";
import { submitFeedback } from "@/lib/queries/feedback";

const fakeClient = (userId: string | null) => {
  const insert = vi.fn(async () => ({ error: null }));
  return { insert, client: { auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) }, from: () => ({ insert }) } as never };
};
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("VITE_SUPABASE_URL", "https://api.example");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("submitFeedback", () => {
  it("khách: gọi function feedback-submit kèm mã captcha, ô bẫy và thời gian điền; KHÔNG insert thẳng bảng", async () => {
    const { insert, client } = fakeClient(null);
    await submitFeedback({ message: "xin chào", category: "idea", contact: "a@b.c", pageUrl: "https://x/y", elapsedMs: 4321, website: "" }, client);
    expect(insert).not.toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe("https://api.example/functions/v1/feedback-submit");
    expect(init.headers.apikey).toBe("anon");
    expect(JSON.parse(init.body)).toMatchObject({ message: "xin chào", category: "idea", contact: "a@b.c", elapsed_ms: 4321, website: "", captcha_token: "CAPTCHA-TOKEN" });
    expect(getCaptchaToken).toHaveBeenCalledWith("feedback");
  });

  it("khách: không lấy được mã captcha thì vẫn gửi (không kèm captcha_token) để máy chủ quyết", async () => {
    vi.mocked(getCaptchaToken).mockResolvedValueOnce(null);
    await submitFeedback({ message: "m", elapsedMs: 3000 }, fakeClient(null).client);
    expect(JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body)).not.toHaveProperty("captcha_token");
  });

  it("khách: máy chủ từ chối thì ném lỗi tiếng Việt của máy chủ", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Bạn gửi nhiều quá, hãy thử lại sau ít phút." }) });
    await expect(submitFeedback({ message: "m", elapsedMs: 3000 }, fakeClient(null).client)).rejects.toThrow("Bạn gửi nhiều quá");
  });

  it("người đã đăng nhập: insert thẳng với user_id của mình, không gọi function, không hỏi captcha", async () => {
    vi.mocked(getCaptchaToken).mockClear();
    const { insert, client } = fakeClient("u1");
    await submitFeedback({ message: "m", category: "bug" }, client);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getCaptchaToken).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "u1", message: "m", category: "bug" }));
  });
});
