import { describe, expect, it } from "vitest";

import { buildClanCsv } from "@/lib/csv/exportClanCsv";
import { planImport, type RawRow } from "@/lib/importPersons";
import type { ClanBookData } from "@/lib/queries/clan-book";
import type { PersonDetail } from "@/lib/queries/persons";

/**
 * Parse a CSV string into the same shape that XLSX would produce
 * (Record<string, unknown> per row, keyed by header). This isn't a
 * full RFC 4180 parser — it handles what buildClanCsv emits: comma
 * separators, CRLF rows, double-quoted cells with embedded "" and
 * commas.
 */
function parseCsv(csv: string): RawRow[] {
  const text = csv.replace(/^﻿/, "");
  const lines: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        cur.push(cell);
        cell = "";
      } else if (c === "\r") {
        // ignore — CRLF handled by \n below
      } else if (c === "\n") {
        cur.push(cell);
        lines.push(cur);
        cur = [];
        cell = "";
      } else cell += c;
    }
  }
  if (cell !== "" || cur.length > 0) {
    cur.push(cell);
    lines.push(cur);
  }
  // Drop trailing all-empty row from the final CRLF
  while (lines.length > 0 && lines[lines.length - 1].every((c) => c === ""))
    lines.pop();
  if (lines.length === 0) return [];
  const headers = lines[0];
  return lines.slice(1).map((row) => {
    const obj: RawRow = {};
    headers.forEach((h, i) => (obj[h] = row[i] ?? ""));
    return obj;
  });
}

function person(
  over: Partial<PersonDetail> & Pick<PersonDetail, "id" | "full_name">,
): PersonDetail {
  return {
    clan_id: "c1",
    gender: "M",
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
    ...over,
  } as PersonDetail;
}

describe("buildClanCsv → planImport round-trip", () => {
  it("emits the importer-canonical 9 headers", () => {
    const csv = buildClanCsv({
      persons: [],
      families: [],
      branches: [],
      childToFamily: {},
    });
    expect(csv.split("\r\n")[0]).toBe(
      "ID,Họ tên,Giới tính,Năm sinh,Năm mất,ID Cha,ID Mẹ,Chi,Ghi chú",
    );
  });

  it("round-trips a 3-person family — child correctly wired to both parents", () => {
    const data: ClanBookData = {
      persons: [
        person({
          id: "u-dad",
          full_name: "Nguyễn Văn A",
          gender: "M",
          is_living: false,
          birth_date: "1900-01-01",
          death_date: "1970-01-01",
          generation: 1,
          is_root: true,
          branch_id: "br1",
        }),
        person({
          id: "u-mom",
          full_name: "Trần Thị B",
          gender: "F",
          is_living: false,
          birth_date: "1905-01-01",
          death_date: "1980-01-01",
          generation: 1,
        }),
        person({
          id: "u-kid",
          full_name: "Nguyễn Văn C",
          gender: "M",
          birth_date: "1930-01-01",
          generation: 2,
          branch_id: "br1",
          bio: "ghi chú có dấu phẩy, và xuống\ndòng",
        }),
      ],
      families: [{ id: "f1", husband_id: "u-dad", wife_id: "u-mom" }],
      branches: [{ id: "br1", name: "Chi cả" }],
      childToFamily: { "u-kid": "f1" },
    };

    const csv = buildClanCsv(data);
    const parsed = parseCsv(csv);
    expect(parsed).toHaveLength(3);

    const plan = planImport(parsed);
    expect(plan.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(plan.payload).not.toBeNull();
    const payload = plan.payload!;

    expect(payload.persons).toHaveLength(3);
    expect(payload.branches.map((b) => b.name)).toEqual(["Chi cả"]);
    // Exactly one family — both parents on the kid resolve to the
    // same (father_uuid, mother_uuid) tuple.
    expect(payload.families).toHaveLength(1);

    const kid = payload.persons.find((p) => p.full_name === "Nguyễn Văn C")!;
    const dad = payload.persons.find((p) => p.full_name === "Nguyễn Văn A")!;
    const mom = payload.persons.find((p) => p.full_name === "Trần Thị B")!;
    expect(kid.birth_family_id).toBe(payload.families[0].id);
    expect(payload.families[0].husband_id).toBe(dad.id);
    expect(payload.families[0].wife_id).toBe(mom.id);

    expect(kid.bio).toBe("ghi chú có dấu phẩy, và xuống\ndòng");
  });

  it("yields deterministic temp IDs in person order", () => {
    const data: ClanBookData = {
      persons: [
        person({ id: "u-1", full_name: "A" }),
        person({ id: "u-2", full_name: "B" }),
        person({ id: "u-3", full_name: "C" }),
      ],
      families: [],
      branches: [],
      childToFamily: {},
    };
    const parsed = parseCsv(buildClanCsv(data));
    expect(parsed.map((r) => r.ID)).toEqual(["P001", "P002", "P003"]);
  });

  it("escapes embedded quotes per RFC 4180", () => {
    const data: ClanBookData = {
      persons: [
        person({
          id: "u-1",
          full_name: 'Bob "Bố" Nguyễn',
          bio: 'có "ngoặc kép" và, phẩy',
        }),
      ],
      families: [],
      branches: [],
      childToFamily: {},
    };
    const csv = buildClanCsv(data);
    // The dangerous cells must come back through the parser intact.
    const parsed = parseCsv(csv);
    expect(parsed[0]["Họ tên"]).toBe('Bob "Bố" Nguyễn');
    expect(parsed[0]["Ghi chú"]).toBe('có "ngoặc kép" và, phẩy');
  });
});
