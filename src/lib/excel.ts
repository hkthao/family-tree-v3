import * as XLSX from "xlsx";

/**
 * Parse an .xlsx/.xls/.csv file and return the first sheet as an array
 * of plain objects keyed by header name. SheetJS is loaded lazily by
 * the page that needs it so the rest of the app stays light.
 */
export async function parseSpreadsheet(
  file: File,
): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  // defval: "" → keep empty cells as empty string (not undefined) so
  // downstream code can `.trim()` without null-checking.
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  // Strip BOM (﻿) + leading/trailing whitespace from every key. TextEdit
  // / Notepad inject BOM when saving UTF-8 CSV, turning "ID" into
  // "﻿ID" so downstream header matching fails. Doing this here once
  // is cheaper than every consumer remembering to handle it.
  return rows.map((r) => {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      cleaned[k.replace(/[﻿​-‍‪-‮]/g, "").trim()] = v;
    }
    return cleaned;
  });
}

/**
 * Build + download an .xlsx template with the columns the importer
 * expects, prefilled with a tiny example family. Helps users get the
 * column order right on the first try.
 */
export function downloadTemplate(filename = "mau-gia-pha.xlsx"): void {
  const headers = [
    "ID",
    "Họ tên",
    "Giới tính",
    "Năm sinh",
    "Năm mất",
    "ID Cha",
    "ID Mẹ",
    "Chi",
    "Ghi chú",
  ];
  const example = [
    ["P001", "Nguyễn Văn A", "M", 1900, 1970, "", "", "Chi cả", "Thuỷ tổ"],
    ["P002", "Trần Thị B", "F", 1905, 1980, "", "", "Chi cả", ""],
    ["P003", "Nguyễn Văn C", "M", 1930, "", "P001", "P002", "Chi cả", ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Gia pha");
  XLSX.writeFile(wb, filename);
}
