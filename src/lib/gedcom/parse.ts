/**
 * GEDCOM 5.5.1 parser — intentionally tolerant of variants other tools
 * emit (FamilySearch, MyHeritage, FTM). Returns intermediate records
 * that an importer can apply to our schema.
 *
 * We re-read our own _CUSTOM tags so a round-trip preserves
 * courtesy_name, nicknames, lunar dates, branch labels, and the
 * is_root flag. Foreign GEDCOM files just drop those — that's fine.
 */

export interface ParsedIndi {
  /** GEDCOM pointer like "@I1@" — unique within the file. */
  ptr: string;
  fullName: string;
  gender: "M" | "F";
  isLiving: boolean;
  isRoot: boolean;
  generation: number | null;

  birthDate: string | null; // iso yyyy-mm-dd (or yyyy-mm-01 / yyyy-01-01 for partials)
  birthDatePrecision: "day" | "month" | "year" | null;
  birthPlace: string | null;
  deathDate: string | null;
  deathDatePrecision: "day" | "month" | "year" | null;
  burialPlace: string | null;

  courtesyName: string | null;
  nickname: string | null;
  posthumousName: string | null;
  branchName: string | null;

  birthLunarYear: number | null;
  birthLunarMonth: number | null;
  birthLunarDay: number | null;
  deathLunarYear: number | null;
  deathLunarMonth: number | null;
  deathLunarDay: number | null;
  gioMonth: number | null;
  gioDay: number | null;

  bio: string | null;

  famcPtr: string | null;
  famsPtrs: string[];

  /**
   * Cross-clan in-law links seen in `_INLAW` blocks. Preserved for
   * inspection / surface UX (e.g. import preview) but the importer
   * does NOT recreate person_links — the peer clan may not exist in
   * the destination DB and the peer person is just a name string.
   */
  inlaws: ParsedInlaw[];
}

export interface ParsedInlaw {
  clanName: string | null;
  personName: string | null;
  gender: "M" | "F" | null;
  birthYear: number | null;
  deathYear: number | null;
}

export interface ParsedFam {
  ptr: string;
  husbandPtr: string | null;
  wifePtr: string | null;
  childPtrs: string[];
}

export interface ParsedClanMeta {
  name: string | null;
  description: string | null;
}

export interface ParsedGedcom {
  clan: ParsedClanMeta;
  indis: ParsedIndi[];
  fams: ParsedFam[];
}

const MONTH_INDEX: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

/** "15 JUN 2024" → {date:"2024-06-15", precision:"day"} */
function parseGedDate(s: string): {
  date: string | null;
  precision: "day" | "month" | "year" | null;
} {
  const trimmed = s.trim().toUpperCase();
  // year only
  const y = trimmed.match(/^(\d{3,4})$/);
  if (y) return { date: `${y[1].padStart(4, "0")}-01-01`, precision: "year" };
  // month + year
  const my = trimmed.match(/^([A-Z]{3})\s+(\d{3,4})$/);
  if (my) {
    const m = MONTH_INDEX[my[1]];
    if (!m) return { date: null, precision: null };
    return {
      date: `${my[2].padStart(4, "0")}-${String(m).padStart(2, "0")}-01`,
      precision: "month",
    };
  }
  // day + month + year
  const dmy = trimmed.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{3,4})$/);
  if (dmy) {
    const m = MONTH_INDEX[dmy[2]];
    if (!m) return { date: null, precision: null };
    return {
      date: `${dmy[3].padStart(4, "0")}-${String(m).padStart(2, "0")}-${dmy[1].padStart(2, "0")}`,
      precision: "day",
    };
  }
  return { date: null, precision: null };
}

/** "/Nguyễn/ Văn A" → "Nguyễn Văn A". "John /Smith/" → "John Smith". */
function gedNameToFull(raw: string): string {
  // Surname is wrapped in /…/. Other GEDCOMs may put it last, ours puts
  // it first. Strip the slashes and squash whitespace either way.
  return raw.replace(/\//g, "").replace(/\s+/g, " ").trim();
}

interface RawLine {
  level: number;
  pointer: string | null;
  tag: string;
  value: string;
}

function tokenize(text: string): RawLine[] {
  const lines: RawLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/﻿/g, "").trim();
    if (!line) continue;
    // "LEVEL [POINTER] TAG [VALUE]"
    // Pointer (if present) is the SECOND token and is wrapped in @…@.
    const m = line.match(/^(\d+)\s+(?:(@[^@]+@)\s+)?([A-Z_][A-Z0-9_]*)(?:\s+(.*))?$/);
    if (!m) continue;
    lines.push({
      level: Number(m[1]),
      pointer: m[2] ?? null,
      tag: m[3],
      value: (m[4] ?? "").trim(),
    });
  }
  return lines;
}

