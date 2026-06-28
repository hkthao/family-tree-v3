import type { PersonForTree } from "@/lib/queries/tree";

/**
 * "Thống kê vui" — tính fun-fact dòng họ từ dữ liệu cây (client-side, không
 * cần backend). Mỗi fact có câu mô tả + số liệu lớn để làm thẻ chia sẻ.
 * Fact nào thiếu dữ liệu thì bỏ qua (không hiển thị sai).
 */
export interface FunFact {
  id: string;
  icon: string;
  /** Câu mô tả vui (hiện trong danh sách + làm lời trích thẻ). */
  text: string;
  /** Số liệu lớn để in nổi bật trên thẻ chia sẻ. */
  stat: string;
}

interface Family {
  id: string;
  husband_id: string | null;
  wife_id: string | null;
}

function year(d: string | null): number | null {
  if (!d || d.length < 4) return null;
  const y = Number(d.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

/** Tên gọi = token cuối của họ tên đầy đủ (vd "Nguyễn Văn Hùng" → "Hùng"). */
function givenName(full: string): string | null {
  const parts = full.trim().split(/\s+/);
  return parts.length ? parts[parts.length - 1] : null;
}

function topEntry<T>(counts: Map<T, number>): { key: T; count: number } | null {
  let best: { key: T; count: number } | null = null;
  for (const [key, count] of counts) {
    if (!best || count > best.count) best = { key, count };
  }
  return best;
}

export function computeClanFunFacts(opts: {
  persons: PersonForTree[];
  families: Family[];
  branchNameById: Map<string, string>;
  genOffset: number;
  selfPersonId?: string | null;
  nowYear: number;
}): FunFact[] {
  const { persons, families, branchNameById, genOffset, selfPersonId, nowYear } = opts;
  const facts: FunFact[] = [];
  if (persons.length === 0) return facts;

  const byId = new Map(persons.map((p) => [p.id, p]));

  // 1. Tổng quan
  const gens = persons.map((p) => p.generation).filter((g): g is number => g != null);
  const maxGen = gens.length ? Math.max(...gens) - genOffset : null;
  const branchCount = new Set(persons.map((p) => p.branch_id).filter(Boolean)).size;
  facts.push({
    id: "overview",
    icon: "🌳",
    stat: `${persons.length} người`,
    text:
      `Dòng họ ta hiện có ${persons.length} người` +
      (maxGen != null ? `, trải qua ${maxGen} đời` : "") +
      (branchCount > 0 ? `, chia thành ${branchCount} chi` : "") +
      ".",
  });

  // 2. Chi đông nhất
  if (branchCount > 0) {
    const counts = new Map<string, number>();
    for (const p of persons) if (p.branch_id) counts.set(p.branch_id, (counts.get(p.branch_id) ?? 0) + 1);
    const top = topEntry(counts);
    if (top) {
      const name = branchNameById.get(top.key) ?? "một chi";
      facts.push({
        id: "biggest-branch",
        icon: "👨‍👩‍👧‍👦",
        stat: `${top.count} người`,
        text: `Chi đông nhất là ${name} với ${top.count} người.`,
      });
    }
  }

  // 3. Người thọ nhất (đã mất, đủ năm)
  let oldest: { p: PersonForTree; age: number } | null = null;
  for (const p of persons) {
    if (p.is_living) continue;
    const by = year(p.birth_date);
    const dy = year(p.death_date);
    const age = p.lifespan_years ?? (by != null && dy != null ? dy - by : null);
    if (age != null && age > 0 && age < 130 && (!oldest || age > oldest.age)) oldest = { p, age };
  }
  if (oldest) {
    facts.push({
      id: "oldest",
      icon: "🕯️",
      stat: `${oldest.age} tuổi`,
      text: `Người thọ nhất họ ta là cụ ${oldest.p.full_name}, hưởng thọ ${oldest.age} tuổi.`,
    });
  }

  // 4. Cao niên nhất còn sống
  let elder: { p: PersonForTree; age: number } | null = null;
  for (const p of persons) {
    if (!p.is_living) continue;
    const by = year(p.birth_date);
    if (by == null) continue;
    const age = nowYear - by;
    if (age > 0 && age < 130 && (!elder || age > elder.age)) elder = { p, age };
  }
  if (elder && elder.age >= 60) {
    facts.push({
      id: "eldest-living",
      icon: "🎂",
      stat: `${elder.age} tuổi`,
      text: `Người cao niên nhất còn sống là ${elder.p.full_name}, ${elder.age} tuổi.`,
    });
  }

  // 5. Gia đình đông con nhất
  const childrenPerFamily = new Map<string, number>();
  for (const p of persons) if (p.birth_family_id) childrenPerFamily.set(p.birth_family_id, (childrenPerFamily.get(p.birth_family_id) ?? 0) + 1);
  const topFam = topEntry(childrenPerFamily);
  if (topFam && topFam.count >= 3) {
    const fam = families.find((f) => f.id === topFam.key);
    const parent = fam ? (byId.get(fam.husband_id ?? "") ?? byId.get(fam.wife_id ?? "")) : null;
    facts.push({
      id: "most-children",
      icon: "👶",
      stat: `${topFam.count} người con`,
      text: parent
        ? `Cụ ${parent.full_name} là người đông con nhất họ: ${topFam.count} người con.`
        : `Gia đình đông con nhất họ có ${topFam.count} người con.`,
    });
  }

  // 6. Tên gọi phổ biến nhất (token cuối — tên thật, không phải tên đệm
  //    chung như "Thị" vốn vô nghĩa vì gần như ai cũng có).
  const givenCounts = new Map<string, number>();
  for (const p of persons) {
    const g = givenName(p.full_name);
    if (g) givenCounts.set(g, (givenCounts.get(g) ?? 0) + 1);
  }
  const topGiven = topEntry(givenCounts);
  if (topGiven && topGiven.count >= 3) {
    facts.push({
      id: "common-given-name",
      icon: "✍️",
      stat: `${topGiven.count} người`,
      text: `Tên "${topGiven.key}" được đặt nhiều nhất họ ta — ${topGiven.count} người cùng tên.`,
    });
  }

  // 7. Tháng sinh đông nhất
  const monthCounts = new Map<number, number>();
  for (const p of persons) {
    if (p.birth_date_precision !== "month" && p.birth_date_precision !== "day") continue;
    const m = Number(p.birth_date?.slice(5, 7));
    if (m >= 1 && m <= 12) monthCounts.set(m, (monthCounts.get(m) ?? 0) + 1);
  }
  const topMonth = topEntry(monthCounts);
  if (topMonth && topMonth.count >= 3) {
    facts.push({
      id: "birth-month",
      icon: "📅",
      stat: `Tháng ${topMonth.key}`,
      text: `Tháng ${topMonth.key} là tháng nhiều người trong họ chào đời nhất (${topMonth.count} người).`,
    });
  }

  // 8. Cá nhân hoá: trùng ngày sinh với tổ tiên
  if (selfPersonId) {
    const self = byId.get(selfPersonId);
    if (self?.birth_date_precision === "day" && self.birth_date) {
      const md = self.birth_date.slice(5, 10); // MM-DD
      const match = persons.find(
        (p) =>
          p.id !== self.id &&
          p.birth_date_precision === "day" &&
          p.birth_date?.slice(5, 10) === md,
      );
      if (match) {
        const genTxt = match.generation != null ? ` (đời thứ ${match.generation - genOffset})` : "";
        facts.push({
          id: "same-birthday",
          icon: "🎉",
          stat: "Cùng ngày sinh",
          text: `Bạn trùng ngày sinh với ${match.full_name}${genTxt} trong dòng họ!`,
        });
      }
    }
  }

  return facts;
}
