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

  // SheetJS reads .csv buffers as Latin-1 by default — Vietnamese
  // diacritics arrive as mojibake (Họ tên → Há» tÃªn) and every
  // header lookup downstream fails. Detect plain-text formats by
  // filename + decode UTF-8 ourselves before handing to XLSX. For
  // real .xlsx (a ZIP archive) we keep the raw buffer.
  const isText = /\.(csv|tsv|txt)$/i.test(file.name);
  const wb = isText
    ? XLSX.read(new TextDecoder("utf-8").decode(buf), { type: "string", raw: false })
    : XLSX.read(buf, { type: "array" });
  return parseWorkbookFirstSheet(wb);
}

/**
 * Parse a pasted-in CSV string (e.g. from an AI chat response) and
 * return the same row-object shape as parseSpreadsheet. Strips common
 * markdown wrappers (```csv … ```) since LLMs tend to include them
 * even when asked not to.
 */
export function parseCsvText(text: string): Record<string, unknown>[] {
  // Drop markdown code fences if present. Handle both ```csv and bare ```.
  let cleaned = text.trim();
  const fence = cleaned.match(/^```(?:csv|tsv|txt)?\s*\n([\s\S]*?)\n?```\s*$/i);
  if (fence) cleaned = fence[1];
  if (!cleaned.trim()) return [];

  const wb = XLSX.read(cleaned, { type: "string", raw: false });
  return parseWorkbookFirstSheet(wb);
}

function parseWorkbookFirstSheet(
  wb: XLSX.WorkBook,
): Record<string, unknown>[] {
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];

  // Read as array-of-arrays so we can skip leading empty rows that
  // Excel sometimes prepends when re-saving UTF-8 CSV (eg ";;;;\r\n"
  // on the first line). SheetJS otherwise treats that empty row as
  // the header line, which makes every subsequent column come out
  // as __EMPTY_N and downstream header matching fails.
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });
  if (matrix.length === 0) return [];

  // Skip leading rows that are entirely empty / all-whitespace.
  let headerRowIdx = 0;
  while (
    headerRowIdx < matrix.length &&
    matrix[headerRowIdx].every((c) => String(c ?? "").trim() === "")
  ) {
    headerRowIdx++;
  }
  if (headerRowIdx >= matrix.length) return [];

  // Clean each header: strip BOM (U+FEFF) + zero-width chars +
  // surrounding whitespace. TextEdit / Notepad inject BOM on UTF-8
  // CSV save and SheetJS preserves it, breaking exact-match lookup
  // downstream.
  const cleanKey = (k: string): string =>
    k.replace(/[﻿​-‍‪-‮]/g, "").trim();

  const headers = matrix[headerRowIdx].map((h) => cleanKey(String(h ?? "")));

  // Convert remaining rows to keyed objects.
  const out: Record<string, unknown>[] = [];
  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (row.every((c) => String(c ?? "").trim() === "")) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (!h) return; // drop fully-empty header columns
      obj[h] = row[i] ?? "";
    });
    if (Object.keys(obj).length > 0) out.push(obj);
  }
  return out;
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
