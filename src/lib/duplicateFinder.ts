/**
 * Heuristic duplicate-person finder.
 *
 * Compares every (id, full_name, gender, birth_date) tuple in a clan
 * and emits candidate pairs the editor can review on the Merge page.
 *
 * Scoring rules (highest match per pair):
 *   - Same normalised name + same gender + same birth year → "exact"
 *   - Same normalised name + same gender (years missing or off by ≤1) → "name"
 *   - Normalised names within edit distance 1 + same gender + same
 *     birth year → "fuzzy"
 *
 * Different-gender pairs are never matched — a "Nguyễn Văn A" male
 * and "Nguyễn Văn A" female don't qualify (same name across genders
 * happens; merging them is almost certainly wrong).
 *
 * The function is O(n²) in person count. Fine up to a few thousand
 * rows per clan; larger trees should chunk by branch.
 */

export type MatchKind = "exact" | "name" | "fuzzy";

export interface DuplicatePerson {
  id: string;
  full_name: string;
  gender: "M" | "F";
  birth_date: string | null;
  is_living: boolean;
  generation: number | null;
}

export interface DuplicateCandidate {
  a: DuplicatePerson;
  b: DuplicatePerson;
  kind: MatchKind;
  /** Higher = more confident match. exact: 3, name: 2, fuzzy: 1. */
  score: number;
}

/** Vietnamese-aware normalisation: strip diacritics + đ + extra whitespace. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function birthYear(p: DuplicatePerson): number | null {
  const y = p.birth_date?.slice(0, 4);
  return y && /^\d{4}$/.test(y) ? Number(y) : null;
}

/** Levenshtein, capped at 2 so we exit early on far-apart strings. */
function editDistanceUpTo2(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  // Row-rolling DP, capped.
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      curr.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > 2) return 3;
    prev = curr;
  }
  return prev[n];
}

export function findDuplicateCandidates(
  persons: DuplicatePerson[],
): DuplicateCandidate[] {
  // Pre-compute normalised name + birth year per person so the inner
  // loop just compares numbers and strings.
  const enriched = persons.map((p) => ({
    p,
    nn: normalizeName(p.full_name),
    by: birthYear(p),
  }));

  const out: DuplicateCandidate[] = [];

  for (let i = 0; i < enriched.length; i++) {
    const A = enriched[i];
    for (let j = i + 1; j < enriched.length; j++) {
      const B = enriched[j];

      if (A.p.gender !== B.p.gender) continue;

      const exactName = A.nn === B.nn;
      const sameYear = A.by !== null && B.by !== null && A.by === B.by;
      const yearOffByOne =
        A.by !== null && B.by !== null && Math.abs(A.by - B.by) === 1;

      if (exactName && sameYear) {
        out.push({ a: A.p, b: B.p, kind: "exact", score: 3 });
        continue;
      }
      if (exactName && (A.by === null || B.by === null || yearOffByOne)) {
        out.push({ a: A.p, b: B.p, kind: "name", score: 2 });
        continue;
      }
      // Fuzzy only when at least one tight signal (same year) is present
      if (sameYear && editDistanceUpTo2(A.nn, B.nn) <= 1) {
        out.push({ a: A.p, b: B.p, kind: "fuzzy", score: 1 });
      }
    }
  }

  // Sort: highest score first, then alphabetical for stable display.
  return out.sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score;
    return x.a.full_name.localeCompare(y.a.full_name, "vi");
  });
}