export function parseGedcom(text: string): ParsedGedcom {
  const lines = tokenize(text);
  const out: ParsedGedcom = {
    clan: { name: null, description: null },
    indis: [],
    fams: [],
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Top-level records. When the line has a pointer, GEDCOM puts the
    // record type into our `tag` slot (the 3rd capture group).
    if (line.level === 0 && line.pointer && line.tag === "INDI") {
      const { record, next } = parseIndi(lines, i);
      out.indis.push(record);
      i = next;
      continue;
    }
    if (line.level === 0 && line.pointer && line.tag === "FAM") {
      const { record, next } = parseFam(lines, i);
      out.fams.push(record);
      i = next;
      continue;
    }
    if (line.level === 0 && line.tag === "HEAD") {
      const { meta, next } = parseHead(lines, i);
      out.clan = { ...out.clan, ...meta };
      i = next;
      continue;
    }

    i++;
  }

  return out;
}

function parseHead(
  lines: RawLine[],
  start: number,
): { meta: Partial<ParsedClanMeta>; next: number } {
  let i = start + 1;
  const meta: Partial<ParsedClanMeta> = {};
  while (i < lines.length && lines[i].level > 0) {
    const l = lines[i];
    if (l.tag === "_CLAN") {
      // sub-tags: NAME, NOTE
      let j = i + 1;
      while (j < lines.length && lines[j].level > l.level) {
        if (lines[j].tag === "NAME") meta.name = lines[j].value;
        if (lines[j].tag === "NOTE") meta.description = lines[j].value;
        j++;
      }
      i = j;
      continue;
    }
    i++;
  }
  return { meta, next: i };
}

