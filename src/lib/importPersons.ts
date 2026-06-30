/**
 * Excel → RPC payload pipeline.
 *
 * The spreadsheet shape mandated by plan §14:
 *   ID | Họ tên | Giới tính | Năm sinh | Năm mất | ID Cha | ID Mẹ | Chi | Ghi chú
 * The `ID` column is a user-assigned temp identifier (e.g. P001). Parent
 * lookups use these temp IDs, never names — Vietnamese clans regularly
 * have multiple people sharing a full name.
 *
 * This module turns those raw rows into:
 *   - resolved persons (with UUIDs, parsed years, branch_id, birth_family_id)
 *   - one family per unique (father, mother) pair
 *   - one branch per unique branch name
 * plus a list of validation issues. Errors block the import; warnings are
 * surfaced for the user to acknowledge.
 */

/**
 * Canonical column names. Importer attempts to match the spreadsheet's
 * headers case-insensitively and tolerates a few common alternatives.
 */
const COL = {
  tempId: ["id", "id tạm", "ma", "ma so", "stt", "code", "person id"],
  fullName: ["họ tên", "ho ten", "họ và tên", "name", "tên", "full name", "fullname", "ten"],
  gender: ["giới tính", "gioi tinh", "gender", "gt", "sex"],
  birthYear: ["năm sinh", "nam sinh", "birth year", "ns", "year of birth", "birth"],
  deathYear: ["năm mất", "nam mat", "death year", "nm", "year of death", "death"],
  fatherTempId: ["id cha", "father id", "cha", "father", "ma cha", "id father"],
  motherTempId: ["id mẹ", "id me", "mother id", "mẹ", "me", "mother", "ma me", "id mother"],
  spouseTempId: [
    "id vợ/chồng", "id vo/chong", "id vợ chồng", "id vo chong",
    "id vợ", "id vo", "id chồng", "id chong",
    "vợ/chồng", "vo/chong", "spouse id", "id spouse", "spouse",
  ],
  isRoot: ["thuỷ tổ", "thuy to", "thủy tổ", "is root", "root", "thuy to?", "thuỷ tổ?"],
  branch: ["chi", "chi họ", "branch", "nhánh", "nhanh"],
  notes: ["ghi chú", "ghi chu", "notes", "tiểu sử", "bio", "note", "remark", "ghi chu", "comment"],
} as const;

type ColKey = keyof typeof COL;

export interface RawRow {
  [header: string]: unknown;
}

export interface NormalisedRow {
  rowIndex: number; // 1-based for user-facing messages
  tempId: string;
  fullName: string;
  gender: "M" | "F" | null;
  birthYear: number | null;
  deathYear: number | null;
  fatherTempId: string | null;
  motherTempId: string | null;
  /** ID người bạn đời (dâu/rể nối thẳng vào người trong họ, không cần qua con). */
  spouseTempId: string | null;
  /** Thuỷ tổ (đời 1) — đánh dấu để set is_root khi import. */
  isRoot: boolean;
  branch: string | null;
  notes: string | null;
}

export interface ImportIssue {
  rowIndex: number;
  severity: "error" | "warning";
  field?: ColKey;
  message: string;
}

export interface ResolvedPerson {
  id: string;
  full_name: string;
  gender: "M" | "F";
  is_living: boolean;
  is_root: boolean;
  birth_date: string | null;
  birth_date_precision: "day" | "month" | "year" | null;
  death_date: string | null;
  death_date_precision: "day" | "month" | "year" | null;
  branch_id: string | null;
  birth_family_id: string | null;
  bio: string | null;
}

export interface ResolvedFamily {
  id: string;
  husband_id: string | null;
  wife_id: string | null;
}

export interface ResolvedBranch {
  id: string;
  name: string;
}

export interface ImportPayload {
  persons: ResolvedPerson[];
  families: ResolvedFamily[];
  branches: ResolvedBranch[];
}

export interface ImportPlan {
  rows: NormalisedRow[];
  issues: ImportIssue[];
  payload: ImportPayload | null; // null when there are blocking errors
}

// ---------------------------------------------------------------------------
// Header detection

