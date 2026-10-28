import { describe, expect, it } from "vitest";

import { loadCalendarDateValue } from "@/lib/personDates";

import {
  composeBio,
  composeProse,
  dateColumns,
  photoLine,
  validate,
  type Citation,
  type DynastyFile,
  type SourceDef,
} from "../../scripts/historical/validate-lib";

// Dữ liệu GIẢ hoàn toàn — chỉ để kiểm logic validator.
const sources: SourceDef[] = [
  { code: "A1", title: "Chính sử 1", tier: "A" },
  { code: "A2", title: "Chính sử 2", tier: "A" },
  { code: "C1", title: "Bách khoa mở", tier: "C" },
];

const cite = (field: string, source = "A1", value?: string): Citation => ({
  field,
  source,
  locator: "Q.1, tờ 2a",
  quote: "đoạn trích nguyên văn dài đủ",
  value,
});

function base(): DynastyFile {
  return {
    clan: { key: "thu", name: "Nhà Thử" },
    persons: [
      {
        key: "thu.cha",
        full_name: "Cha Thử",
        gender: "M",
        is_root: true,
        birth: { lunar_year: 1200 },
        death: { lunar_year: 1260, lunar_month: 4, lunar_day: 3 },
        citations: [
          cite("existence"),
          cite("existence", "A2"),
          cite("birth", "A1", "âm 1200"),
          cite("death", "A1", "âm 1260-4-3"),
        ],
        review: { status: "verified" },
      },
      {
        key: "thu.me",
        full_name: "Mẹ Thử",
        gender: "F",
        citations: [cite("existence")],
        review: { status: "verified" },
      },
      {
        key: "thu.con",
        full_name: "Con Thử",
        gender: "M",
        birth: { lunar_year: 1230 },
        parents: "u.cha-me",
        reigns: [{ dynasty: "Thử", start_year: 1250, end_year: 1258 }],
        citations: [cite("existence"), cite("birth", "A1", "âm 1230"), cite("parents"), cite("reign:0")],
        review: { status: "verified" },
      },
    ],
    unions: [
      {
        key: "u.cha-me",
        husband: "thu.cha",
        wife: "thu.me",
        citations: [cite("union")],
        review: { status: "verified" },
      },
    ],
  };
}

const errs = (f: DynastyFile, publishOnly = false) => validate(f, sources, { publishOnly }).errors.join("\n");
const warns = (f: DynastyFile) => validate(f, sources).warnings.join("\n");

