import { t } from "@lingui/core/macro";

import type { PersonForTree } from "@/lib/queries/tree";
import {
  erasOverlapping,
  type EraCard,
  type TimelineIconKey,
} from "@/lib/timeline/eras";

/**
 * Dựng các mốc ỨNG VIÊN cho dòng thời gian dòng họ từ dữ liệu cây — hàm thuần, không gọi mạng.
 *
 * Người dùng KHÔNG phải gõ: mỗi ứng viên đã có sẵn tiêu đề, mô tả, hình minh hoạ và ảnh người đại diện;
 * họ chỉ tick chọn (cờ `recommended` đánh dấu những mốc nên bật sẵn) rồi sửa chữ nếu muốn.
 *
 * Cỡ gom mốc tự co giãn theo thời đại — dòng họ lịch sử có mốc từ năm 1200 mà gom theo thập niên thì
 * hàng trăm cột trống:
 *   năm ≥ 1800  → thập niên      (1950–1959)
 *   1500–1799   → nửa thế kỷ     (1700–1749)
 *   < 1500      → thế kỷ         (thế kỷ 13)
 * Giai đoạn không có dữ liệu bị bỏ qua nên thập niên thưa ở thế kỷ 19 không sinh cột trống.
 */

export type BucketUnit = "decade" | "half-century" | "century";

export interface TimelineBucket {
  /** Ổn định theo (đơn vị, năm đầu) — dùng làm khoá ghi đè chỉnh tay (`auto_key`). */
  id: string;
  unit: BucketUnit;
  from: number;
  to: number;
  label: string;
}

export type CandidateKind = "root" | "generation" | "births" | "deaths";

export interface TimelineCandidate {
  /** `${bucket.id}:${kind}[:${generation}]` — ổn định để khớp bản chỉnh tay. */
  key: string;
  kind: CandidateKind;
  bucket: TimelineBucket;
  /** Năm đại diện của mốc (năm sinh/mất của người liên quan) — dùng khi sao chép thành mốc của dòng thời gian. */
  year: number;
  title: string;
  body: string;
  iconKey: TimelineIconKey;
  /** Người có ảnh làm hình đại diện cho mốc (null = dùng hình minh hoạ theo `iconKey`). */
  photoPersonId: string | null;
  personIds: string[];
  /** Nên bật sẵn khi người dùng mở lần đầu. */
  recommended: boolean;
  /** Bối cảnh thời đại giao với khoảng thời gian của mốc. */
  eras: EraCard[];
}

export interface TimelineOptions {
  /** Offset hiển thị đời (clan.generation_offset). */
  generationOffset?: number;
  /** Số tên tối đa liệt kê trong phần mô tả. */
  maxNames?: number;
  /** Số mốc bật sẵn tối đa (poster chỉ chứa được vài mốc). Mặc định 8. */
  maxRecommended?: number;
}

export function bucketOfYear(year: number): TimelineBucket {
  // Trước Công nguyên (dòng thời gian một người có thể ghi năm âm): gom chung một nhóm.
  if (year < 1) {
    return { id: "bc", unit: "century", from: -3000, to: 0, label: t`Trước Công nguyên` };
  }
  if (year >= 1800) {
    const from = Math.floor(year / 10) * 10;
    return {
      id: `decade:${from}`,
      unit: "decade",
      from,
      to: from + 9,
      label: `${from}s`,
    };
  }
  if (year >= 1500) {
    const from = Math.floor(year / 50) * 50;
    return {
      id: `half-century:${from}`,
      unit: "half-century",
      from,
      to: from + 49,
      label: `${from}–${from + 49}`,
    };
  }
  const c = Math.max(1, Math.ceil(year / 100));
  const from = (c - 1) * 100 + 1;
  return {
    id: `century:${from}`,
    unit: "century",
    from,
    to: c * 100,
    label: t`Thế kỷ ${c}`,
  };
}

