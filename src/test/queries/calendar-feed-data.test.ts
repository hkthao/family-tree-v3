import { afterAll, describe, expect, it } from "vitest";

import { buildClanIcs, type IcsCustomEvent, type IcsPerson } from "@/lib/icalBuild";
import {
  calendarFeedUrl,
  calendarSubscribeLinks,
  createCalendarFeed,
  getMyCalendarFeed,
} from "@/lib/queries/calendar-feeds";
import { createClan } from "@/lib/queries/clans";

import { adminClient, createTestUser, deleteUser } from "../supabase-helpers";

describe("lịch thuê bao (calendar_feeds)", () => {
  const cleanup: string[] = [];
  afterAll(async () => {
    for (const id of cleanup) await deleteUser(id);
  });

  it("tạo link, tạo lại thì link cũ mất; người khác không thấy link của mình", async () => {
    const me = await createTestUser({ displayName: "Lịch" });
    const other = await createTestUser({ displayName: "Khác" });
    cleanup.push(me.id, other.id);
    const clan = await createClan({ name: "Họ Lịch" }, me.id, me.client);

    expect(await getMyCalendarFeed(clan.id, me.id, me.client)).toBeNull();
    const a = await createCalendarFeed(clan.id, me.id, me.client);
    const b = await createCalendarFeed(clan.id, me.id, me.client);
    expect(b.token).not.toBe(a.token);
    expect((await getMyCalendarFeed(clan.id, me.id, me.client))?.token).toBe(b.token);

    // Token cũ không còn trong bảng (đã thu hồi).
    const old = await adminClient().from("calendar_feeds").select("id").eq("token", a.token);
    expect(old.data).toHaveLength(0);

    // Người ngoài họ không tạo được link cho dòng họ này.
    await expect(createCalendarFeed(clan.id, other.id, other.client)).rejects.toThrow();
    // Và không đọc được link của người khác.
    const peek = await other.client.from("calendar_feeds").select("token").eq("clan_id", clan.id);
    expect(peek.data ?? []).toHaveLength(0);
  });

  it("các truy vấn của Edge Function chạy được và ra VEVENT", async () => {
    const me = await createTestUser({ displayName: "Lịch 2" });
    cleanup.push(me.id);
    const clan = await createClan({ name: "Họ Giỗ" }, me.id, me.client);
    const admin = adminClient();
    await admin.from("persons").insert({
      clan_id: clan.id,
      full_name: "Cụ Giỗ",
      gender: "M",
      is_living: false,
      death_anniv_lunar_month: 3,
      death_anniv_lunar_day: 10,
    });
    await admin.from("events").insert({
      clan_id: clan.id,
      title: "Họp họ",
      date_solar: "2027-02-01",
      is_yearly: true,
    });

    // Y hệt các select trong supabase/functions/calendar-feed/index.ts
    const [{ data: c }, { data: persons, error: pe }, { data: events, error: ee }] = await Promise.all([
      admin.from("clans").select("id, name, generation_offset").eq("id", clan.id).single(),
      admin
        .from("persons")
        .select(
          "id, full_name, generation, is_living, birth_date, death_anniv_lunar_month, death_anniv_lunar_day, death_anniv_lunar_is_leap",
        )
        .eq("clan_id", clan.id)
        .is("deleted_at", null),
      admin
        .from("events")
        .select("id, title, date_solar, lunar_month, lunar_day, lunar_is_leap, is_yearly, related_person_id")
        .eq("clan_id", clan.id),
    ]);
    expect(pe).toBeNull();
    expect(ee).toBeNull();
    const ics = buildClanIcs({
      clanName: c!.name as string,
      clanId: clan.id,
      appBaseUrl: "https://giapha.test",
      persons: (persons ?? []) as IcsPerson[],
      customEvents: (events ?? []) as IcsCustomEvent[],
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("REFRESH-INTERVAL");
    expect(ics).toContain("Cụ Giỗ");
    expect(ics).toContain("Họp họ");
  });

  it("URL và link đăng ký", () => {
    const url = calendarFeedUrl("abc", "https://x.test/");
    expect(url).toBe("https://x.test/functions/v1/calendar-feed?token=abc");
    const l = calendarSubscribeLinks(url);
    expect(l.webcal.startsWith("webcal://x.test/")).toBe(true);
    expect(l.google).toContain("calendar.google.com/calendar/r?cid=");
  });
});