describe("validate (gia phả lịch sử)", () => {
  it("file hợp lệ → không lỗi, tính mức tin cậy theo số nguồn", () => {
    const r = validate(base(), sources, { publishOnly: true });
    expect(r.errors).toEqual([]);
    expect(r.confidence.get("thu.cha")?.get("existence")).toBe("confirmed");
    expect(r.confidence.get("thu.cha")?.get("birth")).toBe("single_source");
  });

  it("không sửa citations của file nháp (tránh ghi trùng khi nhập)", () => {
    const f = base();
    validate(f, sources);
    expect(f.persons[0].citations).toHaveLength(4);
  });

  it("dữ kiện thiếu trích dẫn → lỗi", () => {
    const f = base();
    f.persons[2].citations = f.persons[2].citations.filter((c) => c.field !== "parents");
    expect(errs(f)).toContain('người thu.con: dữ kiện "parents" không có trích dẫn');
  });

  it("chỉ có nguồn tầng C → không đủ để công bố", () => {
    const f = base();
    f.persons[1].citations = [cite("existence", "C1")];
    expect(errs(f)).toMatch(/chỉ có nguồn tầng C/);
  });

  it("thiếu trích nguyên văn / vị trí → lỗi", () => {
    const f = base();
    f.persons[1].citations = [{ ...cite("existence"), quote: "", locator: " " }];
    expect(errs(f)).toMatch(/thiếu trích dẫn nguyên văn/);
    f.persons[1].citations = [{ ...cite("existence"), quote: "諱晃" }];
    expect(errs(f)).toMatch(/quá ngắn/);
    f.persons[1].citations = [{ ...cite("existence"), quote: "諱晃，太宗適長子也" }];
    expect(errs(f)).toBe("");
    f.persons[1].citations = [{ ...cite("existence"), quote: "", locator: " " }];
    expect(errs(f)).toMatch(/thiếu trích dẫn nguyên văn/);
    expect(errs(f)).toMatch(/thiếu vị trí/);
  });

  it("giá trị trên form phải khớp giá trị một nguồn ghi", () => {
    const f = base();
    f.persons[1].nickname = "Huý Thử";
    f.persons[1].citations.push(cite("nickname", "A1"));
    expect(errs(f)).toMatch(/trích dẫn "nickname" thiếu value/);
    f.persons[1].citations[1].value = "Huý Khác";
    expect(errs(f)).toMatch(/"nickname" = "Huý Thử" không khớp nguồn nào/);
    f.persons[1].citations[1].value = "huý  thử";
    expect(errs(f)).toBe("");
  });

  it("các nguồn ghi khác nhau → disputed (form giữ một trong các dị bản)", () => {
    const f = base();
    f.persons[0].citations.push(cite("birth", "A2", "âm 1201"));
    const r = validate(f, sources);
    expect(r.errors).toEqual([]);
    expect(r.confidence.get("thu.cha")?.get("birth")).toBe("disputed");
  });

  it("nguồn ghi gọn hơn (chỉ tháng) không phải dị bản; khác tháng mới là dị bản", () => {
    const f = base();
    f.persons[0].citations.push(cite("death", "A2", "âm 1260-4"));
    expect(validate(f, sources).confidence.get("thu.cha")?.get("death")).toBe("confirmed");
    f.persons[0].citations.push(cite("death", "A2", "âm 1260-5"));
    expect(validate(f, sources).confidence.get("thu.cha")?.get("death")).toBe("disputed");
  });

  it("cha hơn con dưới 12 tuổi / mất trước khi con sinh → lỗi", () => {
    const f = base();
    f.persons[2].birth = { lunar_year: 1205 };
    f.persons[2].citations[1].value = "âm 1205";
    expect(errs(f)).toMatch(/chỉ hơn 5 tuổi/);
    f.persons[2].birth = { lunar_year: 1262 };
    f.persons[2].citations[1].value = "âm 1262";
    f.persons[2].reigns = [];
    f.persons[2].citations = f.persons[2].citations.filter((c) => c.field !== "reign:0");
    expect(errs(f)).toMatch(/mất \(1260\) trước khi con sinh/);
  });

  it("vòng lặp tổ tiên → lỗi", () => {
    const f = base();
    f.unions.push({ key: "u.con", husband: "thu.con", citations: [] });
    f.persons[0].parents = "u.con";
    f.persons[0].citations.push(cite("parents"));
    expect(errs(f)).toMatch(/vòng lặp tổ tiên/);
  });

  it("publishOnly: người đã duyệt nhưng cha mẹ chưa duyệt → lỗi", () => {
    const f = base();
    f.unions[0].review = { status: "draft" };
    expect(errs(f, true)).toMatch(/parents \(u.cha-me\) chưa duyệt/);
    expect(errs(f)).toBe("");
  });

  it("trị vì ngoài đời sống → lỗi", () => {
    const f = base();
    f.persons[2].birth = { lunar_year: 1255 };
    f.persons[2].citations[1].value = "âm 1255";
    expect(errs(f)).toMatch(/lên ngôi \(1250\) trước khi sinh/);
  });

  it("tiểu sử quá dài → lỗi; văn phong cảm thán → cảnh báo; dòng nguồn tự thêm", () => {
    const f = base();
    f.persons[1].bio = "x".repeat(900);
    f.persons[1].citations.push(cite("bio"));
    expect(errs(f)).toMatch(/tiểu sử 900 ký tự/);
    f.persons[1].bio = "Bà là người vô cùng hiền đức!";
    expect(warns(f)).toMatch(/văn phong sử/);
    f.persons[1].bio = "Bà là con gái nhà Thử.";
    expect(composeBio(f.persons[1], sources)).toBe("Bà là con gái nhà Thử.\n\nTheo: Chính sử 1 (Q.1, tờ 2a).");
  });
});

