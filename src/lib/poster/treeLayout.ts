import { nameSyllables } from "@/lib/poster/prims";
import type { FamilyForTree, PersonForTree } from "@/lib/queries/tree";

/**
 * Bố cục cây cho bảng gia phả in khổ lớn: mỗi ĐỜI một hàng ngang, ô dọc
 * (tên viết mỗi âm tiết một dòng), cha mẹ căn giữa các con.
 *
 * Tính bằng "đơn vị tự nhiên" rồi để `buildPoster` co cho vừa khổ giấy.
 * Tách hẳn khỏi phần vẽ vì đây là chỗ dễ sai nhất — sai chỗ này thì ô đè
 * lên nhau, và trên tấm A0 in ra thì không sửa được nữa.
 *
 * Một hàng = một đời tính theo ĐỘ SÂU TỪ GỐC, không theo cột
 * `generation` trong dữ liệu: cột đó lan sang cả vợ/chồng nên hai người
 * cùng "đời 5" có thể cách nhau mấy bậc trong cây, vẽ theo nó thì các
 * hàng không còn thẳng.
 */

export interface PosterCard {
  id: string;
  name: string;
  /** Tên tách theo âm tiết, mỗi âm tiết một dòng. */
  lines: string[];
  years: string | null;
  /** Ô người trong họ hay ô dâu/rể cưới vào. */
  kind: "primary" | "spouse";
  /** Toạ độ ngang tâm ô, đơn vị tự nhiên. Chiều dọc suy từ `row`. */
  cx: number;
  row: number;
}

/**
 * Nét nối, ghi theo HÀNG chứ không theo toạ độ dọc.
 *
 * Vì sao: khoảng cách giữa các hàng do khổ giấy quyết định (rải cho kín
 * tấm), mà bố cục ngang thì không. Nếu ở đây chốt luôn toạ độ dọc thì
 * mỗi lần đổi khổ lại phải tính lại cả nét — và nét sẽ lệch khỏi ô.
 */
export interface PosterLink {
  kind: "marriage" | "child";
  x1: number;
  x2: number;
  /** Hàng của đầu trên (cha mẹ, hoặc chính cặp vợ chồng). */
  row: number;
  /** Hàng của đầu dưới — chỉ nét xuống con mới có. */
  toRow?: number;
}

export interface PosterTreeLayout {
  cards: PosterCard[];
  links: PosterLink[];
  /** Bề ngang cần có, tính bằng đơn vị tự nhiên. */
  contentW: number;
  cardW: number;
  cardH: number;
  /** Cỡ chữ tên trong hệ đơn vị tự nhiên. */
  nameSize: number;
  yearSize: number;
  rows: number;
  /** Người bị bỏ ra ngoài vì không nối được vào gốc nào. */
  omitted: number;
}

export interface PosterTreeOptions {
  /** Người làm gốc; null = cả dòng họ (mọi thuỷ tổ). */
  focalId?: string | null;
  /**
   * Số đời vẽ TỪ GỐC XUỐNG; 0 = hết cây.
   *
   * Cố ý chỉ đi xuống, khác cái "số đời" của cây 2D/3D (toả cả lên trên):
   * bảng in treo ở nhà thờ họ luôn đọc từ thuỷ tổ xuôi xuống, in kèm tổ
   * tiên của người được chọn thì tấm mất mạch trên–dưới.
   */
  generations?: number;
  showSpouses: boolean;
  showYears: boolean;
  /** Tối đa bao nhiêu vợ/chồng vẽ cạnh một người. */
  maxSpouses?: number;
}

const yearOf = (d: string | null): string | null =>
  d ? (d.slice(0, 4) || null) : null;

function yearsLabel(p: PersonForTree): string | null {
  const b = yearOf(p.birth_date);
  const d = yearOf(p.death_date);
  if (!b && !d) return null;
  return `${b ?? "?"}–${d ?? (p.is_living ? "" : "?")}`.replace(/–$/, "");
}

