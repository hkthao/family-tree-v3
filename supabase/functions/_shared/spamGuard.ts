/**
 * Chống spam khi link chia sẻ / link mời góp bị lộ (docs/plan-dong-gop-cong-dong.md §7) — dùng chung
 * cho community-submit (ký ức, câu trả lời, khoanh mặt) và submit-contribution (đề xuất sửa thông tin).
 *
 * Lớp đã có ở từng function: bẫy bot, thời gian điền tối thiểu, chặn link trong chữ, trần theo IP và
 * theo link mỗi giờ, khách mới luôn chờ duyệt. Ở đây thêm các TRẦN THEO NGÀY để một link lộ (nhiều IP
 * khác nhau) không làm đầy DB / ổ cứng / hàng chờ của admin:
 *   - request quá lớn → chặn trước khi đọc body;
 *   - link vượt trần 24 giờ → TỰ TẠM DỪNG (share_links.contrib_paused_at) + báo admin trong app;
 *   - cả họ có quá nhiều đóng góp của khách đang chờ duyệt → tạm không nhận thêm từ khách;
 *   - trần số tệp khách tải lên mỗi ngày cho cả họ (ổ cứng server có hạn).
 */

// deno-lint-ignore no-explicit-any
type Sb = any;

export const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
export const LINK_PER_DAY = 60;
export const CLAN_GUEST_PENDING_MAX = 150;
export const CLAN_GUEST_MEDIA_PER_DAY = 30;

const DAY_AGO = () => new Date(Date.now() - 24 * 3600_000).toISOString();

/** Content-Length vượt trần → từ chối ngay (không parse body vào RAM). */
export function tooLarge(req: Request): boolean {
  const n = Number(req.headers.get("content-length") ?? "0");
  return Number.isFinite(n) && n > MAX_REQUEST_BYTES;
}

export interface GuardLink {
  id: string;
  clan_id: string;
  contrib_paused_at?: string | null;
}

export type GuardResult = { ok: true } | { ok: false; status: number; message: string };

/**
 * Kiểm tra trước khi ghi đóng góp của khách. `countLinkSubmissions` = số đóng góp đã nhận qua link
 * trong 24 giờ (mỗi function tự đếm theo bảng của mình); `media` = lượt này có tệp tải lên không.
 */
export async function guardGuestSubmission(
  sb: Sb,
  link: GuardLink,
  opts: { linkSubmissions24h: number; pendingTable: "person_memories" | "contributions"; media?: boolean },
): Promise<GuardResult> {
  if (link.contrib_paused_at) {
    return {
      ok: false,
      status: 423,
      message: "Link này đang tạm dừng nhận đóng góp. Hãy nhờ người gửi link mở lại hoặc gửi link mới.",
    };
  }
  if (opts.linkSubmissions24h >= LINK_PER_DAY) {
    await pauseLink(sb, link);
    return {
      ok: false,
      status: 423,
      message: "Link này nhận quá nhiều đóng góp hôm nay nên đã tạm dừng. Người quản lý dòng họ sẽ xem lại.",
    };
  }

  // Hàng chờ của khách trong cả họ (đóng góp của khách: author/submitter_user_id null).
  const pending =
    opts.pendingTable === "person_memories"
      ? await sb
          .from("person_memories")
          .select("id", { count: "exact", head: true })
          .eq("clan_id", link.clan_id)
          .eq("status", "pending")
          .is("author_user_id", null)
      : await sb
          .from("contributions")
          .select("id", { count: "exact", head: true })
          .eq("clan_id", link.clan_id)
          .eq("status", "pending")
          .is("submitter_user_id", null);
  if ((pending.count ?? 0) >= CLAN_GUEST_PENDING_MAX) {
    return {
      ok: false,
      status: 429,
      message: "Dòng họ đang có nhiều đóng góp chờ duyệt. Vui lòng gửi lại sau khi người quản lý duyệt bớt.",
    };
  }

  if (opts.media) {
    const { count } = await sb
      .from("person_memories")
      .select("id", { count: "exact", head: true })
      .eq("clan_id", link.clan_id)
      .is("author_user_id", null)
      .not("media_path", "is", null)
      .gt("created_at", DAY_AGO());
    if ((count ?? 0) >= CLAN_GUEST_MEDIA_PER_DAY) {
      return {
        ok: false,
        status: 429,
        message: "Hôm nay dòng họ đã nhận đủ ảnh tải lên. Bạn có thể dán link ảnh (Google Photos, Drive) thay vì tải lên.",
      };
    }
  }
  return { ok: true };
}

/** Số đóng góp (ký ức / câu trả lời / khoanh mặt) đã nhận qua link trong 24 giờ. */
export async function memorySubmissions24h(sb: Sb, linkId: string): Promise<number> {
  const since = DAY_AGO();
  const [m, f] = await Promise.all([
    sb.from("person_memories").select("id", { count: "exact", head: true }).eq("via_link_id", linkId).gt("created_at", since),
    sb
      .from("photo_faces")
      .select("id, memory:person_memories!inner(via_link_id)", { count: "exact", head: true })
      .eq("memory.via_link_id", linkId)
      .gt("created_at", since),
  ]);
  return (m.count ?? 0) + (f.count ?? 0);
}

/** Tạm dừng link + báo admin / biên tập viên trong app (chuông), một lần cho mỗi lần tạm dừng. */
async function pauseLink(sb: Sb, link: GuardLink): Promise<void> {
  const now = new Date().toISOString();
  const { data: upd } = await sb
    .from("share_links")
    .update({ contrib_paused_at: now })
    .eq("id", link.id)
    .is("contrib_paused_at", null)
    .select("id");
  if (!upd || upd.length === 0) return; // đã có lượt khác tạm dừng
  const { data: mods } = await sb
    .from("clan_members")
    .select("user_id")
    .eq("clan_id", link.clan_id)
    .in("role", ["admin", "editor"]);
  const appBase = Deno.env.get("APP_BASE_URL") ?? "";
  const rows = ((mods ?? []) as { user_id: string }[]).map((m) => ({
    user_id: m.user_id,
    clan_id: link.clan_id,
    event_key: `link-paused:${link.id}:${now.slice(0, 13)}`,
    channel: "inapp",
    status: "sent",
    title: "Một link chia sẻ đã tự tạm dừng nhận đóng góp",
    body: `Link nhận hơn ${LINK_PER_DAY} đóng góp trong 24 giờ — có thể đã bị lộ. Vào "Link đã gửi" để mở lại hoặc thu hồi.`,
    url: `${appBase}/clans/${link.clan_id}/dong-gop`,
  }));
  if (rows.length) {
    await sb.from("notification_log").upsert(rows, { onConflict: "user_id,event_key,channel", ignoreDuplicates: true });
  }
}