describe("thuỷ tổ + số đời", () => {
  it("tính đời như DB: thuỷ tổ 1, vợ cùng đời, con +1", () => {
    const g = validate(base(), sources).generations;
    expect(Object.fromEntries(g)).toEqual({ "thu.cha": 1, "thu.me": 1, "thu.con": 2 });
  });

  it("không có thuỷ tổ / nhiều thuỷ tổ → lỗi", () => {
    const f = base();
    f.persons[0].is_root = false;
    expect(errs(f)).toMatch(/chưa có thuỷ tổ/);
    f.persons[0].is_root = true;
    f.persons[2].is_root = true;
    expect(errs(f)).toMatch(/có 2 thuỷ tổ/);
  });

  it("thuỷ tổ có cha mẹ trong file → lỗi", () => {
    const f = base();
    f.persons.push({ key: "thu.ong", full_name: "Ông", gender: "M", citations: [cite("existence")] });
    f.unions.push({ key: "u.ong", husband: "thu.ong", citations: [] });
    f.persons[0].parents = "u.ong";
    f.persons[0].citations.push(cite("parents"));
    expect(errs(f)).toMatch(/thuỷ tổ thu.cha không được có cha mẹ/);
  });

  it("cha của dâu (họ khác) không nối được về thuỷ tổ → lỗi", () => {
    const f = base();
    f.persons.push({ key: "khac.cha-dau", full_name: "Cha của dâu", gender: "M", citations: [cite("existence")] });
    f.unions.push({ key: "u.khac", husband: "khac.cha-dau", citations: [] });
    f.persons[1].parents = "u.khac";
    f.persons[1].citations.push(cite("parents"));
    expect(errs(f)).toMatch(/khac.cha-dau: không nối được về thuỷ tổ.*dòng họ khác/);
  });

  it("chỉ có cha mẹ nuôi → không có đời → lỗi kèm gợi ý", () => {
    const f = base();
    f.persons.push({
      key: "thu.nuoi",
      full_name: "Con nuôi",
      gender: "M",
      adoptive_parents: "u.cha-me",
      citations: [cite("existence"), cite("adoptive_parents")],
    });
    expect(errs(f)).toMatch(/thu.nuoi: .*chỉ có cha mẹ nuôi/);
  });

  it("publishOnly: chỉ xét người sẽ nhập", () => {
    const f = base();
    f.persons[0].review = { status: "draft" };
    expect(errs(f, true)).toMatch(/chưa có thuỷ tổ/);
  });
});

describe("ảnh + tên tự/húy/thụy", () => {
  const photo = {
    url: "https://upload.wikimedia.org/wikipedia/commons/a/a9/Example.jpg",
    source_page: "https://commons.wikimedia.org/wiki/File:Example.jpg",
    license: "CC BY-SA 4.0",
    author: "Tác giả",
    kind: "later_depiction" as const,
  };

  it("ảnh hợp lệ; tranh đời sau ghi rõ không phải chân dung thật", () => {
    const f = base();
    f.persons[0].photo = photo;
    expect(errs(f)).toBe("");
    expect(warns(f)).toMatch(/tranh vẽ đời sau/);
    expect(photoLine(photo)).toBe(
      "Ảnh: tranh vẽ đời sau, không phải chân dung thật — Tác giả, CC BY-SA 4.0, Wikimedia Commons.",
    );
  });

  it("ảnh ngoài Commons / giấy phép không tự do / thiếu tác giả → lỗi", () => {
    const f = base();
    f.persons[0].photo = { ...photo, url: "https://example.com/a.jpg", license: "All rights reserved" };
    expect(errs(f)).toMatch(/upload.wikimedia.org/);
    expect(errs(f)).toMatch(/không thuộc PD/);
    f.persons[0].photo = { ...photo, author: null };
    expect(errs(f)).toMatch(/cần ghi tác giả/);
    f.persons[0].photo = { ...photo, license: "PD-old", author: null };
    expect(errs(f)).toBe("");
  });

  it("vua/chúa thiếu tên húy/thụy/tự → cảnh báo", () => {
    expect(warns(base())).toMatch(/thu.con: vua\/chúa chưa có Tên húy, Tên thụy, Tên tự/);
  });
});

