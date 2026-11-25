import { describe, expect, it } from "vitest";

import { GUEST_GLOBAL_HOUR, MIN_FILL_MS, PER_IP_DAY, PER_IP_HOUR, processFeedback, type FeedbackBody } from "../../../supabase/functions/feedback-submit/core";

/**
 * feedback-submit (docs/plan-recaptcha-public.md, bước 5): khách đi qua cổng phía máy chủ — bẫy bot, thời gian điền, trần theo IP / chung,
 * giới hạn link, lọc trường; người đăng nhập không bị trần. Phần captcha kiểm riêng ở recaptcha.test.ts.
 */

function fakeSb(opts: { counts?: number[]; insertError?: boolean } = {}) {
  const inserts: Record<string, unknown>[] = [];
  const queue = [...(opts.counts ?? [])];
  return {
    inserts,
    from() {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "gte", "not"]) b[m] = () => b;
      b.then = (res: (v: unknown) => unknown) => Promise.resolve({ count: queue.shift() ?? 0, error: null }).then(res);
      b.insert = (row: Record<string, unknown>) => {
        inserts.push(row);
        return Promise.resolve({ error: opts.insertError ? { message: "db" } : null });
      };
      return b;
    },
  };
}
const ok = (over: FeedbackBody = {}): FeedbackBody => ({ message: "App hay quá", category: "idea", contact: "a@b.c", elapsed_ms: MIN_FILL_MS + 500, ...over });
const run = (sb: ReturnType<typeof fakeSb>, body: FeedbackBody, userId: string | null = null) =>
  processFeedback({ sb, body, userId, ipHash: "iphash", userAgent: "UA/1.0" });

describe("khách (chưa đăng nhập)", () => {
  it("hợp lệ: ghi một dòng, user_id null, kèm băm IP + user-agent do MÁY CHỦ lấy; không lưu IP thô", async () => {
    const sb = fakeSb();
    const r = await run(sb, ok({ clan_id: "11111111-1111-4111-8111-111111111111", page_url: "https://x/y", app_version: "0.1+abc" }));
    expect(r).toEqual({ status: 200, body: { ok: true } });
    expect(sb.inserts[0]).toMatchObject({ user_id: null, message: "App hay quá", category: "idea", contact: "a@b.c", clan_id: "11111111-1111-4111-8111-111111111111", user_agent: "UA/1.0", submitter_ip_hash: "iphash", app_version: "0.1+abc" });
    expect(JSON.stringify(sb.inserts[0])).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
  });

  it("bẫy bot có chữ: trả ok giả, KHÔNG ghi gì", async () => {
    const sb = fakeSb();
    expect((await run(sb, ok({ website: "http://spam" }))).status).toBe(200);
    expect(sb.inserts).toHaveLength(0);
  });

  it("gửi quá nhanh (bot) hoặc thiếu elapsed → 400", async () => {
    expect((await run(fakeSb(), ok({ elapsed_ms: 100 }))).status).toBe(400);
    expect((await run(fakeSb(), ok({ elapsed_ms: undefined }))).status).toBe(400);
    expect((await run(fakeSb(), ok({ elapsed_ms: "abc" }))).status).toBe(400);
  });

  it("nội dung rỗng → 400; quá 5000 chữ bị cắt; nhiều link → 400", async () => {
    expect((await run(fakeSb(), ok({ message: "   " }))).status).toBe(400);
    const sb = fakeSb();
    await run(sb, ok({ message: "x".repeat(6000) }));
    expect((sb.inserts[0].message as string).length).toBe(5000);
    expect((await run(fakeSb(), ok({ message: "http://a http://b https://c www.d" }))).status).toBe(400);
    expect((await run(fakeSb(), ok({ message: "xem https://a.vn nhé" }))).status).toBe(200);
  });

  it("lọc trường: category lạ → other, clan_id không phải UUID → null, liên hệ cắt 200", async () => {
    const sb = fakeSb();
    await run(sb, ok({ category: "hack", clan_id: "'; drop table", contact: "c".repeat(500) }));
    expect(sb.inserts[0]).toMatchObject({ category: "other", clan_id: null });
    expect((sb.inserts[0].contact as string).length).toBe(200);
  });

  it("trần theo IP mỗi giờ / mỗi ngày và trần chung cho khách → 429, không ghi", async () => {
    for (const counts of [[PER_IP_HOUR], [0, PER_IP_DAY], [0, 0, GUEST_GLOBAL_HOUR]]) {
      const sb = fakeSb({ counts });
      expect((await run(sb, ok())).status).toBe(429);
      expect(sb.inserts).toHaveLength(0);
    }
    expect((await run(fakeSb({ counts: [PER_IP_HOUR - 1, PER_IP_DAY - 1, GUEST_GLOBAL_HOUR - 1] }), ok())).status).toBe(200);
  });

  it("lỗi cơ sở dữ liệu → 500 thông báo chung, không lộ chi tiết", async () => {
    const r = await run(fakeSb({ insertError: true }), ok());
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.body)).not.toContain("db");
  });
});

describe("người đã đăng nhập", () => {
  it("không bị hỏi thời gian điền / trần IP; ghi user_id, KHÔNG ghi băm IP", async () => {
    const sb = fakeSb({ counts: [999, 999, 999] });
    const r = await run(sb, ok({ elapsed_ms: 0 }), "user-1");
    expect(r.status).toBe(200);
    expect(sb.inserts[0]).toMatchObject({ user_id: "user-1", submitter_ip_hash: null });
  });
});
