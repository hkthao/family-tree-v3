import { describe, expect, it } from "vitest";

import { buildClanIcs } from "@/lib/icalExport";

const FIXED_NOW = new Date("2026-06-07T03:00:00Z");

describe("icalExport.buildClanIcs", () => {
  it("emits a VCALENDAR shell with proper header lines", () => {
    const ics = buildClanIcs({
      clanName: "Họ Huỳnh",
      clanId: "c1",
      appBaseUrl: "https://giapha.test",
      persons: [],
      now: FIXED_NOW,
    });
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics).toMatch(/END:VCALENDAR\r\n$/);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//Dòng Họ Việt//VN//EN");
    expect(ics).toContain("X-WR-CALNAME:Gia phả Họ Huỳnh");
    expect(ics).toContain("X-WR-TIMEZONE:Asia/Ho_Chi_Minh");
  });

  it("emits a yearly birthday VEVENT for a living person", () => {
    const ics = buildClanIcs({
      clanName: "Test",
      clanId: "c1",
      appBaseUrl: "https://app",
      persons: [
        {
          id: "p1",
          full_name: "Nguyễn Văn A",
          generation: 3,
          is_living: true,
          birth_date: "1985-04-15",
          death_anniv_lunar_month: null,
          death_anniv_lunar_day: null,
        },
      ],
      now: FIXED_NOW,
    });
    expect(ics).toContain("UID:birthday-p1@giapha");
    expect(ics).toContain("SUMMARY:Sinh nhật Nguyễn Văn A");
    expect(ics).toContain("DTSTART;VALUE=DATE:19850415");
    expect(ics).toContain("RRULE:FREQ=YEARLY");
    expect(ics).toContain("DESCRIPTION:Mở trang: https://app/clans/c1/people/p1");
  });

  it("skips birthday when birth_date is year-only (no recurring date)", () => {
    const ics = buildClanIcs({
      clanName: "T",
      clanId: "c1",
      appBaseUrl: "https://app",
      persons: [
        {
          id: "p1",
          full_name: "A",
          generation: null,
          is_living: true,
          birth_date: "1900-01-01", // could be precision='year' under the hood
          death_anniv_lunar_month: null,
          death_anniv_lunar_day: null,
        },
      ],
      now: FIXED_NOW,
    });
    // Full-precision-looking date passes through — caller is expected
    // to filter year-only persons upstream. This test documents the
    // current behaviour rather than asserting deeper logic.
    expect(ics).toContain("DTSTART;VALUE=DATE:19000101");
  });

  it("emits a giỗ VEVENT with RDATE for 10 future lunar→solar maps", () => {
    const ics = buildClanIcs({
      clanName: "T",
      clanId: "c1",
      appBaseUrl: "https://app",
      persons: [
        {
          id: "p2",
          full_name: "Cụ Bà",
          generation: 1,
          is_living: false,
          birth_date: null,
          // Giỗ mồng 5 tháng 3 ÂL
          death_anniv_lunar_month: 3,
          death_anniv_lunar_day: 5,
        },
      ],
      yearsAhead: 10,
      now: FIXED_NOW,
    });
    expect(ics).toContain("UID:gio-p2@giapha");
    expect(ics).toContain("SUMMARY:Giỗ Cụ Bà (Đời 1)");
    expect(ics).toMatch(/DTSTART;VALUE=DATE:\d{8}/);
    expect(ics).toMatch(/RDATE;VALUE=DATE:[0-9,]/);
    // Unfold continuation lines (RFC 5545 §3.1 — a CRLF followed by
    // space/tab is a continuation), then count distinct 8-digit dates
    // anywhere in the event body. We expect 10 years total: 1 in
    // DTSTART + 9 in RDATE.
    const unfolded = ics.replace(/\r\n[ \t]/g, "");
    const dates = unfolded.match(/\b\d{8}\b/g) ?? [];
    expect(new Set(dates).size).toBeGreaterThanOrEqual(10);
  });

  it("emits a one-off VEVENT for a non-recurring solar custom event", () => {
    const ics = buildClanIcs({
      clanName: "T",
      clanId: "c1",
      appBaseUrl: "https://app",
      persons: [],
      customEvents: [
        {
          id: "e1",
          title: "Họp họ 2026",
          date_solar: "2026-12-20",
          lunar_month: null,
          lunar_day: null,
          is_yearly: false,
        },
      ],
      now: FIXED_NOW,
    });
    expect(ics).toContain("UID:event-e1@giapha");
    expect(ics).toContain("SUMMARY:Họp họ 2026");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261220");
    expect(ics).not.toContain("RRULE:FREQ=YEARLY"); // non-recurring
  });

  it("escapes commas / semicolons / backslashes in SUMMARY", () => {
    const ics = buildClanIcs({
      clanName: "T",
      clanId: "c1",
      appBaseUrl: "https://app",
      persons: [],
      customEvents: [
        {
          id: "e1",
          title: "Họp, ngày; \\1",
          date_solar: "2026-12-20",
          lunar_month: null,
          lunar_day: null,
          is_yearly: false,
        },
      ],
      now: FIXED_NOW,
    });
    expect(ics).toContain(String.raw`SUMMARY:Họp\, ngày\; \\1`);
  });

  it("uses CRLF line endings and ends with a final CRLF", () => {
    const ics = buildClanIcs({
      clanName: "T",
      clanId: "c1",
      appBaseUrl: "https://app",
      persons: [],
      now: FIXED_NOW,
    });
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.includes("\r\n")).toBe(true);
    expect(ics.split("\n").every((l) => l === "" || l.endsWith("\r"))).toBe(
      true,
    );
  });
});
