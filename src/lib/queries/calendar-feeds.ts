import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { SUPABASE_URL, supabase as defaultClient } from "@/lib/supabase";

type Client = SupabaseClient<Database>;

export interface CalendarFeed {
  id: string;
  clan_id: string;
  token: string;
  created_at: string;
  last_fetched_at: string | null;
}

const COLS = "id, clan_id, token, created_at, last_fetched_at";

/** Token ngẫu nhiên 32 ký tự base64url (24 byte). */
function makeToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Đường dẫn .ics công khai (không cần đăng nhập) của một token. */
export function calendarFeedUrl(token: string, baseUrl: string = SUPABASE_URL): string {
  return `${baseUrl.replace(/\/$/, "")}/functions/v1/calendar-feed?token=${encodeURIComponent(token)}`;
}

/** Link mở thẳng ứng dụng lịch: Apple/Outlook qua webcal://, Google qua trang thêm lịch. */
export function calendarSubscribeLinks(feedUrl: string): { webcal: string; google: string } {
  const webcal = feedUrl.replace(/^https?:\/\//, "webcal://");
  return {
    webcal,
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
  };
}

export async function getMyCalendarFeed(
  clanId: string,
  userId: string,
  client: Client = defaultClient,
): Promise<CalendarFeed | null> {
  const { data, error } = await client
    .from("calendar_feeds")
    .select(COLS)
    .eq("clan_id", clanId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as CalendarFeed | null;
}

/** Tạo link mới; có link cũ thì thu hồi (xoá) trước để link cũ hết hiệu lực. */
export async function createCalendarFeed(
  clanId: string,
  userId: string,
  client: Client = defaultClient,
): Promise<CalendarFeed> {
  const del = await client
    .from("calendar_feeds")
    .delete()
    .eq("clan_id", clanId)
    .eq("user_id", userId);
  if (del.error) throw new Error(del.error.message);
  const { data, error } = await client
    .from("calendar_feeds")
    .insert({ clan_id: clanId, user_id: userId, token: makeToken() })
    .select(COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as CalendarFeed;
}

export async function deleteCalendarFeed(
  clanId: string,
  userId: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("calendar_feeds")
    .delete()
    .eq("clan_id", clanId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}
