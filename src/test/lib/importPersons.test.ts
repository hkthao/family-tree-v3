import { describe, expect, it } from "vitest";

import { planImport, type RawRow } from "@/lib/importPersons";

// Stable id generator for tests
function idGen() {
  let n = 0;
  return () => `00000000-0000-0000-0000-${String(++n).padStart(12, "0")}`;
}

function row(over: Partial<Record<string, unknown>> = {}): RawRow {
  return {
    ID: "",
    "Họ tên": "",
    "Giới tính": "",
    "Năm sinh": "",
    "Năm mất": "",
    "ID Cha": "",
    "ID Mẹ": "",
    Chi: "",
    "Ghi chú": "",
    ...over,
  };
}

describe("planImport — header detection", () => {
  it("rejects empty file", () => {
    const p = planImport([], { newId: idGen() });
    expect(p.issues[0].severity).toBe("error");
    expect(p.issues[0].message).toMatch(/trống/);
  });

  it("rejects missing required headers", () => {
    const p = planImport([{ foo: "bar" }], { newId: idGen() });
    const msgs = p.issues.map((i) => i.message);
    expect(msgs.some((m) => /họ tên/i.test(m))).toBe(true);
  });

  it("matches diacritic-stripped + alternative aliases", () => {
    const p = planImport(
      [{ id: "P1", "ho ten": "Nguyễn A", gender: "M" }],
      { newId: idGen() },
    );
    // No "missing required header" errors
    expect(p.issues.filter((i) => /bắt buộc/i.test(i.message))).toHaveLength(0);
  });
});

describe("planImport — row validation", () => {
  it("flags duplicate ID, missing name, invalid gender", () => {
    const p = planImport(
      [
        row({ ID: "P1", "Họ tên": "A", "Giới tính": "M" }),
        row({ ID: "P1", "Họ tên": "", "Giới tính": "Q" }),
      ],
      { newId: idGen() },
    );
    const errs = p.issues.filter((i) => i.severity === "error");
    expect(errs.some((e) => /trùng/.test(e.message))).toBe(true);
    expect(errs.some((e) => /Thiếu họ tên/.test(e.message))).toBe(true);
    expect(errs.some((e) => /M\/F/.test(e.message))).toBe(true);
  });

  it("rejects unknown parent ID", () => {
    const p = planImport(
      [
        row({ ID: "P1", "Họ tên": "A", "Giới tính": "M", "ID Cha": "GHOST" }),
      ],
      { newId: idGen() },
    );
    expect(
      p.issues.some(
        (i) => i.severity === "error" && /không tồn tại/.test(i.message),
      ),
    ).toBe(true);
  });

  it("self-as-parent is blocked", () => {
    const p = planImport(
      [
        row({ ID: "P1", "Họ tên": "Solo", "Giới tính": "M", "ID Cha": "P1" }),
      ],
      { newId: idGen() },
    );
    expect(
      p.issues.some(
        (i) => i.severity === "error" && /chính mình/.test(i.message),
      ),
    ).toBe(true);
  });

  it("ancestor cycle is detected", () => {
    const p = planImport(
      [
        row({ ID: "A", "Họ tên": "A", "Giới tính": "M", "ID Cha": "B" }),
        row({ ID: "B", "Họ tên": "B", "Giới tính": "M", "ID Cha": "A" }),
      ],
      { newId: idGen() },
    );
    expect(
      p.issues.some(
        (i) => i.severity === "error" && /Vòng lặp/.test(i.message),
      ),
    ).toBe(true);
  });

  it("birth-after-death is a warning, not an error", () => {
    const p = planImport(
      [
        row({
          ID: "P1",
          "Họ tên": "Anachronism",
          "Giới tính": "M",
          "Năm sinh": "1990",
          "Năm mất": "1980",
        }),
      ],
      { newId: idGen() },
    );
    const warn = p.issues.find((i) => i.severity === "warning");
    expect(warn?.message).toMatch(/Năm sinh muộn/);
    expect(p.issues.some((i) => i.severity === "error")).toBe(false);
  });
});

