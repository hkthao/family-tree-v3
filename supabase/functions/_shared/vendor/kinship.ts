// ⚠️ FILE ĐƯỢC SAO CHÉP — KHÔNG SỬA Ở ĐÂY.
//
// Bản sao nguyên văn của src/lib/kinship.ts, để Edge Function dùng được
// mà không phải viết lại logic xưng hô tiếng Việt (LLM đoán chú/bác/cậu/dì
// sẽ sai — xem docs/plan-ai-tro-ly.md §Tính năng A).
//
// Vì sao phải chép: deploy edge function là scp riêng thư mục
// supabase/functions/ lên VPS, nên import ra ngoài thư mục đó sẽ không
// được đóng gói theo.
//
// Chống trôi: src/test/lib/kinshipVendorCopy.test.ts so sánh hai file phải
// GIỐNG HỆT nhau. Sửa bản gốc rồi chạy:
//     cp src/lib/kinship.ts supabase/functions/_shared/vendor/kinship.ts
// và chèn lại khối chú thích này lên đầu.

// ─── nguyên văn src/lib/kinship.ts ────────────────────────────────────
/**
 * Vietnamese kinship lookup — "tra cứu xưng hô".
 *
 * Given two persons in the same clan, returns what each calls the
 * other in Vietnamese kinship terms (chú / bác / cô / cậu / dì /
 * anh / em / cháu / etc.).
 *
 * Pure function — no React, no IO. The caller fetches the persons
 * + family structure once and feeds them in.
 *
 * MVP scope (per plan §26.11):
 *   - Direct lineage up to great-great-grandparent (sơ / chút).
 *   - Lateral 1 generation: siblings (ruột / cùng cha / cùng mẹ),
 *     cousins (anh em họ), uncles/aunts (chú/bác/cô/cậu/dì).
 *   - Lateral 2 generations: great-uncle/aunt level labelled
 *     generically ("ông chú/ông bác/ông cậu...").
 *
 * Out of scope (Phase 2):
 *   - Spouse-by-marriage labels (thím / mợ / dượng / dâu / rể).
 *   - Anh/chị họ xa beyond first cousins (just labelled as "họ").
 *   - Half-siblings via cousin marriage (rare in dataset).
 */

export interface KinshipPerson {
  id: string;
  full_name: string;
  gender: "M" | "F";
  /** Used for anh/chị/em comparisons and bác (older) vs chú (younger). */
  birth_year: number | null;
  /** From birth_family_id → husband_id. Null = unknown father. */
  father_id: string | null;
  /** From birth_family_id → wife_id. Null = unknown mother. */
  mother_id: string | null;
}

export type KinshipKind =
  | "same" // A === B
  | "unrelated" // no common ancestor in this clan
  | "direct_descendant" // A is ancestor of B (or vice versa)
  | "sibling" // share at least one parent
  | "uncle_aunt" // A is sibling of B's parent, OR mirror
  | "cousin" // A and B share a grandparent (not parent)
  | "great_uncle_aunt" // 1 generation higher than uncle/aunt
  | "distant"; // common ancestor 3+ generations up — fall back

export interface KinshipResult {
  kind: KinshipKind;
  /** What person A would call person B in Vietnamese. */
  aCallsB: string;
  /** What person B would call person A. */
  bCallsA: string;
  /**
   * Plain-language path explanation for the UI debug pane. Always
   * present so the UI can show the reasoning without re-deriving it.
   */
  reason: string;
}

// ─── Ancestry walk ──────────────────────────────────────────────────

interface AncestorHit {
  depth: number;
  /**
   * Step-by-step path A → LCA. Each entry is whether the next step
   * went via father ("F") or mother ("M"). Length = depth.
   */
  path: ("F" | "M")[];
}

/**
 * Walk up from a person collecting every ancestor reachable through
 * father AND mother branches. Caps at depth 8 — Vietnamese kinship
 * names get vague past that and we already classify the depth-3+
 * case as `distant`. Cycle-safe via the visited set.
 */