describe("lăng tẩm, di sản, thông gia", () => {
  it("lăng hợp lệ: địa danh khớp nguồn, người an táng có trích dẫn", () => {
    const f = base();
    f.persons[0].burial_place = "Lăng Thử";
    f.persons[0].citations.push(cite("burial_place", "A1", "Lăng Thử"));
    f.resting_places = [
      {
        key: "lang.thu",
        name: "Lăng Thử",
        location_name: "hương Thử",
        occupants: ["thu.cha"],
        citations: [cite("existence"), cite("location_name", "A1", "hương Thử"), cite("occupant:0")],
      },
    ];
    expect(errs(f)).toBe("");
    f.resting_places[0].citations = [cite("existence"), cite("location_name", "A1", "hương Khác")];
    expect(errs(f)).toMatch(/"location_name" = "hương Thử" không khớp/);
    expect(errs(f)).toMatch(/"occupant:0" không có trích dẫn/);
  });

  it("toạ độ chỉ theo Wikidata → cảnh báo (không chặn); ngoài Việt Nam → cảnh báo", () => {
    const f = base();
    f.resting_places = [
      {
        key: "lang.thu",
        name: "Lăng Thử",
        latitude: 48.8,
        longitude: 2.3,
        occupants: ["thu.cha"],
        citations: [cite("existence"), cite("occupant:0"), cite("coordinates", "C1")],
      },
    ];
    expect(errs(f)).toBe("");
    expect(warns(f)).toMatch(/"coordinates" chỉ theo nguồn tầng C/);
    expect(warns(f)).toMatch(/nằm ngoài Việt Nam/);
    expect(warns(f)).toMatch(/an táng tại Lăng Thử nhưng chưa điền Nơi an táng/);
  });

  it("di sản: nội dung quá dài → lỗi; người liên quan phải có", () => {
    const f = base();
    f.heritage = [
      {
        key: "ds.den",
        category: "place",
        title: "Đền Thử",
        body: "x".repeat(1600),
        people: [{ person: "thu.khong-co" }],
        citations: [cite("existence"), cite("body"), cite("person:0")],
      },
    ];
    expect(errs(f)).toMatch(/nội dung 1600 ký tự/);
    expect(errs(f)).toMatch(/không có người "thu.khong-co"/);
  });

  it("nội dung di sản tự thêm dòng nguồn", () => {
    expect(composeProse("Đền thờ các vua.", [cite("existence")], sources)).toBe(
      "Đền thờ các vua.\n\nTheo: Chính sử 1 (Q.1, tờ 2a).",
    );
  });

  it("thông gia: cần trích dẫn same_person, không trỏ về chính dòng họ", () => {
    const f = base();
    f.same_person_links = [{ person: "thu.me", other_clan: "thu", other_person: "x.me", citations: [] }];
    expect(errs(f)).toMatch(/phải là dòng họ khác/);
    expect(errs(f)).toMatch(/"same_person" không có trích dẫn/);
    f.same_person_links = [{ person: "thu.me", other_clan: "khac", other_person: "khac.con-gai", citations: [cite("same_person")] }];
    expect(errs(f)).toBe("");
  });
});

describe("sự kiện", () => {
  it("lễ hội âm lịch hợp lệ; ngày phải khớp nguồn", () => {
    const f = base();
    f.events = [
      { key: "sk.le", title: "Lễ hội Thử", date: { lunar_month: 1, lunar_day: 15 }, citations: [cite("existence"), cite("date", "A1", "âm ?-1-15")] },
    ];
    expect(errs(f)).toBe("");
    f.events[0].citations[1].value = "âm ?-1-14";
    expect(errs(f)).toMatch(/"date" = "âm \?-1-15" không khớp/);
  });

  it("không khai giỗ cho người đã có ngày mất (app tự sinh)", () => {
    const f = base();
    f.events = [
      {
        key: "sk.gio",
        title: "Giỗ Cha Thử",
        event_type: "memorial",
        related_person: "thu.cha",
        date: { lunar_month: 4, lunar_day: 3 },
        citations: [cite("existence"), cite("date", "A1", "âm ?-4-3"), cite("related_person")],
      },
    ];
    expect(errs(f)).toMatch(/app tự sinh giỗ/);
  });

  it("tế lăng cần lăng; ngày không được vừa âm vừa dương", () => {
    const f = base();
    f.events = [
      { key: "sk.te", title: "Tế lăng", event_type: "tomb_visit", date: { lunar_month: 2, lunar_day: 1, solar: "2026-03-01" }, citations: [cite("existence"), cite("date")] },
    ];
    expect(errs(f)).toMatch(/cần resting_place/);
    expect(errs(f)).toMatch(/không cả hai/);
  });
});

