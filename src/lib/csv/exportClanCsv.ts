/**
 * CSV export — round-trips with the Excel importer.
 *
 * The importer (lib/importPersons.ts) consumes these columns:
 *   ID | Họ tên | Giới tính | Năm sinh | Năm mất | ID Cha | ID Mẹ | Chi | Ghi chú
 *
 * We emit the exact same shape so a user can: export → edit in Excel →
 * re-import via the existing Nhập từ Excel page. Lossy fields that
 * the importer doesn't carry (lunar dates, courtesy/posthumous/
 * nickname, photos, places) are dropped on export — that's a deliberate
 * limitation of the import format, not the export.
 *
 * Temp IDs are assigned deterministically in person fetch order
 * (clan_book ordering: generation asc, birth_date asc) so re-exporting
 * unchanged data produces a byte-identical file — useful for diffs.
 */

import type { ClanBookData } from "@/lib/queries/clan-book";
import type { ClanDetail } from "@/lib/queries/clan-detail";

const HEADERS = [
  "ID",
  "Họ tên",
  "Giới tính",
  "Năm sinh",
  "Năm mất",
  "ID Cha",
  "ID Mẹ",
  "Chi",
  "Ghi chú",
] as const;

/**
 * Escape one cell value for RFC 4180 CSV:
 *   - wrap in quotes if it contains comma, quote, CR or LF
 *   - double up embedded quotes
 *   - null / undefined → empty
 */
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s === "") return "";
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function yearOf(date: string | null | undefined): string {
  if (!date) return "";
  const y = date.slice(0, 4);
  return /^\d{4}$/.test(y) ? y : "";
}

export interface CsvExportResult {
  filename: string;
  bytes: number;
}

/**
 * Build the CSV string. Pure — no I/O. Caller wraps in a Blob to
 * download. Exposed separately so unit tests can assert content.
 */
export function buildClanCsv(data: ClanBookData): string {
  const familyById = new Map(data.families.map((f) => [f.id, f]));
  const branchById = new Map(data.branches.map((b) => [b.id, b.name]));

  // Assign deterministic temp IDs (P001, P002…) in the order persons
  // arrive — the importer rebuilds parent links via these IDs, not
  // names, so two people with the same full name don't collide.
  const tempIdByPerson = new Map<string, string>();
  data.persons.forEach((p, i) => {
    tempIdByPerson.set(p.id, `P${String(i + 1).padStart(3, "0")}`);
  });

  const rows: string[][] = [HEADERS.slice() as unknown as string[]];

  for (const p of data.persons) {
    const familyId = data.childToFamily[p.id];
    const family = familyId ? familyById.get(familyId) : null;
    const fatherTempId = family?.husband_id
      ? (tempIdByPerson.get(family.husband_id) ?? "")
      : "";
    const motherTempId = family?.wife_id
      ? (tempIdByPerson.get(family.wife_id) ?? "")
      : "";
    const branchName = p.branch_id ? (branchById.get(p.branch_id) ?? "") : "";

    rows.push([
      tempIdByPerson.get(p.id) ?? "",
      p.full_name,
      p.gender,
      yearOf(p.birth_date),
      yearOf(p.death_date),
      fatherTempId,
      motherTempId,
      branchName,
      p.bio ?? "",
    ]);
  }

  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/**
 * Build the CSV and trigger a browser download. Returns the filename
 * + size so callers can surface it in a toast.
 */
export function downloadClanCsv(
  clan: ClanDetail,
  data: ClanBookData,
): CsvExportResult {
  // UTF-8 BOM so Excel on Windows opens the file with diacritics
  // intact instead of mojibake. Linux / macOS Excel ignores it.
  const csv = "﻿" + buildClanCsv(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });

  const safe = clan.name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9-_]/g, "_");
  const today = new Date().toISOString().slice(0, 10);
  const filename = `gia-pha_${safe}_${today}.csv`;

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