function ancestors(
  startId: string,
  persons: Map<string, KinshipPerson>,
): Map<string, AncestorHit> {
  const out = new Map<string, AncestorHit>();
  // Each frame = (personId, depth, path-to-reach)
  const queue: Array<{ id: string; depth: number; path: ("F" | "M")[] }> = [
    { id: startId, depth: 0, path: [] },
  ];
  // De-dup so the same ancestor reached by multiple paths only keeps
  // the SHORTEST path (which is what kinship cares about).
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const prev = out.get(cur.id);
    if (prev && prev.depth <= cur.depth) continue;
    out.set(cur.id, { depth: cur.depth, path: cur.path });
    if (cur.depth >= 8) continue;
    const person = persons.get(cur.id);
    if (!person) continue;
    if (person.father_id) {
      queue.push({
        id: person.father_id,
        depth: cur.depth + 1,
        path: [...cur.path, "F"],
      });
    }
    if (person.mother_id) {
      queue.push({
        id: person.mother_id,
        depth: cur.depth + 1,
        path: [...cur.path, "M"],
      });
    }
  }
  return out;
}

/**
 * Lowest common ancestor (lowest combined depth). When multiple
 * ancestors tie, prefers the one closer to A — matters when A and
 * B are full siblings (both parents are LCAs at depth 1; either
 * is fine — they yield the same kinship label).
 */
function findLCA(
  a: Map<string, AncestorHit>,
  b: Map<string, AncestorHit>,
): { id: string; depthA: number; depthB: number; pathA: ("F" | "M")[]; pathB: ("F" | "M")[] } | null {
  let best: {
    id: string;
    depthA: number;
    depthB: number;
    pathA: ("F" | "M")[];
    pathB: ("F" | "M")[];
  } | null = null;
  for (const [id, hitA] of a) {
    const hitB = b.get(id);
    if (!hitB) continue;
    const combined = hitA.depth + hitB.depth;
    if (
      !best ||
      combined < best.depthA + best.depthB ||
      (combined === best.depthA + best.depthB && hitA.depth < best.depthA)
    ) {
      best = {
        id,
        depthA: hitA.depth,
        depthB: hitB.depth,
        pathA: hitA.path,
        pathB: hitB.path,
      };
    }
  }
  return best;
}

// ─── Label generation ───────────────────────────────────────────────

/**
 * Direct-descendant labels by depth difference. Vietnamese uses
 * specific terms up to "chút" (4 generations) then trails off.
 * descendantTerm(g, depth) = how you call your descendant `depth`
 * generations below you, given the descendant's gender.
 */
function descendantTerm(gender: "M" | "F", depth: number): string {
  if (depth === 1) return gender === "M" ? "con trai" : "con gái";
  if (depth === 2) return gender === "M" ? "cháu trai" : "cháu gái";
  if (depth === 3) return gender === "M" ? "chắt trai" : "chắt gái";
  if (depth === 4) return gender === "M" ? "chút trai" : "chút gái";
  return "hậu duệ";
}

/** Ancestor labels by depth difference + gender of ancestor. */
function ancestorTerm(gender: "M" | "F", depth: number): string {
  if (depth === 1) return gender === "M" ? "cha" : "mẹ";
  if (depth === 2) return gender === "M" ? "ông nội/ngoại" : "bà nội/ngoại";
  if (depth === 3) return gender === "M" ? "cụ" : "cụ";
  if (depth === 4) return gender === "M" ? "kỵ" : "kỵ";
  return "tổ tiên";
}

/**
 * Refine the depth-2 ancestor label by paternal/maternal side.
 * `firstStep` is the first letter of the path from caller → LCA.
 */
function ancestorTermSided(gender: "M" | "F", depth: number, firstStep: "F" | "M"): string {
  if (depth === 2) {
    const side = firstStep === "F" ? "nội" : "ngoại";
    return gender === "M" ? `ông ${side}` : `bà ${side}`;
  }
  if (depth === 3) {
    return gender === "M" ? "cụ ông" : "cụ bà";
  }
  return ancestorTerm(gender, depth);
}

interface ResolveCtx {
  a: KinshipPerson;
  b: KinshipPerson;
  pathA: ("F" | "M")[];
  pathB: ("F" | "M")[];
  /** Common intermediate ancestors on each side — keyed by person id. */
  persons: Map<string, KinshipPerson>;
}

function compareYears(a: number | null, b: number | null): "older" | "younger" | "unknown" {
  if (a == null || b == null) return "unknown";
  if (a < b) return "older";
  if (a > b) return "younger";
  return "unknown";
}