describe("đa thê", () => {
  function polygamy(): DynastyFile {
    const f = base();
    f.persons.push({ key: "thu.phi", full_name: "Phi Thử", gender: "F", citations: [cite("existence")] });
    f.unions.push({ key: "u.cha-phi", husband: "thu.cha", wife: "thu.phi", citations: [cite("union")] });
    return f;
  }

  it("nhiều vợ chưa xếp thứ tự → cảnh báo; thứ tự trùng → lỗi", () => {
    const f = polygamy();
    expect(warns(f)).toMatch(/2 vợ nhưng .* chưa có spouse_order/);
    f.unions[0].spouse_order = 1;
    f.unions[1].spouse_order = 1;
    expect(errs(f)).toMatch(/spouse_order bị trùng/);
    f.unions[1].spouse_order = 2;
    expect(errs(f)).toBe("");
  });

  it("khai trùng cặp vợ chồng / nhiều hôn nhân khuyết mẹ → lỗi", () => {
    const f = polygamy();
    f.unions.push({ key: "u.cha-phi-2", husband: "thu.cha", wife: "thu.phi", citations: [cite("union")] });
    f.unions.push({ key: "u.cha-x", husband: "thu.cha", citations: [] }, { key: "u.cha-y", husband: "thu.cha", citations: [] });
    expect(errs(f)).toMatch(/khai trùng hôn nhân/);
    expect(errs(f)).toMatch(/2 hôn nhân khuyết mẹ/);
  });

  it("con thứ mấy trùng giữa các con của cùng cha (khác mẹ) → cảnh báo", () => {
    const f = polygamy();
    const kid = (key: string, parents: string) => ({
      key,
      full_name: key,
      gender: "M" as const,
      parents,
      birth_order: 2,
      citations: [cite("existence"), cite("parents"), cite("birth_order", "A1", "2")],
    });
    f.persons.push(kid("thu.a", "u.cha-me"), kid("thu.b", "u.cha-phi"));
    expect(warns(f)).toMatch(/nhiều con cùng là "con thứ 2"/);
  });
});

describe("cột ngày giống form", () => {
  it("đủ ngày âm (sau 1800) → lưu âm + dương quy đổi; form mở ra đúng ngày", () => {
    // Mùng 1 Tết Canh Thìn = 05/02/2000.
    const c = dateColumns({ lunar_year: 2000, lunar_month: 1, lunar_day: 1 });
    expect(c).toMatchObject({ date: "2000-02-05", precision: "day", lunar_year: 2000, lunar_month: 1, lunar_day: 1 });
    const form = loadCalendarDateValue({
      solarDate: c.date,
      solarPrecision: c.precision,
      lunarYear: c.lunar_year,
      lunarMonth: c.lunar_month,
      lunarDay: c.lunar_day,
    });
    expect(form.parts).toEqual({ year: "2000", month: "02", day: "05" });
  });

  it("trước 1800 → giữ ngày âm như sử chép + năm, KHÔNG quy đổi ra ngày dương", () => {
    expect(dateColumns({ lunar_year: 1369, lunar_month: 5, lunar_day: 25 })).toMatchObject({
      date: "1369-01-01",
      precision: "year",
      lunar_year: 1369,
      lunar_month: 5,
      lunar_day: 25,
      lunarOnly: true,
    });
  });

  it("trước 1800: ngày giỗ lấy thẳng từ tháng/ngày âm", () => {
    const f = base();
    const r = validate(f, sources);
    expect(r.columns.get("thu.cha")).toMatchObject({ death_anniv_lunar_month: 4, death_anniv_lunar_day: 3 });
  });

  it("chỉ năm âm → năm dương, độ chính xác năm (cây hiển thị được)", () => {
    expect(dateColumns({ lunar_year: 1258 })).toMatchObject({ date: "1258-01-01", precision: "year", lost: null });
  });

  it("năm + tháng Chạp âm (sau 1800) → có thể sang năm dương sau; báo chi tiết bị mất", () => {
    const c = dateColumns({ lunar_year: 1999, lunar_month: 12 });
    expect(c).toMatchObject({ date: "2000-01-01", precision: "year" });
    expect(c.lost).toBe("âm 1999-12");
  });

  it("chỉ tháng/ngày âm (giỗ) → lưu âm, suy ra ngày giỗ như form", () => {
    const r = validate(
      {
        clan: { key: "thu", name: "Nhà Thử" },
        persons: [
          {
            key: "thu.a",
            full_name: "A",
            gender: "M",
            is_root: true,
            death: { lunar_month: 4, lunar_day: 3 },
            citations: [cite("existence"), cite("death", "A1", "âm ?-4-3")],
          },
        ],
        unions: [],
      },
      sources,
    );
    expect(r.errors).toEqual([]);
    expect(r.columns.get("thu.a")).toMatchObject({
      death: { date: null, lunar_month: 4, lunar_day: 3 },
      death_anniv_lunar_month: 4,
      death_anniv_lunar_day: 3,
    });
  });

  it("ngày âm không tồn tại → lỗi", () => {
    // Năm 2000 không có tháng nhuận.
    expect(() => dateColumns({ lunar_year: 2000, lunar_month: 2, lunar_day: 10, lunar_leap: true })).toThrow(/không tồn tại/);
  });
});
