import type { ImportIssue } from "@/lib/importPersons";

/** Escape one cell value for RFC 4180 CSV. */
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s === "") return "";
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildIssuesCsv(issues: readonly ImportIssue[]): string {
  const rows: string[][] = [["Dòng", "Mức độ", "Thông báo"]];
  for (const iss of issues) {
    rows.push([
      iss.rowIndex > 0 ? String(iss.rowIndex) : "",
      iss.severity === "error" ? "Lỗi" : "Cảnh báo",
      iss.message,
    ]);
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/**
 * Trigger a browser download of the issue list as a CSV the user can
 * open in Excel side-by-side with their source file to fix issues in
 * batch. UTF-8 BOM keeps Vietnamese diacritics intact on Windows Excel.
 */
export function downloadIssuesCsv(
  sourceFileName: string | null,
  issues: readonly ImportIssue[],
): { filename: string; bytes: number } {
  const csv = "﻿" + buildIssuesCsv(issues);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });

  const stem = (sourceFileName ?? "file")
    .replace(/\.(xlsx|xls|csv)$/i, "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9-_]/g, "_");
  const today = new Date().toISOString().slice(0, 10);
  const filename = `loi-nhap_${stem}_${today}.csv`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return { filename, bytes: blob.size };
}