/** Năm của một ngày dạng "YYYY-MM-DD" (hoặc "YYYY"); null nếu không đọc được. */
export function yearOf(date: string | null | undefined): number | null {
  if (!date) return null;
  const y = Number.parseInt(date.slice(0, 4), 10);
  return Number.isInteger(y) && y > 0 ? y : null;
}

function names(ps: PersonForTree[], max: number): string {
  const shown = ps.slice(0, max).map((p) => p.full_name);
  const more = ps.length - shown.length;
  return more > 0 ? t`${shown.join(", ")} và ${more} người khác` : shown.join(", ");
}

/** Ưu tiên người đã mất có ảnh, rồi bất kỳ ai có ảnh (người còn sống bị ẩn ảnh ở bản công khai). */
function pickPhoto(ps: PersonForTree[]): string | null {
  const withPhoto = ps.filter((p) => !!p.photo_path);
  return (
    withPhoto.find((p) => !p.is_living)?.id ?? withPhoto[0]?.id ?? null
  );
}

const KIND_ORDER: Record<CandidateKind, number> = {
  root: 0,
  generation: 1,
  births: 2,
  deaths: 3,
};

export function computeClanTimeline(
  persons: PersonForTree[],
  opts: TimelineOptions = {},
): TimelineCandidate[] {
  const maxNames = opts.maxNames ?? 3;
  const genOffset = opts.generationOffset ?? 0;

  const born = persons
    .map((p) => ({ p, year: yearOf(p.birth_date) }))
    .filter((x): x is { p: PersonForTree; year: number } => x.year !== null)
    .sort((a, b) => a.year - b.year);

  // Thuỷ tổ: người đánh dấu is_root, nếu chưa có thì người sinh sớm nhất không có cha mẹ trong cây.
  const rootId =
    persons.find((p) => p.is_root)?.id ??
    born.find((x) => !x.p.birth_family_id)?.p.id ??
    null;

  const out: TimelineCandidate[] = [];
  const add = (
    bucket: TimelineBucket,
    kind: CandidateKind,
    c: Omit<TimelineCandidate, "key" | "kind" | "bucket" | "eras">,
    keySuffix = "",
  ) =>
    out.push({
      key: `${bucket.id}:${kind}${keySuffix}`,
      kind,
      bucket,
      eras: erasOverlapping(bucket.from, bucket.to),
      ...c,
    });

  // Thuỷ tổ
  const root = rootId ? born.find((x) => x.p.id === rootId) : undefined;
  if (root) {
    add(bucketOfYear(root.year), "root", {
      year: root.year,
      title: t`Thuỷ tổ ${root.p.full_name}`,
      body: t`Người đầu dòng, sinh năm ${root.year}.`,
      iconKey: "tree",
      photoPersonId: root.p.photo_path ? root.p.id : null,
      personIds: [root.p.id],
      recommended: true,
    });
  }

  // Đời mới: người sinh sớm nhất của mỗi đời → mốc "Đời N bắt đầu".
  const firstOfGen = new Map<number, { p: PersonForTree; year: number }>();
  for (const x of born) {
    const g = x.p.generation;
    if (g === null || g === undefined) continue;
    if (!firstOfGen.has(g)) firstOfGen.set(g, x);
  }
  for (const [g, x] of firstOfGen) {
    if (x.p.id === rootId) continue;
    const gen = g - genOffset;
    add(
      bucketOfYear(x.year),
      "generation",
      {
        year: x.year,
        title: t`Đời ${gen} bắt đầu`,
        body: t`${x.p.full_name} chào đời năm ${x.year}.`,
        iconKey: "cradle",
        photoPersonId: x.p.photo_path ? x.p.id : null,
        personIds: [x.p.id],
        recommended: true,
      },
      `:${g}`,
    );
  }

  // Sinh nở theo giai đoạn
  const byBucket = new Map<string, { b: TimelineBucket; ps: PersonForTree[] }>();
  for (const x of born) {
    const b = bucketOfYear(x.year);
    const e = byBucket.get(b.id) ?? { b, ps: [] };
    e.ps.push(x.p);
    byBucket.set(b.id, e);
  }
  for (const { b, ps } of byBucket.values()) {
    if (ps.length < 2) continue;
    add(b, "births", {
      year: Math.min(...ps.map((p) => yearOf(p.birth_date) ?? b.from)),
      title: t`${ps.length} thành viên chào đời`,
      body: names(ps, maxNames),
      iconKey: "family",
      photoPersonId: pickPhoto(ps),
      personIds: ps.map((p) => p.id),
      recommended: ps.length >= 3,
    });
  }

  // Người đã khuất (chỉ người đã mất)
  const diedBy = new Map<string, { b: TimelineBucket; ps: PersonForTree[] }>();
  for (const p of persons) {
    if (p.is_living) continue;
    const y = yearOf(p.death_date);
    if (y === null) continue;
    const b = bucketOfYear(y);
    const e = diedBy.get(b.id) ?? { b, ps: [] };
    e.ps.push(p);
    diedBy.set(b.id, e);
  }
  for (const { b, ps } of diedBy.values()) {
    add(b, "deaths", {
      year: Math.min(...ps.map((p) => yearOf(p.death_date) ?? b.from)),
      title: t`Tưởng nhớ những người đã khuất`,
      body: names(ps, maxNames),
      iconKey: "candle",
      photoPersonId: pickPhoto(ps),
      personIds: ps.map((p) => p.id),
      recommended: false,
    });
  }

  const sorted = out.sort(
    (a, b) =>
      a.bucket.from - b.bucket.from || KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
  );
  return applyRecommendation(sorted, opts.maxRecommended ?? 8);
}

