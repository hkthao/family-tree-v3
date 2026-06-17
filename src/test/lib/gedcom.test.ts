import { describe, expect, it } from "vitest";

import { parseGedcom } from "@/lib/gedcom/parse";
import { serializeClanToGedcom } from "@/lib/gedcom/serialize";
import type { ClanBookData } from "@/lib/queries/clan-book";
import type { ClanDetail } from "@/lib/queries/clan-detail";
import type { PersonDetail } from "@/lib/queries/persons";

function makePerson(over: Partial<PersonDetail> & Pick<PersonDetail, "id" | "full_name" | "gender">): PersonDetail {
  return {
    clan_id: "c1",
    is_living: true,
    is_root: false,
    birth_date: null,
    birth_date_precision: null,
    death_date: null,
    death_date_precision: null,
    generation: null,
    branch_id: null,
    courtesy_name: null,
    posthumous_name: null,
    nickname: null,
    bio: null,
    birth_place: null,
    burial_place: null,
    photo_path: null,
    birth_lunar_year: null,
    birth_lunar_month: null,
    birth_lunar_day: null,
    death_lunar_year: null,
    death_lunar_month: null,
    death_lunar_day: null,
    death_anniv_lunar_month: null,
    death_anniv_lunar_day: null,
    todo_excluded: false,
    birth_order: null,
    ...over,
  };
}

const clan = {
  id: "c1",
  name: "Họ Nguyễn",
  description: "Demo for tests",
  visibility: "private",
  data_version: 1,
  owner_id: "u1",
  max_persons: 100,
  max_users: 10,
  myRole: "admin",
  isPlatformAdmin: false,
  person_count: 0,
} as unknown as ClanDetail;