function parseIndi(
  lines: RawLine[],
  start: number,
): { record: ParsedIndi; next: number } {
  const head = lines[start];
  const record: ParsedIndi = {
    ptr: head.pointer!,
    fullName: "",
    gender: "M",
    isLiving: true,
    isRoot: false,
    generation: null,
    birthDate: null,
    birthDatePrecision: null,
    birthPlace: null,
    deathDate: null,
    deathDatePrecision: null,
    burialPlace: null,
    courtesyName: null,
    nickname: null,
    posthumousName: null,
    branchName: null,
    birthLunarYear: null,
    birthLunarMonth: null,
    birthLunarDay: null,
    deathLunarYear: null,
    deathLunarMonth: null,
    deathLunarDay: null,
    gioMonth: null,
    gioDay: null,
    bio: null,
    famcPtr: null,
    famsPtrs: [],
    inlaws: [],
  };

  let i = start + 1;
  let sawDeath = false;
  while (i < lines.length && lines[i].level > 0) {
    const l = lines[i];
    if (l.level === 1) {
      switch (l.tag) {
        case "NAME":
          record.fullName = gedNameToFull(l.value);
          break;
        case "SEX":
          record.gender = l.value.toUpperCase().startsWith("F") ? "F" : "M";
          break;
        case "BIRT":
          ({ i } = readEventBlock(lines, i, {
            onDate: (d, p) => {
              record.birthDate = d;
              record.birthDatePrecision = p;
            },
            onPlac: (p) => (record.birthPlace = p),
          }));
          continue;
        case "DEAT":
          sawDeath = true;
          ({ i } = readEventBlock(lines, i, {
            onDate: (d, p) => {
              record.deathDate = d;
              record.deathDatePrecision = p;
            },
            onPlac: (p) => (record.burialPlace = p),
          }));
          continue;
        case "_COURTESY":
          record.courtesyName = l.value || null;
          break;
        case "_NICKNAME":
          record.nickname = l.value || null;
          break;
        case "_POSTHUMOUS":
          record.posthumousName = l.value || null;
          break;
        case "_BRANCH":
          record.branchName = l.value || null;
          break;
        case "_ROOT":
          record.isRoot = /^y/i.test(l.value);
          break;
        case "_GEN":
          record.generation = Number.isInteger(Number(l.value))
            ? Number(l.value)
            : null;
          break;
        case "_LUNAR_BIRTH":
        case "_LUNAR_DEATH":
        case "_GIO": {
          const sub: Record<string, number> = {};
          let j = i + 1;
          while (j < lines.length && lines[j].level > l.level) {
            const v = Number(lines[j].value);
            if (Number.isInteger(v)) sub[lines[j].tag] = v;
            j++;
          }
          if (l.tag === "_LUNAR_BIRTH") {
            record.birthLunarYear = sub.YEAR ?? null;
            record.birthLunarMonth = sub.MONTH ?? null;
            record.birthLunarDay = sub.DAY ?? null;
          } else if (l.tag === "_LUNAR_DEATH") {
            record.deathLunarYear = sub.YEAR ?? null;
            record.deathLunarMonth = sub.MONTH ?? null;
            record.deathLunarDay = sub.DAY ?? null;
          } else {
            record.gioMonth = sub.MONTH ?? null;
            record.gioDay = sub.DAY ?? null;
          }
          i = j;
          continue;
        }
        case "NOTE":
          record.bio = l.value || null;
          break;
        case "FAMC":
          record.famcPtr = l.value || null;
          break;
        case "FAMS":
          if (l.value) record.famsPtrs.push(l.value);
          break;
        case "_INLAW": {
          // Sub-tags: _CLAN, _PERSON, _SEX, _BIRTH_YEAR, _DEATH_YEAR.
          // Multiple blocks possible per INDI (remarriage / polygamy).
          const inlaw: ParsedInlaw = {
            clanName: null,
            personName: null,
            gender: null,
            birthYear: null,
            deathYear: null,
          };
          let j = i + 1;
          while (j < lines.length && lines[j].level > l.level) {
            const s = lines[j];
            if (s.tag === "_CLAN") inlaw.clanName = s.value || null;
            else if (s.tag === "_PERSON") inlaw.personName = s.value || null;
            else if (s.tag === "_SEX")
              inlaw.gender = s.value.toUpperCase().startsWith("F") ? "F" : "M";
            else if (s.tag === "_BIRTH_YEAR") {
              const n = Number(s.value);
              inlaw.birthYear = Number.isInteger(n) ? n : null;
            } else if (s.tag === "_DEATH_YEAR") {
              const n = Number(s.value);
              inlaw.deathYear = Number.isInteger(n) ? n : null;
            }
            j++;
          }
          record.inlaws.push(inlaw);
          i = j;
          continue;
        }
      }
    }
    i++;
  }
  record.isLiving = !sawDeath && !record.deathDate;
  return { record, next: i };
}

function readEventBlock(
  lines: RawLine[],
  start: number,
  cb: {
    onDate?: (
      d: string | null,
      p: "day" | "month" | "year" | null,
    ) => void;
    onPlac?: (p: string) => void;
  },
): { i: number } {
  let i = start + 1;
  while (i < lines.length && lines[i].level > 1) {
    const l = lines[i];
    if (l.tag === "DATE" && cb.onDate) {
      const parsed = parseGedDate(l.value);
      cb.onDate(parsed.date, parsed.precision);
    } else if (l.tag === "PLAC" && cb.onPlac) {
      cb.onPlac(l.value);
    }
    i++;
  }
  return { i };
}

function parseFam(
  lines: RawLine[],
  start: number,
): { record: ParsedFam; next: number } {
  const head = lines[start];
  const record: ParsedFam = {
    ptr: head.pointer!,
    husbandPtr: null,
    wifePtr: null,
    childPtrs: [],
  };
  let i = start + 1;
  while (i < lines.length && lines[i].level > 0) {
    const l = lines[i];
    if (l.level === 1) {
      if (l.tag === "HUSB") record.husbandPtr = l.value || null;
      else if (l.tag === "WIFE") record.wifePtr = l.value || null;
      else if (l.tag === "CHIL" && l.value) record.childPtrs.push(l.value);
    }
    i++;
  }
  return { record, next: i };
}