const KIND_SCORE: Record<CandidateKind, number> = {
  root: 100,
  generation: 60,
  births: 40,
  deaths: 0,
};

/**
 * Chỉ bật sẵn tối đa `max` mốc: mỗi giai đoạn tối đa một mốc (mốc điểm cao nhất, đã đủ điều kiện
 * `recommended`), rồi nếu còn nhiều giai đoạn thì chọn trải đều theo thời gian, luôn giữ giai đoạn đầu
 * và cuối. Dòng họ trải 800 năm vẫn gợi ý được ~8 mốc thay vì hàng chục.
 */
function applyRecommendation(
  list: TimelineCandidate[],
  max: number,
): TimelineCandidate[] {
  const bestPerBucket = new Map<string, TimelineCandidate>();
  for (const c of list) {
    if (!c.recommended) continue;
    const cur = bestPerBucket.get(c.bucket.id);
    if (!cur || KIND_SCORE[c.kind] > KIND_SCORE[cur.kind]) {
      bestPerBucket.set(c.bucket.id, c);
    }
  }
  const eligible = [...bestPerBucket.values()].sort(
    (a, b) => a.bucket.from - b.bucket.from,
  );
  let chosen = eligible;
  if (eligible.length > max && max > 0) {
    const idx = new Set<number>();
    for (let i = 0; i < max; i++) {
      idx.add(
        max === 1 ? 0 : Math.round((i * (eligible.length - 1)) / (max - 1)),
      );
    }
    chosen = [...idx].map((i) => eligible[i]);
  }
  const keys = new Set(chosen.map((c) => c.key));
  return list.map((c) => ({ ...c, recommended: keys.has(c.key) }));
}

/** Gom ứng viên theo giai đoạn, giữ thứ tự thời gian — để vẽ trục. */
export function groupByBucket(
  list: TimelineCandidate[],
): { bucket: TimelineBucket; items: TimelineCandidate[] }[] {
  const map = new Map<string, { bucket: TimelineBucket; items: TimelineCandidate[] }>();
  for (const c of list) {
    const e = map.get(c.bucket.id) ?? { bucket: c.bucket, items: [] };
    e.items.push(c);
    map.set(c.bucket.id, e);
  }
  return [...map.values()].sort((a, b) => a.bucket.from - b.bucket.from);
}