/**
 * "Older/younger" comparator that mirrors Vietnamese convention:
 * older → anh/chị; younger → em. When years are equal or unknown,
 * fall back to a neutral label.
 */
function siblingLabel(
  self: KinshipPerson,
  other: KinshipPerson,
): string {
  // `self` is the one DOING the calling; `other` is being called.
  const cmp = compareYears(other.birth_year, self.birth_year);
  if (cmp === "older") {
    return other.gender === "M" ? "anh" : "chị";
  }
  if (cmp === "younger") {
    return other.gender === "M" ? "em trai" : "em gái";
  }
  return other.gender === "M" ? "anh/em trai" : "chị/em gái";
}

// ─── Public API ─────────────────────────────────────────────────────

export function computeKinship(
  aId: string,
  bId: string,
  persons: Map<string, KinshipPerson>,
): KinshipResult {
  const a = persons.get(aId);
  const b = persons.get(bId);
  if (!a || !b) {
    return {
      kind: "unrelated",
      aCallsB: "—",
      bCallsA: "—",
      reason: "Không tìm thấy một trong hai người trong dữ liệu dòng họ.",
    };
  }
  if (aId === bId) {
    return {
      kind: "same",
      aCallsB: a.full_name,
      bCallsA: b.full_name,
      reason: "Cùng một người.",
    };
  }

  const ancA = ancestors(aId, persons);
  const ancB = ancestors(bId, persons);
  const lca = findLCA(ancA, ancB);

  if (!lca) {
    return {
      kind: "unrelated",
      aCallsB: "—",
      bCallsA: "—",
      reason: "Không tìm thấy tổ tiên chung trong gia phả.",
    };
  }

  const { depthA, depthB, pathA, pathB, id: lcaId } = lca;
  const lcaPerson = persons.get(lcaId);
  const ctx: ResolveCtx = { a, b, pathA, pathB, persons };

  // Direct lineage: one is ancestor of the other.
  if (depthA === 0) {
    // B is on the A → ancestor chain ... wait, depthA = 0 means LCA = A.
    // So A IS B's ancestor. depthB = how many generations down B is.
    return {
      kind: "direct_descendant",
      aCallsB: descendantTerm(b.gender, depthB),
      bCallsA: ancestorTermSided(a.gender, depthB, pathB[0] ?? "F"),
      reason: `${a.full_name} là tổ tiên trực hệ của ${b.full_name} (${depthB} đời).`,
    };
  }
  if (depthB === 0) {
    return {
      kind: "direct_descendant",
      aCallsB: ancestorTermSided(b.gender, depthA, pathA[0] ?? "F"),
      bCallsA: descendantTerm(a.gender, depthA),
      reason: `${b.full_name} là tổ tiên trực hệ của ${a.full_name} (${depthA} đời).`,
    };
  }

  // Sibling: depth 1 + 1, LCA is one shared parent. Detect full vs
  // half-sibling by checking both parent slots.
  if (depthA === 1 && depthB === 1) {
    return resolveSiblings(ctx);
  }

  // Uncle/aunt: 1 + 2 or 2 + 1.
  if (depthA === 2 && depthB === 1) {
    // B is sibling of A's parent on path pathA[0]. From A's POV, B is
    // đời trên 1 → call chú/bác/cô/cậu/dì.
    return resolveUncleAuntFromA(ctx);
  }
  if (depthA === 1 && depthB === 2) {
    const mirror = resolveUncleAuntFromA({
      a: b,
      b: a,
      pathA: pathB,
      pathB: pathA,
      persons,
    });
    // Swap perspectives so the result is from A's POV.
    return {
      kind: mirror.kind,
      aCallsB: mirror.bCallsA,
      bCallsA: mirror.aCallsB,
      reason: mirror.reason,
    };
  }

  // First cousins: depth 2 + 2. LCA is shared grandparent (paternal
  // OR maternal). Vietnamese collapses to "anh/chị/em họ" regardless
  // of side at MVP.
  if (depthA === 2 && depthB === 2) {
    return {
      kind: "cousin",
      aCallsB: siblingLabel(a, b) + " họ",
      bCallsA: siblingLabel(b, a) + " họ",
      reason: `Có cùng ông/bà (${lcaPerson?.full_name ?? "—"}) — anh em họ đời thứ nhất.`,
    };
  }

  // Great-uncle/aunt: 3+1 or 1+3.
  if (depthA === 3 && depthB === 1) {
    const side = pathA[0] === "F" ? "nội" : "ngoại";
    const label = b.gender === "M" ? `ông ${side}` : `bà ${side}`;
    return {
      kind: "great_uncle_aunt",
      aCallsB: label,
      bCallsA: descendantTerm(a.gender, 2),
      reason: `${b.full_name} là anh chị em ruột của ông/bà bên ${side} của ${a.full_name}.`,
    };
  }
  if (depthA === 1 && depthB === 3) {
    const side = pathB[0] === "F" ? "nội" : "ngoại";
    const label = a.gender === "M" ? `ông ${side}` : `bà ${side}`;
    return {
      kind: "great_uncle_aunt",
      aCallsB: descendantTerm(b.gender, 2),
      bCallsA: label,
      reason: `${a.full_name} là anh chị em ruột của ông/bà bên ${side} của ${b.full_name}.`,
    };
  }

  // Anything farther — give a generic "họ hàng xa" label so the UI
  // doesn't lie. Useful enough for the MVP; precise labels at this
  // depth aren't standardised even by tradition.
  return {
    kind: "distant",
    aCallsB: "họ hàng xa",
    bCallsA: "họ hàng xa",
    reason: `Có tổ tiên chung ${lcaPerson?.full_name ?? "—"}, cách ${depthA} đời (${a.full_name}) và ${depthB} đời (${b.full_name}). Quá xa để quy về xưng hô thông dụng.`,
  };
}

