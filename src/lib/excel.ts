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
    "ID Vợ/Chồng",
    "Thuỷ tổ",
    "Chi",
    "Ghi chú",
  ];
  // Ví dụ thực tế: thuỷ tổ + vợ, con trai (lấy vợ — dâu nối bằng ID Vợ/Chồng),
  // và vợ 2 (đặt ID thêm "b" cho dễ nhớ, nối bằng ID Vợ/Chồng).
  const example = [
    // ID,   Họ tên,        GT, Sinh, Mất, Cha,  Mẹ,   Vợ/Chồng, Thuỷ tổ, Chi,     Ghi chú
    ["C1", "Lê Cụ Tổ", "M", 1900, 1970, "", "", "V1", "x", "Chi cả", "Thuỷ tổ đời 1"],
    ["V1", "Đỗ Thị Cụ", "F", 1905, 1980, "", "", "C1", "", "Chi cả", "Vợ cụ tổ"],
    ["C2", "Lê Văn Một", "M", 1930, "", "C1", "V1", "V2", "", "Chi cả", "Con cụ tổ, có 2 vợ"],
    ["V2", "Đỗ Thị Hai", "F", 1935, "", "", "", "C2", "", "Chi cả", "Vợ cả của C2"],
    ["V2b", "Trần Thị Hai", "F", 1940, "", "", "", "C2", "", "Chi cả", "Vợ hai của C2 (ID + 'b')"],
    ["C3", "Lê Văn Ba", "M", 1955, "", "C2", "V2", "", "", "Chi cả", "Con C2 với vợ cả"],
    ["C4", "Lê Văn Bốn", "M", 1962, "", "C2", "V2b", "", "", "Chi cả", "Con C2 với vợ hai"],
  ];

  const guide = [
    ["HƯỚNG DẪN ĐIỀN MẪU GIA PHẢ"],
    [""],
    ["Cột", "Ý nghĩa"],
    ["ID", "Mã tạm bạn tự đặt cho mỗi người (vd C1, V1…). Cha/mẹ/vợ/chồng nối theo ID này, KHÔNG theo tên."],
    ["Họ tên", "Họ và tên đầy đủ. (Bắt buộc)"],
    ["Giới tính", "M = Nam, F = Nữ (hoặc Nam/Nữ). (Bắt buộc)"],
    ["Năm sinh / Năm mất", "Chỉ cần năm (vd 1930). Bỏ trống Năm mất nếu còn sống."],
    ["ID Cha / ID Mẹ", "Điền ID của cha/mẹ (người đã có ở cột ID). Để trống nếu không rõ."],
    ["ID Vợ/Chồng", "Điền ID người bạn đời để nối cặp TRỰC TIẾP (không cần qua con). Dâu/rể chỉ cần điền ID của người trong họ vào đây."],
    ["Thuỷ tổ", "Đánh 'x' cho người là thuỷ tổ (đời 1). Để trống với người khác."],
    ["Chi", "Tên chi/nhánh (tuỳ chọn)."],
    ["Ghi chú", "Tiểu sử, chức vụ… (tuỳ chọn)."],
    [""],
    ["MẸO ĐẶT ID DÂU/RỂ CHO DỄ NHỚ (góp ý người dùng):"],
    ["- Vợ/chồng đặt ID gợi nhớ theo người trong họ; vợ 2 thêm chữ 'b' (vd C2 → vợ V2, vợ hai V2b)."],
    ["- Nhiều vợ: mỗi người vợ điền ID Vợ/Chồng = ID người chồng. Con thì điền ID Mẹ đúng người vợ sinh ra con đó."],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...example]);
  ws["!cols"] = [
    { wch: 6 }, { wch: 16 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
    { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Gia pha");
  const wsGuide = XLSX.utils.aoa_to_sheet(guide);
  wsGuide["!cols"] = [{ wch: 22 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, "Hướng dẫn");
  XLSX.writeFile(wb, filename);
}
