import { unaccent } from "@/lib/unaccent";

// Vietnamese sexagenary cycle: 10 Thiên Can (Heavenly Stems) ×
// 12 Địa Chi (Earthly Branches) → a 60-year cycle. Used pervasively
// in gia phả because pre-modern Vietnamese records dated births by
// can-chi rather than Gregorian years.
//
// Anchor: 1984 = Giáp Tý (year 0 of the cycle).
//   (1984 - 4) % 60 = 0 ✓
//   (1984 - 4) % 10 = 0 → Giáp ✓
//   (1984 - 4) % 12 = 0 → Tý ✓
//
// Conversion formulas:
//   stem  = (year - 4) mod 10
//   branch= (year - 4) mod 12
// Cycle repeats every 60 years.

const STEMS = [
  "giáp",
  "ất",
  "bính",
  "đinh",
  "mậu",
  "kỷ",
  "canh",
  "tân",
  "nhâm",
  "quý",
] as const;

const BRANCHES = [
  "tý",
  "sửu",
  "dần",
  "mão",
  "thìn",
  "tỵ",
  "ngọ",
  "mùi",
  "thân",
  "dậu",
  "tuất",
  "hợi",
] as const;

export type Stem = (typeof STEMS)[number];
export type Branch = (typeof BRANCHES)[number];

export interface CanChi {
  stem: Stem;
  branch: Branch;
}

// Pre-computed unaccent forms for "binh thin" style input where the
// user skips diacritics. Tý (rat) and Tỵ (snake) both collapse to
// "ty" once diacritics are stripped — we resolve the collision
// later by parity against the stem (Tý is even-parity, Tỵ is odd-
// parity, so given a stem only ONE option fits the 60-year cycle).
// Hence the values are arrays, not single strings.
const STEMS_ASCII: Record<string, Stem[]> = {};
for (const s of STEMS) {
  (STEMS_ASCII[unaccent(s)] ??= []).push(s);
}
const BRANCHES_ASCII: Record<string, Branch[]> = {};
for (const b of BRANCHES) {
  (BRANCHES_ASCII[unaccent(b)] ??= []).push(b);
}

function normalize(s: string): string {
  return s.normalize("NFC").toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Parse "Bính Thìn", "BÍNH THÌN", or even "binh thin" (no diacritics)
 * into the structured form. Returns null if the two tokens don't
 * resolve to a known stem + branch pair.
 *
 * "Năm Bính Thìn" / "năm Thìn" / single-token input → null, because
 * a single branch (Thìn) alone is the zodiac, not a can-chi.
 */
export function parseCanChi(text: string): CanChi | null {
  const cleaned = normalize(text);
  if (!cleaned) return null;
  const tokens = cleaned.split(" ");
  if (tokens.length !== 2) return null;
  const [a, b] = tokens;

  const stemCandidates: Stem[] =
    (STEMS as readonly string[]).indexOf(a) >= 0
      ? [a as Stem]
      : (STEMS_ASCII[a] ?? []);
  const branchCandidates: Branch[] =
    (BRANCHES as readonly string[]).indexOf(b) >= 0
      ? [b as Branch]
      : (BRANCHES_ASCII[b] ?? []);
  if (stemCandidates.length === 0 || branchCandidates.length === 0) {
    return null;
  }

  // Not every (stem, branch) pair is valid — the cycle skips half
  // the combinations. A stem at even index can only pair with a
  // branch at even index (and likewise odd-odd). The first pair
  // that satisfies parity wins; for unambiguous diacritic input
  // that's the only candidate, for "ty" it disambiguates rat vs
  // snake automatically.
  for (const stem of stemCandidates) {
    for (const branch of branchCandidates) {
      if (STEMS.indexOf(stem) % 2 === BRANCHES.indexOf(branch) % 2) {
        return { stem, branch };
      }
    }
  }
  return null;
}

/**
 * Inverse: solar year → "Bính Thìn" (with diacritics, title-case).
 * Handy for showing "1976 = Bính Thìn" as a confirmation chip.
 */
export function yearToCanChi(year: number): string {
  const mod = ((year - 4) % 60 + 60) % 60;
  const stem = STEMS[mod % 10];
  const branch = BRANCHES[mod % 12];
  return `${title(stem)} ${title(branch)}`;
}

function title(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Given a can-chi pair, return ALL the years in [minYear, maxYear]
 * that match — ordered chronologically. The 60-year cycle means at
 * most ⌈(maxYear-minYear)/60⌉ + 1 hits per pair.
 *
 * Defaults cover births / deaths of ~7 generations into the past
 * plus a couple into the future for forward-looking entries.
 */
export function canChiToYears(
  canChi: CanChi,
  minYear = 1700,
  maxYear = new Date().getFullYear() + 5,
): number[] {
  const stemIdx = STEMS.indexOf(canChi.stem);
  const branchIdx = BRANCHES.indexOf(canChi.branch);
  // Solve year ≡ stemIdx (mod 10) AND year ≡ branchIdx (mod 12)
  // with year ≡ 4 (mod 60) when stemIdx = branchIdx = 0.
  // Walk one full cycle starting from minYear to find the first
  // match, then step by 60.
  const out: number[] = [];
  for (let y = minYear; y < minYear + 60; y++) {
    const m = ((y - 4) % 60 + 60) % 60;
    if (m % 10 === stemIdx && m % 12 === branchIdx) {
      for (let yy = y; yy <= maxYear; yy += 60) out.push(yy);
      break;
    }
  }
  return out;
}

/**
 * Most useful for "user typed Bính Thìn for a birth year" — return
 * the year nearest to a reference (usually current year minus the
 * generation gap). Falls back to the most recent past year.
 */
export function canChiToBestYear(
  canChi: CanChi,
  referenceYear: number = new Date().getFullYear(),
  maxYear: number = new Date().getFullYear() + 5,
): number | null {
  const years = canChiToYears(canChi, 1700, maxYear);
  if (years.length === 0) return null;
  let best = years[0];
  let bestDist = Math.abs(best - referenceYear);
  for (const y of years) {
    const d = Math.abs(y - referenceYear);
    if (d < bestDist) {
      best = y;
      bestDist = d;
    }
  }
  return best;
}