describe("GEDCOM serialize → parse round-trip", () => {
  it("preserves names, dates, gender, custom Vietnamese fields", () => {
    const persons: PersonDetail[] = [
      makePerson({
        id: "p1",
        full_name: "Nguyễn Văn A",
        gender: "M",
        is_root: true,
        is_living: false,
        generation: 1,
        birth_date: "1900-01-15",
        birth_date_precision: "day",
        death_date: "1970-03-20",
        death_date_precision: "day",
        birth_place: "Hà Nội",
        burial_place: "Hà Nội",
        courtesy_name: "Văn Đại",
        nickname: "Tiểu Long",
        posthumous_name: "Trung Hiếu",
        birth_lunar_year: 1899,
        birth_lunar_month: 12,
        birth_lunar_day: 15,
        death_anniv_lunar_month: 2,
        death_anniv_lunar_day: 10,
      }),
      makePerson({
        id: "p2",
        full_name: "Trần Thị B",
        gender: "F",
        birth_date: "1905-06-10",
        birth_date_precision: "day",
      }),
      makePerson({
        id: "p3",
        full_name: "Nguyễn Văn C",
        gender: "M",
        generation: 2,
      }),
    ];
    const data: ClanBookData = {
      persons,
      families: [{ id: "f1", husband_id: "p1", wife_id: "p2" }],
      branches: [],
      childToFamily: { p3: "f1" },
    };

    const ged = serializeClanToGedcom(clan, data);
    expect(ged).toContain("0 HEAD");
    expect(ged).toContain("0 TRLR");
    expect(ged).toMatch(/0 @I1@ INDI/);
    expect(ged).toMatch(/1 NAME \/Nguyễn\/ Văn A/);

    const parsed = parseGedcom(ged);
    expect(parsed.clan.name).toBe("Họ Nguyễn");
    expect(parsed.indis).toHaveLength(3);
    expect(parsed.fams).toHaveLength(1);

    const i1 = parsed.indis.find((i) => i.fullName === "Nguyễn Văn A")!;
    expect(i1.gender).toBe("M");
    expect(i1.isRoot).toBe(true);
    expect(i1.generation).toBe(1);
    expect(i1.birthDate).toBe("1900-01-15");
    expect(i1.birthDatePrecision).toBe("day");
    expect(i1.deathDate).toBe("1970-03-20");
    expect(i1.isLiving).toBe(false);
    expect(i1.birthPlace).toBe("Hà Nội");
    expect(i1.burialPlace).toBe("Hà Nội");
    expect(i1.courtesyName).toBe("Văn Đại");
    expect(i1.nickname).toBe("Tiểu Long");
    expect(i1.posthumousName).toBe("Trung Hiếu");
    expect(i1.birthLunarYear).toBe(1899);
    expect(i1.birthLunarMonth).toBe(12);
    expect(i1.birthLunarDay).toBe(15);
    expect(i1.gioMonth).toBe(2);
    expect(i1.gioDay).toBe(10);

    // Family pointers
    const fam = parsed.fams[0];
    expect(fam.husbandPtr).toBe(i1.ptr);
    expect(fam.childPtrs).toHaveLength(1);

    // p3's FAMC pointer should point to fam
    const i3 = parsed.indis.find((i) => i.fullName === "Nguyễn Văn C")!;
    expect(i3.famcPtr).toBe(fam.ptr);
  });

  it("handles partial dates (year + month only)", () => {
    const persons: PersonDetail[] = [
      makePerson({
        id: "p1",
        full_name: "X Y Z",
        gender: "M",
        birth_date: "1950-06-01",
        birth_date_precision: "month",
      }),
      makePerson({
        id: "p2",
        full_name: "A B C",
        gender: "F",
        birth_date: "1950-01-01",
        birth_date_precision: "year",
      }),
    ];
    const ged = serializeClanToGedcom(clan, {
      persons,
      families: [],
      branches: [],
      childToFamily: {},
    });
    expect(ged).toMatch(/1 BIRT[^]*?2 DATE JUN 1950/);
    expect(ged).toMatch(/1 BIRT[^]*?2 DATE 1950(?!-)/);

    const parsed = parseGedcom(ged);
    const xyz = parsed.indis.find((i) => i.fullName === "X Y Z")!;
    expect(xyz.birthDate).toBe("1950-06-01");
    expect(xyz.birthDatePrecision).toBe("month");
    const abc = parsed.indis.find((i) => i.fullName === "A B C")!;
    expect(abc.birthDate).toBe("1950-01-01");
    expect(abc.birthDatePrecision).toBe("year");
  });

  it("emits and re-parses _INLAW blocks round-trip", () => {
    const persons: PersonDetail[] = [
      makePerson({ id: "p1", full_name: "Nguyễn Thị Lan", gender: "F" }),
    ];
    const data: ClanBookData = {
      persons,
      families: [],
      branches: [],
      childToFamily: {},
    };
    const ged = serializeClanToGedcom(clan, data, [
      {
        localPersonId: "p1",
        peek: {
          masked: false,
          clan_id: "c2",
          clan_name: "Họ Trần",
          generation_offset: 0,
          person_id: "p2",
          full_name: "Trần Văn B",
          gender: "M",
          generation: 4,
          birth_year: 1980,
          death_year: null,
          is_living: true,
        },
      },
      // A second link (e.g. dual-clan record), also for p1 — should
      // emit two _INLAW blocks under that INDI.
      {
        localPersonId: "p1",
        peek: {
          masked: true,
          clan_id: "c3",
          clan_name: "Họ Lê",
          generation_offset: 0,
          person_id: "p3",
          is_living: true,
        },
      },
    ]);

    // Sanity check the raw text: both blocks present, masked entry
    // emits a placeholder _PERSON string.
    expect(ged).toMatch(/1 _INLAW[\s\S]*2 _CLAN Họ Trần[\s\S]*2 _PERSON Trần Văn B/);
    expect(ged).toMatch(/2 _CLAN Họ Lê/);
    expect(ged).toMatch(/người còn sống, chưa công khai/);

    // Round-trip: parser exposes the same fields on the INDI.
    const parsed = parseGedcom(ged);
    const indi = parsed.indis[0];
    expect(indi.inlaws).toHaveLength(2);
    const real = indi.inlaws.find((x) => x.clanName === "Họ Trần")!;
    expect(real.personName).toBe("Trần Văn B");
    expect(real.gender).toBe("M");
    expect(real.birthYear).toBe(1980);
    expect(real.deathYear).toBeNull();
    const masked = indi.inlaws.find((x) => x.clanName === "Họ Lê")!;
    expect(masked.personName).toMatch(/chưa công khai/);
    expect(masked.gender).toBeNull();
    expect(masked.birthYear).toBeNull();
  });

  it("foreign GEDCOM with surname in trailing slashes still parses", () => {
    const foreign = `0 HEAD
1 CHAR UTF-8
0 @I1@ INDI
1 NAME John /Smith/
1 SEX M
1 BIRT
2 DATE 5 MAR 1950
0 TRLR
`;
    const parsed = parseGedcom(foreign);
    expect(parsed.indis[0].fullName).toBe("John Smith");
    expect(parsed.indis[0].birthDate).toBe("1950-03-05");
  });
});
