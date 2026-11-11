/**
 * calendar-feed: lịch thuê bao .ics của một thành viên cho một dòng họ.
 *
 * GET /functions/v1/calendar-feed?token=…  (không JWT — Google/Apple Calendar
 * chỉ gọi được URL thuần). Hàm:
 *   1. Tra token trong `calendar_feeds` (service role).
 *   2. Kiểm người đó VẪN là thành viên dòng họ (rời họ → URL hết tác dụng).
 *   3. Dựng .ics bằng cùng bộ dựng với nút "Xuất lịch" (vendor/icalBuild.ts):
 *      giỗ âm lịch đã quy ra dương, sinh nhật người còn sống, sự kiện chung.
 *
 * Token lộ ra thì chỉ lộ lịch ngày giỗ/sinh nhật của dòng họ đó; thu hồi bằng
 * cách tạo lại link (xoá dòng cũ).
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

import { buildClanIcs, type IcsCustomEvent, type IcsPerson } from "../_shared/vendor/icalBuild.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "https://giapha.thaohk.com";

const TOKEN_RE = /^[A-Za-z0-9_-]{24,128}$/;

function text(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") return text("Method not allowed", 405);
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!TOKEN_RE.test(token)) return text("Link lịch không hợp lệ.", 400);

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: feed } = await sb
    .from("calendar_feeds")
    .select("id, clan_id, user_id")
    .eq("token", token)
    .maybeSingle();
  if (!feed) return text("Link lịch không còn hiệu lực. Hãy tạo link mới trong ứng dụng.", 404);

  const { data: member } = await sb
    .from("clan_members")
    .select("user_id")
    .eq("clan_id", feed.clan_id)
    .eq("user_id", feed.user_id)
    .maybeSingle();
  if (!member) return text("Bạn không còn là thành viên của dòng họ này.", 403);

  const [{ data: clan }, { data: persons }, { data: events }] = await Promise.all([
    sb.from("clans").select("id, name, generation_offset").eq("id", feed.clan_id).single(),
    sb
      .from("persons")
      .select(
        "id, full_name, generation, is_living, birth_date, death_anniv_lunar_month, death_anniv_lunar_day, death_anniv_lunar_is_leap",
      )
      .eq("clan_id", feed.clan_id)
      .is("deleted_at", null)
      .range(0, 9999),
    sb
      .from("events")
      .select(
        "id, title, date_solar, lunar_month, lunar_day, lunar_is_leap, is_yearly, related_person_id",
      )
      .eq("clan_id", feed.clan_id),
  ]);
  if (!clan) return text("Không tìm thấy dòng họ.", 404);

  const ics = buildClanIcs({
    clanName: clan.name as string,
    clanId: clan.id as string,
    appBaseUrl: APP_BASE_URL,
    generationOffset: (clan.generation_offset as number) ?? 0,
    persons: (persons ?? []) as IcsPerson[],
    customEvents: (events ?? []) as IcsCustomEvent[],
  });

  // Đánh dấu lần lấy gần nhất (không chờ, không làm hỏng phản hồi nếu lỗi).
  void sb
    .from("calendar_feeds")
    .update({ last_fetched_at: new Date().toISOString() })
    .eq("id", feed.id)
    .then(() => {}, () => {});

  return new Response(req.method === "HEAD" ? null : ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": 'inline; filename="gia-pha.ics"',
    },
  });
});
