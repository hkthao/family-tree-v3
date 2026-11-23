import { describe, expect, it } from "vitest";

import { candidateToInput, pendingSuggestions, type TimelineRow } from "@/lib/timeline/mergeTimeline";
import {
  eventYear,
  fromEvents,
  fromGraves,
  fromHeritage,
  suggestionSourceLabel,
  SUGGESTION_SOURCES,
} from "@/lib/timeline/suggestions";

const ev = (o: Record<string, unknown>) =>
  ({ id: "e1", title: "Họp họ", notes: null, event_type: "custom", date_solar: null, lunar_year: null, ...o }) as Parameters<typeof fromEvents>[0][number];

describe("gợi ý mốc từ nhiều nguồn", () => {
  it("eventYear: ưu tiên năm của ngày dương, rồi năm âm; không có thì null", () => {
    expect(eventYear({ date_solar: "1975-04-30", lunar_year: null })).toBe(1975);
    expect(eventYear({ date_solar: null, lunar_year: 1990 })).toBe(1990);
    expect(eventYear({ date_solar: null, lunar_year: null })).toBeNull();
  });

  it("sự kiện: bỏ sự kiện không có năm hoặc tên; chọn hình theo loại", () => {
    const out = fromEvents([
      ev({ id: "a", date_solar: "2001-02-03", event_type: "reunion" }),
      ev({ id: "b", date_solar: "1999-01-01", event_type: "tomb_visit", notes: "Tảo mộ" }),
      ev({ id: "c" }), // không năm
      ev({ id: "d", title: "  ", date_solar: "2000-01-01" }), // không tên
    ]);
    expect(out.map((x) => x.key)).toEqual(["event:a", "event:b"]);
    expect(out[0].iconKey).toBe("family");
    expect(out[1].iconKey).toBe("candle");
    expect(out[1].body).toBe("Tảo mộ");
    expect(out.every((x) => x.source === "event" && !x.recommended)).toBe(true);
  });

  it("di sản: chỉ lấy mục có năm xây; hình theo loại", () => {
    const out = fromHeritage([
      { id: "h1", title: "Từ đường", summary: "Xây lại", category: "place", built_year: 1920 },
      { id: "h2", title: "Gia phong", summary: null, category: "custom", built_year: null },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ key: "heritage:h1", year: 1920, iconKey: "citadel", source: "heritage" });
  });

  it("mộ phần: chỉ lấy nơi có năm xây; dùng loại khi không có tên riêng", () => {
    const out = fromGraves(
      [
        { id: "g1", name: "Mộ Tổ", location_name: "Hoài Nhơn", built_year: 1950, notes: null },
        { id: "g2", name: null, location_name: null, built_year: 1960, notes: "Tu bổ" },
        { id: "g3", name: "X", location_name: null, built_year: null, notes: null },
      ],
      () => "Mộ",
    );
    expect(out.map((x) => x.key)).toEqual(["grave:g1", "grave:g2"]);
    expect(out[0].title).toContain("Mộ Tổ");
    expect(out[1].title).toContain("Mộ");
    expect(out[0].body).toBe("Hoài Nhơn");
    expect(out[1].body).toBe("Tu bổ");
  });

  it("mọi nguồn đều có nhãn", () => {
    for (const s of SUGGESTION_SOURCES) expect(suggestionSourceLabel(s).length).toBeGreaterThan(0);
  });

  it("đã sao chép một gợi ý (mọi nguồn) thì không gợi ý lại; khoá khác nguồn không đụng nhau", () => {
    const sug = fromEvents([ev({ id: "x", date_solar: "2000-01-01" })]);
    const rows = [{ source_key: "event:x" } as TimelineRow];
    expect(pendingSuggestions(sug, rows)).toEqual([]);
    expect(pendingSuggestions(sug, [{ source_key: "heritage:x" } as TimelineRow])).toHaveLength(1);
  });

  it("sao chép gợi ý từ nguồn khác thành dữ liệu mốc: giữ khoá nguồn", () => {
    const [s] = fromHeritage([{ id: "h", title: "Đình", summary: "Cổ", category: "place", built_year: 1800 }]);
    expect(candidateToInput(s)).toMatchObject({ year: 1800, title: "Đình", source_key: "heritage:h", photo_person_id: null });
  });
});
