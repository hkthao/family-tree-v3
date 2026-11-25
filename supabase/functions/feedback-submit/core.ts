/**
 * feedback-submit — lõi nhận phản hồi của KHÁCH chưa đăng nhập (docs/plan-recaptcha-public.md, bước 5). Trước đây trang /lien-he
 * INSERT thẳng vào bảng `feedback` bằng quyền anon, không có cổng phía máy chủ. Giờ khách đi qua function (captcha + bẫy bot + trần
 * tốc độ), còn quyền INSERT của anon bị thu hồi. Không import Deno-only nên test được bằng vitest.
 */

// deno-lint-ignore no-explicit-any
type Sb = any;

export const CATEGORIES = ["bug", "idea", "question", "other"] as const;
export const MIN_FILL_MS = 1500;
export const PER_IP_HOUR = 5;
export const PER_IP_DAY = 20;
export const GUEST_GLOBAL_HOUR = 200;
const MAX_LINKS = 3;
const LINK_RE = /https?:\/\/|www\./gi;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FeedbackBody {
  message?: unknown;
  category?: unknown;
  contact?: unknown;
  clan_id?: unknown;
  page_url?: unknown;
  app_version?: unknown;
  /** Bẫy bot: người thật không thấy ô này nên luôn rỗng. */
  website?: unknown;
  elapsed_ms?: unknown;
}

export type CoreResult =
  | { status: 200; body: { ok: true } }
  | { status: number; body: { error: string } };

const fail = (status: number, error: string): CoreResult => ({
  status,
  body: { error },
});
const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

export interface CoreInput {
  sb: Sb;
  body: FeedbackBody;
  /** Người đã đăng nhập (đã xác minh JWT) — null = khách. */
  userId: string | null;
  /** Băm IP (không lưu IP thô). */
  ipHash: string;
  /** false = không định danh được khách (IP nội bộ sau proxy): bỏ trần theo IP vì mọi người chung một IP, còn trần chung. */
  ipKnown?: boolean;
  userAgent: string | null;
  now?: number;
}

export async function processFeedback(i: CoreInput): Promise<CoreResult> {
  const { sb, body, userId } = i;
  // Bẫy bot: trả "ok" giả, không ghi gì.
  if (str(body.website, 200)) return { status: 200, body: { ok: true } };

  const guest = !userId;
  if (guest) {
    const elapsed = Number(body.elapsed_ms ?? 0);
    if (!Number.isFinite(elapsed) || elapsed < MIN_FILL_MS)
      return fail(400, "Bạn gửi nhanh quá, vui lòng thử lại.");
  }

  const message = str(body.message, 5000);
  if (!message) return fail(400, "Bạn chưa viết gì.");
  if ((message.match(LINK_RE) ?? []).length > MAX_LINKS)
    return fail(400, "Vui lòng không dán nhiều đường link vào nội dung.");
  const category = (CATEGORIES as readonly string[]).includes(
    body.category as string,
  )
    ? (body.category as string)
    : "other";
  const contact = str(body.contact, 200) || null;
  const clanRaw = str(body.clan_id, 40);
  const clanId = UUID.test(clanRaw) ? clanRaw : null;

  if (guest) {
    // Trần theo IP (đã băm) và trần chung cho khách: lưu trong chính bảng feedback, không cần bảng đếm riêng.
    const now = i.now ?? Date.now();
    const since = (ms: number) => new Date(now - ms).toISOString();
    const count = async (q: (b: Sb) => Sb): Promise<number> => {
      const { count: c, error } = await q(
        sb.from("feedback").select("id", { count: "exact", head: true }),
      );
      if (error) throw new Error(error.message);
      return c ?? 0;
    };
    // Trần theo IP chỉ có nghĩa khi định danh được khách; IP nội bộ sau proxy = mọi người chung một IP → bỏ, còn trần chung bên dưới.
    if (i.ipKnown !== false) {
      if (
        (await count((b) =>
          b
            .eq("submitter_ip_hash", i.ipHash)
            .gte("created_at", since(3_600_000)),
        )) >= PER_IP_HOUR
      )
        return fail(429, "Bạn gửi nhiều quá, hãy thử lại sau ít phút.");
      if (
        (await count((b) =>
          b
            .eq("submitter_ip_hash", i.ipHash)
            .gte("created_at", since(86_400_000)),
        )) >= PER_IP_DAY
      )
        return fail(
          429,
          "Hôm nay bạn đã gửi nhiều rồi, hãy thử lại vào ngày mai.",
        );
    }
    if (
      (await count((b) =>
        b
          .not("submitter_ip_hash", "is", null)
          .gte("created_at", since(3_600_000)),
      )) >= GUEST_GLOBAL_HOUR
    )
      return fail(
        429,
        "Hệ thống đang nhận nhiều phản hồi, hãy thử lại sau ít phút.",
      );
  }

  const { error } = await sb.from("feedback").insert({
    user_id: userId,
    clan_id: clanId,
    message,
    category,
    contact,
    page_url: str(body.page_url, 500) || null,
    user_agent: i.userAgent ? i.userAgent.slice(0, 300) : null,
    app_version: str(body.app_version, 60) || null,
    submitter_ip_hash: guest ? i.ipHash : null,
  });
  if (error) return fail(500, "Không gửi được lúc này, hãy thử lại sau.");
  return { status: 200, body: { ok: true } };
}