/** Build a normalised lookup: lowercase + diacritic-stripped header → COL key. */
function buildHeaderMap(headers: string[]): Partial<Record<ColKey, string>> {
  const norm = (s: string) =>
    s
      // Strip BOM (﻿) — TextEdit/Notepad inject it when
      // saving UTF-8 .csv, turning "ID" into "﻿ID" so the
      // exact-match fails. Also drop other zero-width chars +
      // surrounding non-alphanumeric punctuation that AI output
      // sometimes sprinkles in ("**ID**", "ID:", etc).
      .replace(/[﻿​-‍‪-‮]/g, "")
      .replace(/^[^a-zA-Z0-9À-ỹ\s]+|[^a-zA-Z0-9À-ỹ\s]+$/g, "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim();

  const out: Partial<Record<ColKey, string>> = {};
  for (const h of headers) {
    const n = norm(h);
    for (const key of Object.keys(COL) as ColKey[]) {
      if (COL[key].some((alias) => norm(alias) === n)) {
        out[key] = h;
        break;
      }
    }
  }
  return out;
}

function pick(row: RawRow, header: string | undefined): string {
  if (!header) return "";
  const v = row[header];
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function asGender(v: string): "M" | "F" | null {
  const s = v.toLowerCase();
  if (s === "m" || s === "nam" || s === "male") return "M";
  if (s === "f" || s === "nữ" || s === "nu" || s === "female") return "F";
  return null;
}

function asYear(v: string): number | null {
  if (!v) return null;
  const n = Number(v);
  if (!Number.isInteger(n)) return null;
  if (n < 1 || n > 9999) return null;
  return n;
}

/** Nhận diện đánh dấu "có" (x / có / 1 / true / yes…) cho cột Thuỷ tổ. */
function asTruthy(v: string): boolean {
  const s = v.trim().toLowerCase();
  return ["x", "✓", "có", "co", "1", "true", "yes", "y", "thuỷ tổ", "thuy to"].includes(s);
}

// ---------------------------------------------------------------------------
// Main pipeline

/**
 * The full pipeline: parse-normalised rows → issues → final payload.
 * The caller already turned the spreadsheet into RawRow[] (plain objects
 * keyed by header). Pass an id-generator so tests can produce stable UUIDs.
 */
export function planImport(
  rawRows: RawRow[],
  opts: { newId?: () => string } = {},
): ImportPlan {
  const newId = opts.newId ?? (() => crypto.randomUUID());

  if (rawRows.length === 0) {
    return {
      rows: [],
      issues: [
        {
          rowIndex: 0,
          severity: "error",
          message: "File trống — không tìm thấy dữ liệu.",
        },
      ],
      payload: null,
    };
  }

  const headers = Object.keys(rawRows[0]);
  const headerMap = buildHeaderMap(headers);

  const issues: ImportIssue[] = [];
  // Header-presence check for the truly required cols.
  for (const req of ["tempId", "fullName", "gender"] as ColKey[]) {
    if (!headerMap[req]) {
      issues.push({
        rowIndex: 0,
        severity: "error",
        field: req,
        message: `Thiếu cột bắt buộc: ${COL[req][0]}`,
      });
    }
  }
  if (issues.some((i) => i.severity === "error")) {
    return { rows: [], issues, payload: null };
  }

  // Normalise every row.
  const rows: NormalisedRow[] = rawRows.map((r, idx) => ({
    rowIndex: idx + 2, // header is row 1
    tempId: pick(r, headerMap.tempId),
    fullName: pick(r, headerMap.fullName),
    gender: asGender(pick(r, headerMap.gender)),
    birthYear: asYear(pick(r, headerMap.birthYear)),
    deathYear: asYear(pick(r, headerMap.deathYear)),
    fatherTempId: pick(r, headerMap.fatherTempId) || null,
    motherTempId: pick(r, headerMap.motherTempId) || null,
    spouseTempId: pick(r, headerMap.spouseTempId) || null,
    isRoot: asTruthy(pick(r, headerMap.isRoot)),
    branch: pick(r, headerMap.branch) || null,
    notes: pick(r, headerMap.notes) || null,
  }));

  // Row-level validation.
  const idsSeen = new Map<string, number>(); // tempId → first rowIndex
  for (const r of rows) {
    if (!r.tempId) {
      issues.push({
        rowIndex: r.rowIndex,
        severity: "error",
        field: "tempId",
        message: "Thiếu ID tạm.",
      });
    } else {
      const prev = idsSeen.get(r.tempId);
      if (prev !== undefined) {
        issues.push({
          rowIndex: r.rowIndex,
          severity: "error",
          field: "tempId",
          message: `ID "${r.tempId}" trùng với dòng ${prev}.`,
        });
      } else {
        idsSeen.set(r.tempId, r.rowIndex);
      }
    }
    if (!r.fullName) {
      issues.push({
        rowIndex: r.rowIndex,
        severity: "error",
        field: "fullName",
        message: "Thiếu họ tên.",
      });
    }
    if (!r.gender) {
      issues.push({
        rowIndex: r.rowIndex,
        severity: "error",
        field: "gender",
        message: "Giới tính phải là M/F (hoặc Nam/Nữ).",
      });
    }
    if (
      r.birthYear !== null &&
      r.deathYear !== null &&
      r.birthYear > r.deathYear
    ) {
      issues.push({
        rowIndex: r.rowIndex,
        severity: "warning",
        message: "Năm sinh muộn hơn năm mất — kiểm tra lại.",
      });
    }
  }

  // FK validation: parents must exist in the spreadsheet.
  for (const r of rows) {
    if (r.fatherTempId && !idsSeen.has(r.fatherTempId)) {
      issues.push({
        rowIndex: r.rowIndex,
        severity: "error",
        field: "fatherTempId",
        message: `ID Cha "${r.fatherTempId}" không tồn tại trong file.`,
      });
    }
    if (r.motherTempId && !idsSeen.has(r.motherTempId)) {
      issues.push({
        rowIndex: r.rowIndex,
        severity: "error",
        field: "motherTempId",
        message: `ID Mẹ "${r.motherTempId}" không tồn tại trong file.`,
      });
    }
    if (r.fatherTempId && r.fatherTempId === r.tempId) {
      issues.push({
        rowIndex: r.rowIndex,
        severity: "error",
        field: "fatherTempId",
        message: "Một người không thể là cha của chính mình.",
      });
    }
    if (r.motherTempId && r.motherTempId === r.tempId) {
      issues.push({
        rowIndex: r.rowIndex,
        severity: "error",
        field: "motherTempId",
        message: "Một người không thể là mẹ của chính mình.",
      });
    }
    if (r.spouseTempId && !idsSeen.has(r.spouseTempId)) {
      issues.push({
        rowIndex: r.rowIndex,
        severity: "error",
        field: "spouseTempId",
        message: `ID Vợ/Chồng "${r.spouseTempId}" không tồn tại trong file.`,
      });
    }
    if (r.spouseTempId && r.spouseTempId === r.tempId) {
      issues.push({
        rowIndex: r.rowIndex,
        severity: "error",
        field: "spouseTempId",
        message: "Một người không thể là vợ/chồng của chính mình.",
      });
    }
  }

  // Cycle detection: walk parent chain from each row; bail at cap=200.
  const byTempId = new Map(rows.map((r) => [r.tempId, r]));
  for (const start of rows) {
    if (!start.tempId) continue;
    const visited = new Set<string>([start.tempId]);
    const queue: string[] = [start.tempId];
    let safety = 200;
    while (queue.length > 0 && safety-- > 0) {
      const cur = queue.shift()!;
      const node = byTempId.get(cur);
      if (!node) continue;
      for (const pid of [node.fatherTempId, node.motherTempId]) {
        if (!pid) continue;
        if (pid === start.tempId) {
          issues.push({
            rowIndex: start.rowIndex,
            severity: "error",
            message: `Vòng lặp tổ tiên — ${start.tempId} là tổ tiên của chính mình.`,
          });
          queue.length = 0;
          break;
        }
        if (!visited.has(pid)) {
          visited.add(pid);
          queue.push(pid);
        }
      }
    }
  }

  if (issues.some((i) => i.severity === "error")) {
    return { rows, issues, payload: null };
  }

  // ---------------------------------------------------------------------
  // Assemble payload.

  // Branches: unique by name
  const branchByName = new Map<string, ResolvedBranch>();
  for (const r of rows) {
    if (r.branch && !branchByName.has(r.branch)) {
      branchByName.set(r.branch, { id: newId(), name: r.branch });
    }
  }

  // temp id → uuid
  const uuidByTempId = new Map<string, string>();
  for (const r of rows) uuidByTempId.set(r.tempId, newId());

  // Families: unique by (father_uuid, mother_uuid)
  const familyKey = (fa: string | null, mo: string | null) =>
    `${fa ?? ""}|${mo ?? ""}`;
  const familyByKey = new Map<string, ResolvedFamily>();
  for (const r of rows) {
    if (!r.fatherTempId && !r.motherTempId) continue;
    const fa = r.fatherTempId ? uuidByTempId.get(r.fatherTempId)! : null;
    const mo = r.motherTempId ? uuidByTempId.get(r.motherTempId)! : null;
    const k = familyKey(fa, mo);
    if (!familyByKey.has(k)) {
      familyByKey.set(k, { id: newId(), husband_id: fa, wife_id: mo });
    }
  }

  // Families từ cột "ID Vợ/Chồng" — nối cặp TRỰC TIẾP, không cần qua con
  // (hỗ trợ cặp chưa có con + nhiều vợ). Husband = người M, wife = người F.
  for (const r of rows) {
    if (!r.spouseTempId) continue;
    const partner = byTempId.get(r.spouseTempId);
    if (!partner) continue; // đã báo lỗi FK ở trên
    // Cần đúng 1 nam + 1 nữ để xác định husband/wife.
    const males = [r, partner].filter((x) => x.gender === "M");
    const females = [r, partner].filter((x) => x.gender === "F");
    if (males.length !== 1 || females.length !== 1) {
      issues.push({
        rowIndex: r.rowIndex,
        severity: "warning",
        field: "spouseTempId",
        message: "Cặp vợ/chồng cần 1 nam + 1 nữ — bỏ qua liên kết này.",
      });
      continue;
    }
    const fa = uuidByTempId.get(males[0].tempId)!;
    const mo = uuidByTempId.get(females[0].tempId)!;
    const k = familyKey(fa, mo);
    if (!familyByKey.has(k)) {
      familyByKey.set(k, { id: newId(), husband_id: fa, wife_id: mo });
    }
  }

  // Resolved persons
  const persons: ResolvedPerson[] = rows.map((r) => {
    const familyId = (() => {
      if (!r.fatherTempId && !r.motherTempId) return null;
      const fa = r.fatherTempId ? uuidByTempId.get(r.fatherTempId)! : null;
      const mo = r.motherTempId ? uuidByTempId.get(r.motherTempId)! : null;
      return familyByKey.get(familyKey(fa, mo))?.id ?? null;
    })();
    const birthDate =
      r.birthYear !== null ? `${String(r.birthYear).padStart(4, "0")}-01-01` : null;
    const deathDate =
      r.deathYear !== null ? `${String(r.deathYear).padStart(4, "0")}-01-01` : null;
    return {
      id: uuidByTempId.get(r.tempId)!,
      full_name: r.fullName,
      gender: r.gender as "M" | "F", // validated above
      is_living: r.deathYear === null,
      // is_root = "Thuỷ tổ" (đời 1) — lấy từ cột Thuỷ tổ nếu user đánh dấu;
      // không thì để false (đánh dấu sau ở trang chi tiết).
      is_root: r.isRoot,
      birth_date: birthDate,
      birth_date_precision: birthDate ? "year" : null,
      death_date: deathDate,
      death_date_precision: deathDate ? "year" : null,
      branch_id: r.branch ? branchByName.get(r.branch)!.id : null,
      birth_family_id: familyId,
      bio: r.notes,
    };
  });

  return {
    rows,
    issues,
    payload: {
      persons,
      families: Array.from(familyByKey.values()),
      branches: Array.from(branchByName.values()),
    },
  };
}
