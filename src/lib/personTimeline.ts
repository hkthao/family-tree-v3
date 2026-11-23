/**
 * Dòng thời gian một đời người: dựng tạm từ các ý "Năm Bính Tuất (1226): …"
 * trong tiểu sử khi chưa có mốc nào lưu trong DB (bảng person_timeline).
 */
import type { TimelineRow } from "@/lib/queries/person-timeline";

import { t } from "@lingui/core/macro";

/** Lấy năm từ ngày "YYYY-MM-DD" / "YYYY"; không có → null. */
export function yearOf(d: string | null | undefined): number | null {
  const y = d ? Number(d.slice(0, 4)) : NaN;
  return Number.isFinite(y) && y > 0 ? y : null;
}

/** Mốc dựng tạm từ tiểu sử: chỉ giữ các năm trong đời người (sinh → mất). */
export function bioTimelineRows(
  bio: string | null | undefined,
  birthYear: number | null,
  deathYear: number | null,
): TimelineRow[] {
  if (!bio) return [];
  const out: TimelineRow[] = [];
  for (const line of bio.split("\n")) {
    const m = /^[-•]\s+Năm\s+([^:()]*?)\s*\((\d{3,4})\)[^:]*:\s*(.+)$/.exec(line.trim());
    if (!m) continue;
    const year = Number(m[2]);
    if ((birthYear != null && year < birthYear) || (deathYear != null && year > deathYear)) continue;
    out.push({ year, era: m[1] || null, body: m[3] });
  }
  return out;
}

/** Một mốc đời người dựng từ hồ sơ (không lưu DB): sinh, con chào đời, cha mẹ mất, mất. */
export interface LifeEvent {
  year: number;
  title: string;
  body: string | null;
  /** Thứ tự trong cùng một năm: Sinh đứng đầu, Mất đứng cuối. */
  sort: number;
}

/**
 * Các mốc đời người TỪ LÚC SINH ĐẾN LÚC MẤT, tự dựng từ dữ liệu có sẵn (ngày sinh / mất, nơi sinh, nơi an táng, con, cha mẹ):
 *  - Sinh (kèm nơi sinh);
 *  - các con chào đời (con đầu lòng ghi riêng) — chỉ con có năm sinh và không lệch quá đời người;
 *  - cha / mẹ mất khi người này còn sống;
 *  - Mất (kèm tuổi thọ và nơi an táng) — người còn sống không có mốc này.
 * Chỉ hiện để xem; muốn thêm mốc thật thì dùng dòng thời gian (bảng mốc dùng chung).
 */
export function lifeEvents(i: {
  birthYear: number | null;
  deathYear: number | null;
  birthPlace?: string | null;
  burialPlace?: string | null;
  children?: { full_name: string; birth_date: string | null }[];
  parents?: { full_name: string; gender: "M" | "F"; death_date: string | null }[];
}): LifeEvent[] {
  const out: LifeEvent[] = [];
  const { birthYear, deathYear } = i;
  const inLife = (y: number) =>
    (birthYear == null || y >= birthYear) && (deathYear == null || y <= deathYear + 1);

  if (birthYear != null) {
    const place = i.birthPlace?.trim();
    out.push({ year: birthYear, title: t`Sinh`, body: place ? t`Sinh tại ${place}` : null, sort: 0 });
  }

  const kids = (i.children ?? [])
    .map((c) => ({ name: c.full_name, year: yearOf(c.birth_date) }))
    .filter((c): c is { name: string; year: number } => c.year !== null && inLife(c.year))
    .sort((a, b) => a.year - b.year);
  kids.forEach((c, idx) =>
    out.push({
      year: c.year,
      title: idx === 0 ? t`Con đầu lòng chào đời` : t`Con chào đời`,
      body: c.name,
      sort: 100 + idx,
    }),
  );

  (i.parents ?? []).forEach((p, idx) => {
    const y = yearOf(p.death_date);
    if (y === null || !inLife(y) || (birthYear != null && y < birthYear)) return;
    out.push({
      year: y,
      title: p.gender === "M" ? t`Cha mất` : t`Mẹ mất`,
      body: p.full_name,
      sort: 200 + idx,
    });
  });

  if (deathYear != null) {
    const bits: string[] = [];
    if (birthYear != null && deathYear >= birthYear) {
      const age = deathYear - birthYear;
      bits.push(t`Thọ ${age} tuổi`);
    }
    const burial = i.burialPlace?.trim();
    if (burial) bits.push(t`An táng tại ${burial}`);
    out.push({ year: deathYear, title: t`Mất`, body: bits.length ? bits.join(". ") : null, sort: 999 });
  }
  return out;
}
