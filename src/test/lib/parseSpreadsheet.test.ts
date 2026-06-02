import { describe, expect, it } from "vitest";

import { parseSpreadsheet } from "@/lib/excel";

/**
 * Helpers: turn a string into a File so the parser sees the same
 * shape it gets from the browser file picker. parseSpreadsheet
 * branches on filename extension so the name matters.
 */
function csvFile(name: string, content: string): File {
  return new File([content], name, { type: "text/csv" });
}

const CANONICAL_CSV =
  "ID,Họ tên,Giới tính,Năm sinh,Năm mất,ID Cha,ID Mẹ,Chi,Ghi chú\r\n" +
  "P001,Nguyễn Văn An,M,1900,1970,,,,Thuỷ tổ\r\n" +
  "P002,Trần Thị Bình,F,1905,1980,,,,Vợ của An\r\n" +
  "P003,Nguyễn Văn Cường,M,1930,,P001,P002,,Làm nông\r\n";

describe("parseSpreadsheet", () => {
  it("parses a clean UTF-8 CSV with Vietnamese diacritics", async () => {
    const rows = await parseSpreadsheet(csvFile("data.csv", CANONICAL_CSV));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      ID: "P001",
      "Họ tên": "Nguyễn Văn An",
      "Giới tính": "M",
      "Ghi chú": "Thuỷ tổ",
    });
    expect(rows[2]["ID Cha"]).toBe("P001");
  });

  it("strips a leading UTF-8 BOM injected by TextEdit / Notepad", async () => {
    const withBom = "﻿" + CANONICAL_CSV;
    const rows = await parseSpreadsheet(csvFile("data.csv", withBom));
    expect(rows).toHaveLength(3);
    // The first header would otherwise carry the BOM ("﻿ID")
    // and break exact-match lookups.
    expect(Object.keys(rows[0])).toContain("ID");
    expect(rows[0].ID).toBe("P001");
  });

  it("skips one or more empty leading rows that Excel re-save adds", async () => {
    const withBlank = ",,,,,,,,\r\n,,,,,,,,\r\n" + CANONICAL_CSV;
    const rows = await parseSpreadsheet(csvFile("data.csv", withBlank));
    expect(rows).toHaveLength(3);
    expect(rows[0]["Họ tên"]).toBe("Nguyễn Văn An");
  });

  it("handles semicolon-separated CSV from VN-locale Excel", async () => {
    const semi = CANONICAL_CSV.replace(/,/g, ";");
    const rows = await parseSpreadsheet(csvFile("data.csv", semi));
    expect(rows).toHaveLength(3);
    expect(rows[0]["Họ tên"]).toBe("Nguyễn Văn An");
    expect(rows[0]["Giới tính"]).toBe("M");
  });

  it("trims trailing whitespace from header keys", async () => {
    const padded =
      "ID , Họ tên , Giới tính , Năm sinh , Năm mất , ID Cha , ID Mẹ , Chi , Ghi chú \r\n" +
      "P001,Nguyễn Văn An,M,1900,1970,,,,Thuỷ tổ\r\n";
    const rows = await parseSpreadsheet(csvFile("data.csv", padded));
    expect(rows).toHaveLength(1);
    // No "Họ tên " with trailing space — should resolve to clean key.
    expect(Object.keys(rows[0])).toContain("Họ tên");
  });

  it("returns empty array for an entirely blank file", async () => {
    const rows = await parseSpreadsheet(csvFile("data.csv", ",,,\r\n,,,\r\n"));
    expect(rows).toEqual([]);
  });

  it("preserves embedded commas inside quoted cells", async () => {
    const csv =
      "ID,Họ tên,Giới tính,Năm sinh,Năm mất,ID Cha,ID Mẹ,Chi,Ghi chú\r\n" +
      'P001,"Nguyễn, Văn A",M,1900,,,,,"sinh tại Hà Nội, làm nông"\r\n';
    const rows = await parseSpreadsheet(csvFile("data.csv", csv));
    expect(rows[0]["Họ tên"]).toBe("Nguyễn, Văn A");
    expect(rows[0]["Ghi chú"]).toBe("sinh tại Hà Nội, làm nông");
  });
});
