import { describe, expect, it } from "vitest";

import {
  FESTIVALS,
  festivalsOn,
  hasFestival,
  upcomingFestivals,
} from "@/lib/festivals";
import { lunarToSolarString, solarStringToLunar } from "@/lib/lunarDate";

/**
 * Ngày lễ Việt — thứ người dùng mở lịch ra để tìm.
 *
 * Test đi từ NGÀY DƯƠNG thật (quy đổi bằng chính hàm âm lịch của app)
 * chứ không gõ tay ngày dương: gõ tay là chép lại chính cái sai nếu bảng
 * quy đổi lệch.
 */

const solarOf = (year: number, month: number, day: number) =>
  lunarToSolarString({ year, month, day, isLeap: false })!;

describe("festivalsOn — mấy ngày người dùng hỏi", () => {
  it("Vu Lan = rằm tháng Bảy", () => {
    const names = festivalsOn(solarOf(2026, 7, 15)).map((f) => f.name);
    expect(names.join(" ")).toMatch(/Vu Lan/);
  });

  it("Trung Thu = rằm tháng Tám", () => {
    expect(festivalsOn(solarOf(2026, 8, 15)).map((f) => f.key)).toContain(
      "trung-thu",
    );
  });

  it("Phật Đản = rằm tháng Tư", () => {
    expect(festivalsOn(solarOf(2026, 4, 15)).map((f) => f.key)).toContain(
      "phat-dan",
    );
  });

  it("Ông Công Ông Táo = 23 tháng Chạp", () => {
    expect(festivalsOn(solarOf(2025, 12, 23)).map((f) => f.key)).toContain(
      "ong-cong-ong-tao",
    );
  });

  it("Mùng 1 Tết", () => {
    expect(festivalsOn(solarOf(2026, 1, 1)).map((f) => f.key)).toContain(
      "tet-mung-1",
    );
  });
});

describe("ngày lễ dương lịch tính theo lịch dương", () => {
  it("Quốc khánh luôn là 2/9 dương, không phải 2/9 âm", () => {
    expect(festivalsOn("2026-09-02").map((f) => f.key)).toContain("quoc-khanh");
  });

  it("30/4 và 1/5", () => {
    expect(festivalsOn("2026-04-30").map((f) => f.key)).toContain("giai-phong");
    expect(festivalsOn("2026-05-01").map((f) => f.key)).toContain(
      "quoc-te-lao-dong",
    );
  });
});

describe("Tất niên: ngày CUỐI tháng Chạp, không viết cứng 30", () => {
  /**
   * Tháng Chạp thiếu thì năm đó là "29 Tết" — viết cứng ngày 30 là năm
   * nào tháng Chạp 29 ngày sẽ mất hẳn giao thừa khỏi lịch.
   */
  //
  // Cạm bẫy của thư viện âm lịch: hỏi ngày 30 của tháng Chạp CHỈ CÓ 29
  // ngày thì nó KHÔNG trả null — nó trả luôn mùng 1 Tết. Nên phải quy đổi
  // ngược lại để kiểm, chứ tin thẳng là lấy nhầm ngày.
  const lastDayOf = (lunarYear: number): string => {
    for (const d of [30, 29]) {
      const iso = lunarToSolarString({
        year: lunarYear,
        month: 12,
        day: d,
        isLeap: false,
      });
      const back = iso ? solarStringToLunar(iso) : null;
      if (iso && back && back.month === 12 && back.day === d) return iso;
    }
    throw new Error("không tìm được ngày cuối tháng Chạp");
  };

  it("thư viện âm lịch TRÀN ngày khi tháng thiếu — lý do phải hỏi ngược", () => {
    // Âm 2025 tháng Chạp chỉ có 29 ngày. Hỏi ngày 30 ra… mùng 1 Tết.
    const iso = lunarToSolarString({ year: 2025, month: 12, day: 30, isLeap: false });
    const back = solarStringToLunar(iso!);
    expect(back).toMatchObject({ month: 1, day: 1 });
    // Chính vì vậy isLastLunarDay hỏi "hôm sau có sang tháng khác không"
    // thay vì thử dựng ngày 30.
    expect(festivalsOn(iso!).map((f) => f.key)).toContain("tet-mung-1");
  });

  it("nhận ra giao thừa ở cả năm tháng Chạp đủ lẫn thiếu", () => {
    for (const y of [2024, 2025, 2026, 2027]) {
      const keys = festivalsOn(lastDayOf(y)).map((f) => f.key);
      expect(keys, `năm âm ${y}`).toContain("giao-thua");
    }
  });

  it("giữa tháng Chạp thì KHÔNG phải giao thừa", () => {
    expect(festivalsOn(solarOf(2025, 12, 15)).map((f) => f.key)).not.toContain(
      "giao-thua",
    );
  });
});

describe("tháng nhuận", () => {
  it("rằm tháng NHUẬN không phải ngày lễ", () => {
    // Năm âm 2025 có tháng Sáu nhuận. Rằm tháng đó không phải lễ nào cả.
    const iso = lunarToSolarString({
      year: 2025,
      month: 6,
      day: 15,
      isLeap: true,
    });
    if (iso) expect(festivalsOn(iso)).toEqual([]);
  });
});

describe("bảng dữ liệu", () => {
  it("không trùng khoá", () => {
    const keys = FESTIVALS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("mỗi ngày lễ đều có tên và một dòng giải thích", () => {
    for (const f of FESTIVALS) {
      expect(f.name.length, f.key).toBeGreaterThan(2);
      expect(f.note.length, f.key).toBeGreaterThan(5);
    }
  });

  it("ngày thường thì không có lễ", () => {
    expect(hasFestival(solarOf(2026, 7, 7))).toBe(false);
  });
});

describe("upcomingFestivals — ghép vào danh sách sắp tới", () => {
  it("tìm được lễ trong khoảng ngày, kèm số ngày còn lại", () => {
    // 25/9/2026 là Trung Thu. Đứng ở 20/9 nhìn tới 30 ngày phải thấy nó
    // với daysUntil = 5.
    const rows = upcomingFestivals("2026-09-20", 30);
    const tt = rows.find((r) => r.key.includes("trung-thu"));
    expect(tt?.daysUntil).toBe(5);
    expect(tt?.date).toBe("2026-09-25");
    expect(tt?.kind).toBe("festival");
  });

  it("tính cả HÔM NAY (daysUntil = 0)", () => {
    const rows = upcomingFestivals("2026-09-02", 7);
    expect(rows[0]?.daysUntil).toBe(0);
    expect(rows[0]?.title).toMatch(/Quốc khánh/);
  });

  it("khoảng ngắn thì không lôi lễ ở xa về", () => {
    expect(upcomingFestivals("2026-09-20", 2)).toEqual([]);
  });

  it("khoá không trùng nhau — dùng làm key React", () => {
    const keys = upcomingFestivals("2026-01-01", 400).map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("một năm có đủ mấy lễ chính, không sót không lặp", () => {
    const keys = upcomingFestivals("2026-01-01", 400).map((r) =>
      r.key.split(":")[1],
    );
    for (const must of ["vu-lan", "trung-thu", "phat-dan", "quoc-khanh"]) {
      expect(keys.filter((k) => k === must).length, must).toBe(1);
    }
  });

  it("số ngày âm hoặc quá lớn không làm sập", () => {
    expect(upcomingFestivals("2026-09-20", -5)).toEqual(
      upcomingFestivals("2026-09-20", 0),
    );
    expect(upcomingFestivals("2026-09-20", 99999).length).toBeGreaterThan(0);
  });
});