// ─── Resolvers ──────────────────────────────────────────────────────

function resolveSiblings(ctx: ResolveCtx): KinshipResult {
  const { a, b } = ctx;
  const sameFather = !!a.father_id && a.father_id === b.father_id;
  const sameMother = !!a.mother_id && a.mother_id === b.mother_id;

  let suffix = "";
  if (sameFather && sameMother) suffix = " ruột";
  else if (sameFather) suffix = " cùng cha";
  else if (sameMother) suffix = " cùng mẹ";
  // else: still siblings via at least one shared parent (LCA found),
  // but the person record is missing the other side — leave suffix empty.

  return {
    kind: "sibling",
    aCallsB: siblingLabel(a, b) + suffix,
    bCallsA: siblingLabel(b, a) + suffix,
    reason: sameFather && sameMother
      ? "Cùng cha cùng mẹ."
      : sameFather
        ? "Cùng cha khác mẹ."
        : sameMother
          ? "Cùng mẹ khác cha."
          : "Có ít nhất một cha hoặc mẹ chung.",
  };
}

function resolveUncleAuntFromA(ctx: ResolveCtx): KinshipResult {
  const { a, b, pathA, persons } = ctx;
  // pathA = [step1] where step1 is which parent of A leads up to the
  // grandparent (LCA). step1 = "F" means LCA is A's paternal
  // grandparent → B is on A's paternal side ("bên nội").
  const aParentSide: "F" | "M" = pathA[0] ?? "F";
  const aParentId = aParentSide === "F" ? a.father_id : a.mother_id;
  const aParent = aParentId ? persons.get(aParentId) : null;

  const side = aParentSide === "F" ? "paternal" : "maternal";

  let label: string;
  let bCallsA: string;
  if (side === "paternal") {
    // Sibling of father: bác (older) / chú (younger, male) / cô (female any).
    if (b.gender === "F") {
      label = "cô";
    } else {
      const cmp = compareYears(b.birth_year, aParent?.birth_year ?? null);
      if (cmp === "older") label = "bác";
      else if (cmp === "younger") label = "chú";
      else label = "bác/chú"; // unknown ages — give both
    }
  } else {
    // Maternal side: cậu (male) / dì (female), age does not matter.
    label = b.gender === "M" ? "cậu" : "dì";
  }
  // From B's perspective, A is B's nephew/niece via B's sibling.
  bCallsA = a.gender === "M" ? "cháu trai" : "cháu gái";

  const sideVn = side === "paternal" ? "nội" : "ngoại";
  return {
    kind: "uncle_aunt",
    aCallsB: label,
    bCallsA,
    reason: `${b.full_name} là anh/chị/em ruột của ${aParent?.full_name ?? "cha/mẹ"} (bên ${sideVn} của ${a.full_name}).`,
  };
}
