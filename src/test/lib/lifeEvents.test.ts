import { describe, expect, it } from "vitest";

import { lifeEvents } from "@/lib/personTimeline";

describe("lifeEvents — mốc đời người từ lúc sinh đến lúc mất", () => {
  const base = { birthYear: 1887, deathYear: 1942 };

  it("sinh (kèm nơi sinh) → con chào đời → mất (kèm tuổi thọ, nơi an táng), xếp đúng thứ tự", () => {
    const ev = lifeEvents({
      ...base,
      birthPlace: "Hoài Nhơn",
      burialPlace: "Nghĩa trang họ",
      children: [
        { full_name: "Hồ B", birth_date: "1915-03-01" },
        { full_name: "Hồ A", birth_date: "1910-01-01" },
      ],
    }).sort((a, b) => a.year - b.year || a.sort - b.sort);
    expect(ev.map((e) => [e.year, e.title])).toEqual([
      [1887, "Sinh"],
      [1910, "Con đầu lòng chào đời"],
      [1915, "Con chào đời"],
      [1942, "Mất"],
    ]);
    expect(ev[0].body).toBe("Sinh tại Hoài Nhơn");
    expect(ev[1].body).toBe("Hồ A"); // con sinh sớm nhất là con đầu lòng
    expect(ev[3].body).toBe("Thọ 55 tuổi. An táng tại Nghĩa trang họ");
  });

  it("người còn sống: có Sinh, không có Mất", () => {
    const ev = lifeEvents({ birthYear: 1990, deathYear: null });
    expect(ev.map((e) => e.title)).toEqual(["Sinh"]);
  });

  it("không biết năm sinh: không có Sinh, vẫn có Mất (không có tuổi thọ)", () => {
    const ev = lifeEvents({ birthYear: null, deathYear: 1942 });
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ year: 1942, title: "Mất", body: null });
  });

  it("bỏ con không có năm sinh hoặc năm sinh lệch hẳn đời người (dữ liệu sai)", () => {
    const ev = lifeEvents({
      ...base,
      children: [
        { full_name: "Không năm", birth_date: null },
        { full_name: "Trước khi cha sinh", birth_date: "1850-01-01" },
        { full_name: "Sau khi cha mất 5 năm", birth_date: "1947-01-01" },
        { full_name: "Con di phúc", birth_date: "1943-01-01" }, // sinh sau khi cha mất ≤ 1 năm: hợp lệ
      ],
    });
    expect(ev.filter((e) => e.title.startsWith("Con")).map((e) => e.body)).toEqual(["Con di phúc"]);
  });

  it("cha / mẹ mất khi người này còn sống mới tính; mất trước khi sinh thì bỏ", () => {
    const ev = lifeEvents({
      ...base,
      parents: [
        { full_name: "Cụ Ông", gender: "M", death_date: "1900-01-01" },
        { full_name: "Cụ Bà", gender: "F", death_date: "1880-01-01" }, // trước khi sinh
      ],
    });
    expect(ev.filter((e) => e.title === "Cha mất" || e.title === "Mẹ mất").map((e) => [e.year, e.title, e.body])).toEqual([
      [1900, "Cha mất", "Cụ Ông"],
    ]);
  });
});
