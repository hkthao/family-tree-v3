import { describe, expect, it } from "vitest";

import type { EventRow } from "@/lib/queries/events";
import type { PersonForTree } from "@/lib/queries/tree";
import {
  computeUpcomingAnniversaries,
  computeUpcomingEvents,
  type PersonAnniversary,
} from "@/lib/upcomingEvents";

function person(over: Partial<PersonForTree> & Pick<PersonForTree, "id" | "full_name">): PersonForTree {
  return {
    gender: "M",
    is_living: true,
    is_root: false,
    birth_date: null,
    death_date: null,
    generation: null,
    birth_family_id: null,
    ...over,
  };
}

function ev(over: Partial<EventRow> & Pick<EventRow, "id" | "title">): EventRow {
  return {
    clan_id: "c1",
    event_type: "custom",
    date_solar: null,
    lunar_year: null,
    lunar_month: null,
    lunar_day: null,
    lunar_is_leap: false,
    is_yearly: true,
    related_person_id: null,
    notes: null,
    created_at: "2024-01-01T00:00:00Z",
    ...over,
  };
}

describe("computeUpcomingEvents", () => {
  it("returns the next birthday for a living person — this year or next", () => {
    const today = new Date(2024, 5, 1); // June 1, 2024
    const events = computeUpcomingEvents({
      today,
      daysAhead: 90,
      events: [],
      persons: [
        person({
          id: "p1",
          full_name: "Người tháng 7",
          birth_date: "1990-07-15",
        }),
        person({
          id: "p2",
          full_name: "Người tháng 1",
          birth_date: "1990-01-15", // already past — picks 2025-01-15, days > 90, drop
        }),
      ],
    });
    expect(events).toHaveLength(1);
    expect(events[0].title).toContain("Người tháng 7");
    expect(events[0].date).toBe("2024-07-15");
    expect(events[0].daysUntil).toBe(44); // June 1 → July 15
    expect(events[0].subtitle).toBe("tròn 34 tuổi");
  });

  it("skips deceased birthdays", () => {
    const today = new Date(2024, 5, 1);
    const events = computeUpcomingEvents({
      today,
      daysAhead: 365,
      events: [],
      persons: [
        person({
          id: "p1",
          full_name: "Đã mất",
          is_living: false,
          birth_date: "1900-07-15",
        }),
      ],
    });
    expect(events).toHaveLength(0);
  });

  it("includes a one-shot custom solar event in range", () => {
    const today = new Date(2024, 5, 1);
    const events = computeUpcomingEvents({
      today,
      daysAhead: 60,
      persons: [],
      events: [
        ev({
          id: "e1",
          title: "Họp họ",
          date_solar: "2024-07-10",
          is_yearly: false,
        }),
      ],
    });
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Họp họ");
    expect(events[0].date).toBe("2024-07-10");
  });

  it("rolls a yearly solar event into next year if already past", () => {
    const today = new Date(2024, 5, 1);
    const events = computeUpcomingEvents({
      today,
      daysAhead: 365,
      persons: [],
      events: [
        ev({
          id: "e1",
          title: "Ngày khai mộ — yearly",
          date_solar: "2020-03-15",
          is_yearly: true,
        }),
      ],
    });
    expect(events).toHaveLength(1);
    expect(events[0].date).toBe("2025-03-15");
  });

  it("converts a yearly lunar event for the current solar year", () => {
    const today = new Date(2024, 0, 1);
    const events = computeUpcomingEvents({
      today,
      daysAhead: 60,
      persons: [],
      events: [
        ev({
          id: "e1",
          title: "Tết",
          lunar_month: 1,
          lunar_day: 1,
          is_yearly: true,
        }),
      ],
    });
    expect(events).toHaveLength(1);
    // Tết Giáp Thìn 2024 = 2024-02-10
    expect(events[0].date).toBe("2024-02-10");
  });

  it("sorts by daysUntil ascending", () => {
    const today = new Date(2024, 5, 1);
    const out = computeUpcomingEvents({
      today,
      daysAhead: 365,
      persons: [
        person({ id: "p1", full_name: "Aug", birth_date: "1990-08-01" }),
        person({ id: "p2", full_name: "Jul", birth_date: "1990-07-01" }),
      ],
      events: [],
    });
    expect(out.map((e) => e.title)).toEqual([
      "Sinh nhật Jul",
      "Sinh nhật Aug",
    ]);
  });
});

describe("computeUpcomingAnniversaries", () => {
  function anniv(over: Partial<PersonAnniversary> & Pick<PersonAnniversary, "id" | "full_name">): PersonAnniversary {
    return {
      generation: null,
      death_anniv_lunar_month: null,
      death_anniv_lunar_day: null,
      death_anniv_lunar_is_leap: false,
      ...over,
    };
  }

  it("maps lunar 5/4 to solar in the same calendar year", () => {
    const today = new Date(2024, 0, 1);
    const out = computeUpcomingAnniversaries({
      today,
      daysAhead: 365,
      anniversaries: [
        anniv({
          id: "p1",
          full_name: "Cụ A",
          generation: 1,
          death_anniv_lunar_month: 4,
          death_anniv_lunar_day: 5,
        }),
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Giỗ Cụ A");
    expect(out[0].subtitle).toBe("Đời 1");
    // 5/4 lunar 2024 = 2024-05-12 (checked via amlich.com)
    expect(out[0].date).toBe("2024-05-12");
  });

  it("skips persons without lunar anniversary data", () => {
    const today = new Date(2024, 0, 1);
    const out = computeUpcomingAnniversaries({
      today,
      daysAhead: 365,
      anniversaries: [
        anniv({ id: "p1", full_name: "no anniv" }),
      ],
    });
    expect(out).toEqual([]);
  });
});