export function layoutPosterTree(
  persons: PersonForTree[],
  families: FamilyForTree[],
  opts: PosterTreeOptions,
): PosterTreeLayout {
  const maxSpouses = opts.maxSpouses ?? 2;
  const maxRows = opts.generations && opts.generations > 0 ? opts.generations : Infinity;

  const people = persons;
  const personById = new Map(people.map((p) => [p.id, p]));
  const fams = families;

  const kidsOfFamily = new Map<string, string[]>();
  for (const p of people) {
    if (!p.birth_family_id) continue;
    const arr = kidsOfFamily.get(p.birth_family_id) ?? [];
    arr.push(p.id);
    kidsOfFamily.set(p.birth_family_id, arr);
  }
  const famsOfParent = new Map<string, FamilyForTree[]>();
  for (const f of fams) {
    for (const pid of [f.husband_id, f.wife_id]) {
      if (!pid || !personById.has(pid)) continue;
      const arr = famsOfParent.get(pid) ?? [];
      arr.push(f);
      famsOfParent.set(pid, arr);
    }
  }

  const sortKey = (id: string): [number, number, string] => {
    const p = personById.get(id);
    return [
      p?.birth_order ?? 99,
      Number(yearOf(p?.birth_date ?? null) ?? 9999),
      p?.full_name ?? "",
    ];
  };
  const bySibling = (a: string, b: string) => {
    const [ao, ay, an] = sortKey(a);
    const [bo, by, bn] = sortKey(b);
    return ao - bo || ay - by || an.localeCompare(bn, "vi");
  };

  const childIdsOf = (id: string): string[] =>
    (famsOfParent.get(id) ?? [])
      .flatMap((f) => kidsOfFamily.get(f.id) ?? [])
      .sort(bySibling);

  const spouseIdsOf = (id: string): string[] => {
    const out: string[] = [];
    for (const f of famsOfParent.get(id) ?? []) {
      const other = f.husband_id === id ? f.wife_id : f.husband_id;
      if (other && personById.has(other) && !out.includes(other)) out.push(other);
    }
    return out;
  };

  // Gốc: thuỷ tổ nếu có; nếu không (hoặc đang xem quanh một người) thì
  // lấy những ai không có cha mẹ TRONG phạm vi này.
  const famById = new Map(fams.map((f) => [f.id, f]));
  const hasParentHere = (p: PersonForTree) => {
    const f = p.birth_family_id ? famById.get(p.birth_family_id) : undefined;
    if (!f) return false;
    return (
      (!!f.husband_id && personById.has(f.husband_id)) ||
      (!!f.wife_id && personById.has(f.wife_id))
    );
  };
  let roots: PersonForTree[];
  if (opts.focalId && personById.has(opts.focalId)) {
    // In từ một người: chính người đó là gốc, kể cả khi cha mẹ họ cũng
    // có trong dữ liệu — nếu không thì "in từ người này" lại ra tấm của
    // cha họ.
    roots = [personById.get(opts.focalId)!];
  } else {
    roots = people.filter((p) => p.is_root);
    if (roots.length === 0) roots = people.filter((p) => !hasParentHere(p));
  }
  roots.sort((a, b) => bySibling(a.id, b.id));

  // Dòng máu = gốc + hậu duệ. Dâu/rể là người chỉ nối vào bằng hôn nhân,
  // nên phải biết tập này trước khi quyết ai vẽ thành ô phụ.
  const bloodline = new Set<string>();
  {
    const stack = roots.map((r) => r.id);
    while (stack.length) {
      const id = stack.pop()!;
      if (bloodline.has(id)) continue;
      bloodline.add(id);
      for (const c of childIdsOf(id)) stack.push(c);
    }
  }

  const spousesToShow = (id: string): PersonForTree[] =>
    opts.showSpouses
      ? spouseIdsOf(id)
          .filter((sid) => !bloodline.has(sid))
          .map((sid) => personById.get(sid)!)
          .slice(0, maxSpouses)
      : [];

  // Cỡ ô: rộng theo âm tiết dài nhất, cao theo số âm tiết nhiều nhất —
  // mọi ô bằng nhau thì các hàng mới thẳng, đó là cái làm nên dáng của
  // tấm phả đồ in.
  const shown: PersonForTree[] = [];
  {
    const seen = new Set<string>();
    const walk = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      const p = personById.get(id);
      if (!p) return;
      shown.push(p, ...spousesToShow(id));
      for (const c of childIdsOf(id)) walk(c);
    };
    for (const r of roots) walk(r.id);
  }
  let maxSyl = 1;
  let maxSylLen = 1;
  for (const p of shown) {
    const sy = nameSyllables(p.full_name);
    maxSyl = Math.max(maxSyl, sy.length);
    for (const s of sy) maxSylLen = Math.max(maxSylLen, s.length);
  }
  maxSyl = Math.min(maxSyl, 5);

  const nameSize = 10;
  const yearSize = opts.showYears ? 6.5 : 0;
  const lineH = nameSize * 1.22;
  const padY = nameSize * 0.7;
  const cardW = Math.max(22, maxSylLen * nameSize * 0.66 + nameSize * 0.9);
  const cardH =
    padY * 2 + maxSyl * lineH + (opts.showYears ? yearSize * 1.5 : 0);
  const marriageGap = cardW * 0.22;
  const siblingGap = cardW * 0.42;

  const cards: PosterCard[] = [];
  const links: PosterLink[] = [];
  const placed = new Set<string>();
  let cursor = 0;
  let maxRow = 0;

  interface Group {
    /** Tâm của cả cặp (kể cả ô dâu/rể) — con thả xuống từ đây. */
    center: number;
    left: number;
    width: number;
    row: number;
  }

  function place(id: string, row: number): Group | null {
    if (placed.has(id)) return null; // vòng lặp dữ liệu: bỏ, đừng treo máy
    placed.add(id);
    const person = personById.get(id)!;
    const spouses = spousesToShow(id);
    const count = 1 + spouses.length;
    const groupWidth = count * cardW + (count - 1) * marriageGap;
    const kids = row + 1 < maxRows ? childIdsOf(id) : [];
    maxRow = Math.max(maxRow, row);

    const startIdx = cards.length;
    const childGroups: Group[] = [];
    let groupLeft: number;

    if (kids.length === 0) {
      groupLeft = cursor;
      cursor += groupWidth + siblingGap;
    } else {
      const childStart = cursor;
      for (const k of kids) {
        const g = place(k, row + 1);
        if (g) childGroups.push(g);
      }
      if (childGroups.length === 0) {
        groupLeft = cursor;
        cursor += groupWidth + siblingGap;
      } else {
        const childrenWidth = cursor - siblingGap - childStart;
        const childrenCenter =
          (childGroups[0].center + childGroups[childGroups.length - 1].center) / 2;
        if (groupWidth > childrenWidth) {
          // Cặp rộng hơn hàng con → dịch cả nhánh con sang cho cân giữa.
          const shift = (groupWidth - childrenWidth) / 2;
          for (let i = startIdx; i < cards.length; i++) cards[i].cx += shift;
          for (const g of childGroups) {
            g.center += shift;
            g.left += shift;
          }
          for (const l of links) {
            if (l.kind === "child" && l.row >= row) {
              l.x1 += shift;
              l.x2 += shift;
            }
            if (l.kind === "marriage" && l.row > row) {
              l.x1 += shift;
              l.x2 += shift;
            }
          }
          groupLeft = childStart;
          cursor = childStart + groupWidth + siblingGap;
        } else {
          groupLeft = childrenCenter - groupWidth / 2;
        }
      }
    }

    const center = groupLeft + groupWidth / 2;
    cards.push({
      id: person.id,
      name: person.full_name,
      lines: nameSyllables(person.full_name).slice(0, maxSyl),
      years: opts.showYears ? yearsLabel(person) : null,
      kind: "primary",
      cx: groupLeft + cardW / 2,
      row,
    });
    let sx = groupLeft + cardW + marriageGap;
    for (const s of spouses) {
      cards.push({
        id: s.id,
        name: s.full_name,
        lines: nameSyllables(s.full_name).slice(0, maxSyl),
        years: opts.showYears ? yearsLabel(s) : null,
        kind: "spouse",
        cx: sx + cardW / 2,
        row,
      });
      links.push({
        kind: "marriage",
        x1: sx - marriageGap - 0.5,
        x2: sx + 0.5,
        row,
      });
      sx += cardW + marriageGap;
    }

    // Nối xuống từng con: từ tâm cặp xuống đỉnh ô con.
    for (const g of childGroups) {
      links.push({ kind: "child", x1: center, x2: g.center, row, toRow: g.row });
    }

    return { center, left: groupLeft, width: groupWidth, row };
  }

  for (const r of roots) place(r.id, 0);

  const minX = cards.length ? Math.min(...cards.map((c) => c.cx - cardW / 2)) : 0;
  for (const c of cards) c.cx -= minX;
  for (const l of links) {
    l.x1 -= minX;
    l.x2 -= minX;
  }
  const contentW = cards.length
    ? Math.max(...cards.map((c) => c.cx + cardW / 2))
    : cardW;
  const rows = maxRow + 1;

  return {
    cards,
    links,
    contentW,
    cardW,
    cardH,
    nameSize,
    yearSize,
    rows,
    // Đếm theo Ô ĐÃ VẼ, không theo tập người đã đệ quy: dâu/rể được vẽ
    // thành ô phụ nên không nằm trong tập kia — lấy tập kia thì mọi cô
    // dâu đều bị báo là "chưa nối vào cây", đúng cái báo động giả đã gặp
    // ở cây thư mục (2.221/2.329 người là vợ/chồng).
    omitted: people.length - new Set(cards.map((c) => c.id)).size,
  };
}