describe("planImport — payload assembly", () => {
  it("year-only birth becomes precision='year', placeholder 01-01", () => {
    const p = planImport(
      [
        row({
          ID: "P1",
          "Họ tên": "Ông",
          "Giới tính": "M",
          "Năm sinh": "1900",
        }),
      ],
      { newId: idGen() },
    );
    expect(p.payload?.persons[0].birth_date).toBe("1900-01-01");
    expect(p.payload?.persons[0].birth_date_precision).toBe("year");
  });

  it("creates one family per unique (father, mother) pair", () => {
    const p = planImport(
      [
        row({ ID: "F1", "Họ tên": "Bố", "Giới tính": "M" }),
        row({ ID: "M1", "Họ tên": "Mẹ", "Giới tính": "F" }),
        row({
          ID: "C1",
          "Họ tên": "Con1",
          "Giới tính": "M",
          "ID Cha": "F1",
          "ID Mẹ": "M1",
        }),
        row({
          ID: "C2",
          "Họ tên": "Con2",
          "Giới tính": "F",
          "ID Cha": "F1",
          "ID Mẹ": "M1",
        }),
      ],
      { newId: idGen() },
    );
    expect(p.payload?.families.length).toBe(1);
    // Two children share birth_family_id
    const c1 = p.payload!.persons.find((x) => x.full_name === "Con1")!;
    const c2 = p.payload!.persons.find((x) => x.full_name === "Con2")!;
    expect(c1.birth_family_id).toBe(c2.birth_family_id);
    expect(c1.birth_family_id).toBe(p.payload!.families[0].id);
  });

  it("supports single-parent rows (only father OR only mother)", () => {
    const p = planImport(
      [
        row({ ID: "F1", "Họ tên": "Bố", "Giới tính": "M" }),
        row({
          ID: "C1",
          "Họ tên": "Con",
          "Giới tính": "M",
          "ID Cha": "F1",
        }),
      ],
      { newId: idGen() },
    );
    expect(p.payload?.families.length).toBe(1);
    expect(p.payload!.families[0].husband_id).toBeTruthy();
    expect(p.payload!.families[0].wife_id).toBeNull();
  });

  it("creates one branch per unique branch name and links persons", () => {
    const p = planImport(
      [
        row({ ID: "P1", "Họ tên": "A", "Giới tính": "M", Chi: "Chi cả" }),
        row({ ID: "P2", "Họ tên": "B", "Giới tính": "F", Chi: "Chi cả" }),
        row({ ID: "P3", "Họ tên": "C", "Giới tính": "M", Chi: "Chi hai" }),
      ],
      { newId: idGen() },
    );
    expect(p.payload?.branches.length).toBe(2);
    const a = p.payload!.persons.find((x) => x.full_name === "A")!;
    const b = p.payload!.persons.find((x) => x.full_name === "B")!;
    const c = p.payload!.persons.find((x) => x.full_name === "C")!;
    expect(a.branch_id).toBe(b.branch_id);
    expect(a.branch_id).not.toBe(c.branch_id);
  });

  it("death_year set → is_living=false; absent → is_living=true", () => {
    const p = planImport(
      [
        row({
          ID: "P1",
          "Họ tên": "Living",
          "Giới tính": "M",
          "Năm sinh": "1980",
        }),
        row({
          ID: "P2",
          "Họ tên": "Departed",
          "Giới tính": "F",
          "Năm sinh": "1900",
          "Năm mất": "1970",
        }),
      ],
      { newId: idGen() },
    );
    const a = p.payload!.persons.find((x) => x.full_name === "Living")!;
    const b = p.payload!.persons.find((x) => x.full_name === "Departed")!;
    expect(a.is_living).toBe(true);
    expect(b.is_living).toBe(false);
  });

  it("never sets is_root automatically — Thuỷ tổ stays a manual flag", () => {
    const p = planImport(
      [row({ ID: "P1", "Họ tên": "Orphan", "Giới tính": "M" })],
      { newId: idGen() },
    );
    expect(p.payload!.persons[0].is_root).toBe(false);
  });

  it("blocking errors → payload is null", () => {
    const p = planImport(
      [row({ ID: "", "Họ tên": "", "Giới tính": "" })],
      { newId: idGen() },
    );
    expect(p.payload).toBeNull();
  });
});
