import {
  Circle,
  Document,
  G,
  Image,
  Page,
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";

import type { ClanDetail } from "@/lib/queries/clan-detail";
import type { ClanBookData } from "@/lib/queries/clan-book";
import type { PersonDetail } from "@/lib/queries/persons";
import { formatPartialDate } from "@/lib/partialDate";
import { computeLifespanYears, lifespanLabel, THO_MIN_AGE } from "@/lib/lifespan";
import {
  formatLunarAnniversary,
  formatLunarDate,
} from "@/lib/lunarDate";

import { ensurePdfFontRegistered, PDF_FONT_FAMILY } from "./registerFont";

// ─── Page geometry (A4 in points) ──────────────────────────────────

const PAGE_W = 595;
const PAGE_H = 842;
const SIDE_PAD = 56;
const TOP_PAD = 60;
const BOTTOM_PAD = 68;

const COLORS = {
  ink: "#1F1A17",
  muted: "#6F665F",
  divider: "#D8CFC2",
  primary: "#7A2230",
  accent: "#C19A5B",
  paper: "#FBF7F0",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 10.5,
    lineHeight: 1.45,
    color: COLORS.ink,
    paddingTop: TOP_PAD,
    paddingBottom: BOTTOM_PAD,
    paddingHorizontal: SIDE_PAD,
    backgroundColor: COLORS.paper,
  },

  // Cover
  coverWrap: { marginTop: 100, alignItems: "center" },
  coverLogo: { width: 96, height: 96, marginBottom: 22 },
  coverEyebrow: {
    fontSize: 10,
    color: COLORS.muted,
    marginBottom: 18,
  },
  coverTitle: {
    fontSize: 40,
    fontWeight: 600,
    lineHeight: 1.3,
    color: COLORS.primary,
    paddingBottom: 8,
    marginBottom: 18,
  },
  coverDivider: {
    width: 90,
    height: 1.5,
    backgroundColor: COLORS.accent,
    marginBottom: 16,
  },
  coverTagline: {
    fontSize: 13,
    color: COLORS.accent,
    fontWeight: 600,
    marginBottom: 6,
  },
  coverSubtitle: {
    fontSize: 11,
    color: COLORS.muted,
    marginBottom: 32,
    textAlign: "center",
  },
  coverStat: { fontSize: 12, color: COLORS.ink, marginBottom: 4 },
  coverDateline: { fontSize: 11, color: COLORS.muted, marginTop: 36 },

  // Section heading. h1 has its own lineHeight (1.2) so descenders
  // ("ạ", "ậ") stay inside the Text box; the underline sits just
  // below the box with minimal extra gap.
  h1: {
    fontSize: 22,
    fontWeight: 600,
    lineHeight: 1.2,
    color: COLORS.primary,
    marginBottom: 2,
  },
  h1Underline: {
    width: 60,
    height: 1.5,
    backgroundColor: COLORS.accent,
    marginBottom: 14,
  },
  intro: { color: COLORS.muted, marginBottom: 14, fontSize: 10 },

  // Preface / phàm lệ
  prefaceItem: { fontSize: 10.5, marginBottom: 4 },

  // Indented tree
  treeRow: { marginBottom: 2 },
  treeLine: { fontSize: 10.5 },
  treeSpouse: { fontSize: 9.5, color: COLORS.muted },

  // Detail entries — 3-card grid (each row = one Page-flow View with
  // flexDirection: row, three fixed-width cards inside).
  cardRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  card: {
    width: 152, // (content_width 483 - 2*6gap) / 3 ≈ 157, leave breathing room
    marginRight: 6,
    padding: 8,
    borderWidth: 0.5,
    borderColor: COLORS.divider,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  cardLast: { marginRight: 0 },
  // View-based avatar (no Image — Image trips a Buffer polyfill issue
  // in this Vite bundle). A coloured circle with the first letter of
  // the given name, gendered by background colour.
  // Round avatar image (the actual male.png / female.png illustration
  // from /public/avatars). Sits at the top of each card.
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: 6,
  },
  personName: {
    fontSize: 10.5,
    fontWeight: 600,
    color: COLORS.primary,
    marginBottom: 1,
    textAlign: "center",
  },
  personMeta: {
    fontSize: 8.5,
    color: COLORS.muted,
    marginBottom: 5,
    textAlign: "center",
  },
  cardBody: { alignSelf: "stretch" },
  field: { fontSize: 8.5, marginBottom: 1 },
  // Solo entry (in-laws + fallback) keeps the simple full-width row.
  personEntry: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.divider,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 32,
    left: SIDE_PAD,
    right: SIDE_PAD,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8.5,
    color: COLORS.muted,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.divider,
  },
});

// ─── Vine border (SVG vector, fixed per page) ──────────────────────

const FRAME_OUT_M = 24; // outer rectangle margin from page edge
const FRAME_IN_M = 32; // inner rectangle margin
const VINE_REACH = 64; // how far the corner vine curls along each edge

/**
 * Renders a single corner vine. `(cx, cy)` is the corner pivot;
 * `sx, sy` are ±1 reflection signs so the same geometry produces
 * all four corners, each curling INWARD toward the page centre.
 *   TL: ( +1, +1 )   TR: ( -1, +1 )
 *   BL: ( +1, -1 )   BR: ( -1, -1 )
 * We use sign-based reflection instead of rotation because rotating
 * an asymmetric path 90°/270° around the corner doesn't mirror it
 * along the perpendicular edge — the vines ended up pointing
 * outward in two of the corners.
 */
function vineCorner(
  cx: number,
  cy: number,
  sx: number,
  sy: number,
): React.ReactNode {
  const x = (off: number) => cx + sx * off;
  const y = (off: number) => cy + sy * off;
  return (
    <G>
      <Path
        d={`M ${x(VINE_REACH)} ${y(8)} Q ${x(10)} ${y(10)} ${x(8)} ${y(VINE_REACH)}`}
        stroke={COLORS.primary}
        strokeWidth={1}
        fill="none"
      />
      <Path
        d={`M ${x(VINE_REACH - 8)} ${y(16)} Q ${x(18)} ${y(18)} ${x(16)} ${y(VINE_REACH - 8)}`}
        stroke={COLORS.accent}
        strokeWidth={0.6}
        fill="none"
      />
      <Circle cx={x(VINE_REACH - 2)} cy={y(10)} r={2.4} fill={COLORS.accent} />
      <Circle cx={x(24)} cy={y(24)} r={3.2} fill={COLORS.primary} />
      <Circle cx={x(10)} cy={y(VINE_REACH - 2)} r={2.4} fill={COLORS.accent} />
      <Circle cx={x(40)} cy={y(14)} r={1.2} fill={COLORS.primary} />
      <Circle cx={x(14)} cy={y(40)} r={1.2} fill={COLORS.primary} />
    </G>
  );
}

/** Three-dot cluster at the midpoint of an edge. */
function midOrnament(
  cx: number,
  cy: number,
  vertical: boolean,
): React.ReactNode {
  const dx = vertical ? 0 : 9;
  const dy = vertical ? 9 : 0;
  return (
    <G>
      <Circle cx={cx} cy={cy} r={2.6} fill={COLORS.primary} />
      <Circle cx={cx - dx} cy={cy - dy} r={1.4} fill={COLORS.accent} />
      <Circle cx={cx + dx} cy={cy + dy} r={1.4} fill={COLORS.accent} />
    </G>
  );
}

function VineBorder({
  width = PAGE_W,
  height = PAGE_H,
}: {
  width?: number;
  height?: number;
} = {}) {
  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height,
      }}
      fixed
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Outer red rectangle */}
        <Rect
          x={FRAME_OUT_M}
          y={FRAME_OUT_M}
          width={width - FRAME_OUT_M * 2}
          height={height - FRAME_OUT_M * 2}
          stroke={COLORS.primary}
          strokeWidth={1.2}
          fill="none"
        />
        {/* Inner amber rectangle */}
        <Rect
          x={FRAME_IN_M}
          y={FRAME_IN_M}
          width={width - FRAME_IN_M * 2}
          height={height - FRAME_IN_M * 2}
          stroke={COLORS.accent}
          strokeWidth={0.5}
          fill="none"
        />
        {/* Four corner vines (sign-based reflection: each curls inward) */}
        {vineCorner(FRAME_OUT_M, FRAME_OUT_M, +1, +1)}
        {vineCorner(width - FRAME_OUT_M, FRAME_OUT_M, -1, +1)}
        {vineCorner(width - FRAME_OUT_M, height - FRAME_OUT_M, -1, -1)}
        {vineCorner(FRAME_OUT_M, height - FRAME_OUT_M, +1, -1)}
        {/* Mid-edge ornaments */}
        {midOrnament(width / 2, FRAME_OUT_M, false)}
        {midOrnament(width / 2, height - FRAME_OUT_M, false)}
        {midOrnament(FRAME_OUT_M, height / 2, true)}
        {midOrnament(width - FRAME_OUT_M, height / 2, true)}
      </Svg>
    </View>
  );
}

// ─── Document ───────────────────────────────────────────────────────

interface Props {
  clan: ClanDetail;
  data: ClanBookData;
  include?: { tree?: boolean; detail?: boolean; restingPlaces?: boolean };
  /**
   * Optional personId → JPEG data URI map for embedding real avatar
   * photos. Persons not in the map fall back to the gendered
   * illustration. The caller pre-fetches these in exportClanBook so
   * the PDF render stays synchronous.
   */
  photoByPersonId?: Map<string, string>;
}

export function ClanBookPdf({ clan, data, include, photoByPersonId }: Props) {
  ensurePdfFontRegistered();

  const showTree = include?.tree ?? true;
  const showDetail = include?.detail ?? true;
  const showRestingPlaces = include?.restingPlaces ?? true;

  const RP_KIND_LABEL: Record<string, string> = {
    grave: "Mộ / chôn cất",
    ashes_temple: "Gửi tro cốt ở chùa",
    columbarium: "Nhà lưu tro / tháp cốt",
    scattered: "Rải tro",
    other: "Khác",
  };
  const RP_STATUS_LABEL: Record<string, string> = {
    existing: "Hiện hữu",
    relocated: "Đã cải táng",
    lost: "Thất lạc",
  };

  const { persons, families } = data;
  const branchById = new Map(data.branches.map((b) => [b.id, b.name]));
  const personById = new Map(persons.map((p) => [p.id, p]));

  // Bloodline (generation !== null) vs in-laws (married in, no clan parents).
  const bloodline = persons.filter((p) => p.generation !== null);
  const inLaws = persons.filter((p) => p.generation === null);

  const spousesByPerson = new Map<string, string[]>();
  const childrenByParent = new Map<string, string[]>();
  const fatherOf = new Map<string, string>();
  const motherOf = new Map<string, string>();
  const familyById = new Map(families.map((f) => [f.id, f]));

  for (const fam of families) {
    if (fam.husband_id && fam.wife_id) {
      pushTo(spousesByPerson, fam.husband_id, fam.wife_id);
      pushTo(spousesByPerson, fam.wife_id, fam.husband_id);
    }
  }
  for (const [childId, famId] of Object.entries(data.childToFamily)) {
    const fam = familyById.get(famId);
    if (!fam) continue;
    if (fam.husband_id) {
      pushTo(childrenByParent, fam.husband_id, childId);
      fatherOf.set(childId, fam.husband_id);
    }
    if (fam.wife_id) {
      pushTo(childrenByParent, fam.wife_id, childId);
      motherOf.set(childId, fam.wife_id);
    }
  }

  // d'Aboville numbering — DFS from roots.
  const sttById = new Map<string, string>();
  const orderInSiblings = new Map<string, number>();
  const minGen = bloodline.reduce(
    (m, p) => Math.min(m, p.generation ?? Infinity),
    Infinity,
  );
  const roots = bloodline
    .filter((p) => p.is_root || p.generation === minGen)
    .sort(birthOrder);

  function assignStt(personId: string, prefix: string) {
    sttById.set(personId, prefix);
    const kids = (childrenByParent.get(personId) ?? [])
      .map((id) => personById.get(id))
      .filter((p): p is PersonDetail => !!p && p.generation !== null)
      .sort(birthOrder);
    kids.forEach((k, i) => {
      orderInSiblings.set(k.id, i);
      assignStt(k.id, `${prefix}.${i + 1}`);
    });
  }
  roots.forEach((r, i) => {
    orderInSiblings.set(r.id, i);
    assignStt(r.id, `${i + 1}`);
  });

  // Don't drop bloodline members whose parent link is missing/broken
  // (orphaned data) — they'd silently vanish from the book. Treat each
  // such person as an extra root and number them after the real roots,
  // pulling in their descendants too. Guarantees every bloodline member
  // appears, in a deterministic order.
  let nextRoot = roots.length;
  const orphans = bloodline
    .filter((p) => !sttById.has(p.id))
    .sort(
      (a, b) =>
        (a.generation ?? 0) - (b.generation ?? 0) || birthOrder(a, b),
    );
  for (const p of orphans) {
    if (sttById.has(p.id)) continue; // picked up as a descendant meanwhile
    orderInSiblings.set(p.id, nextRoot);
    assignStt(p.id, `${nextRoot + 1}`);
    nextRoot++;
  }

  // Thứ tự danh bạ: thuỷ tổ (đời 1) trước → theo đời → trong mỗi đời
  // theo thứ tự anh chị em (số d'Aboville giữ đúng nhánh + thứ tự con).
  // Sắp theo generation trước, rồi compareStt, nên đọc lần lượt Đời 1,
  // Đời 2, Đời 3… thay vì đi sâu hết một nhánh mới sang nhánh khác.
  const bloodlineSorted = [...bloodline].sort(
    (a, b) =>
      (a.generation ?? 0) - (b.generation ?? 0) ||
      compareStt(sttById.get(a.id) ?? "999999", sttById.get(b.id) ?? "999999"),
  );

  const stats = {
    bloodlineCount: bloodline.length,
    inLawCount: inLaws.length,
    maxGen:
      bloodline.length > 0
        ? bloodline.reduce((m, p) => Math.max(m, p.generation ?? 0), 0)
        : 0,
    branches: data.branches.length,
  };

  const today = new Date();
  const todayLabel = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;
  const cleanName = stripParenthetical(clan.name);

  return (
    <Document
      title={`Gia phả - ${cleanName}`}
      author="Gia phả"
      subject={`Sổ gia phả dòng họ ${cleanName}`}
    >
      {/* ─── Cover ──────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <VineBorder />
        <View style={styles.coverWrap}>
          <Image src="/icons/app-icon-192.png" style={styles.coverLogo} />
          <Text style={styles.coverEyebrow}>GIA PHẢ</Text>
          <Text style={styles.coverTitle}>{withHoPrefix(cleanName)}</Text>
          <View style={styles.coverDivider} />
          <Text style={styles.coverTagline}>Phả hệ chính thức</Text>
          {clan.description && !looksLikeDebug(clan.description) ? (
            <Text style={styles.coverSubtitle}>{clan.description}</Text>
          ) : null}
          <Text style={styles.coverStat}>
            Tổng {stats.bloodlineCount} con cháu, {stats.maxGen} đời
            {stats.branches > 0 ? `, ${stats.branches} chi` : ""}
          </Text>
          {stats.inLawCount > 0 ? (
            <Text style={styles.coverStat}>
              Kèm {stats.inLawCount} dâu/rể kết hôn vào họ
            </Text>
          ) : null}
          <Text style={styles.coverDateline}>Biên soạn ngày {todayLabel}</Text>
        </View>
      </Page>

      {/* ─── Phàm lệ ─────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <VineBorder />
        <Text style={styles.h1}>Phàm lệ</Text>
        <View style={styles.h1Underline} />
        <Text style={styles.intro}>
          Một vài quy ước sử dụng trong cuốn gia phả này.
        </Text>
        <Text style={styles.prefaceItem}>
          - Mỗi người trong huyết thống có một số d'Aboville theo dạng
          {" "}1, 1.1, 1.2.3 ... Số càng nhiều chấm thì đời càng sâu.
          {" "}Đời thứ nhất là thuỷ tổ, mỗi đời sau là một bậc con.
        </Text>
        <Text style={styles.prefaceItem}>
          - Khi nhắc tới một người khác trong sách (cha, mẹ, con,
          {" "}vợ/chồng), số d'Aboville đứng trước tên để tra ngược dễ.
          {" "}Người ngoài huyết thống (dâu/rể) liệt kê ở mục riêng cuối
          {" "}sách.
        </Text>
        <Text style={styles.prefaceItem}>
          - Năm sinh - năm mất ghi theo dương lịch. Khi có thông tin
          {" "}đầy đủ, mỗi người còn có ngày sinh / mất / giỗ theo âm
          {" "}lịch (Hồ Ngọc Đức), kèm Can Chi.
        </Text>
        <Text style={styles.prefaceItem}>
          - Vai vế "Trưởng" dành cho con cả trong nhóm anh chị em;
          {" "}"Thứ" dành cho các con sau.
        </Text>
        <Text style={styles.prefaceItem}>
          - Trường để trống nghĩa là chưa có thông tin - chứ không
          {" "}phải là không tồn tại.
        </Text>
      </Page>

      {/* ─── Cây phả hệ (SVG diagram, paginated) ─────────────── */}
      {showTree && bloodline.length > 0 &&
        renderTreePages({
          bloodline,
          roots,
          branches: data.branches,
          childrenByParent,
          personById,
          showDeathDetails: clan.display_death_details,
          showLivingFullDob: clan.display_living_full_dob,
        })}

      {/* ─── Danh bạ chi tiết (3-card grid) ─────────────────── */}
      {showDetail && bloodlineSorted.length > 0 && (
        <Page size="A4" style={styles.page}>
        <VineBorder />
          <Text style={styles.h1}>Danh bạ chi tiết</Text>
          <View style={styles.h1Underline} />
          <Text style={styles.intro}>
            Bắt đầu từ Thuỷ tổ, lần lượt theo từng đời; trong mỗi đời
            xếp theo thứ tự anh - chị - em (con trưởng trước). Mỗi hàng
            ba thẻ.
          </Text>

          {chunk(bloodlineSorted, 3).map((row, i) => (
            <View key={i} style={styles.cardRow} wrap={false}>
              {row.map((p, ci) => (
                <View
                  key={p.id}
                  style={
                    ci === row.length - 1
                      ? [styles.card, styles.cardLast]
                      : styles.card
                  }
                >
                  {renderPersonCard(
                    p,
                    orderInSiblings,
                    childrenByParent,
                    spousesByPerson,
                    fatherOf,
                    motherOf,
                    personById,
                    branchById,
                    clan.generation_offset,
                    photoByPersonId,
                    clan.display_death_details,
                  )}
                </View>
              ))}
            </View>
          ))}
        </Page>
      )}

      {/* ─── Dâu / rể (3-card grid, same style as danh bạ) ──── */}
      {inLaws.length > 0 && (
        <Page size="A4" style={styles.page}>
        <VineBorder />
          <Text style={styles.h1}>Dâu / rể kết hôn vào họ</Text>
          <View style={styles.h1Underline} />
          <Text style={styles.intro}>
            Người ngoài huyết thống. Không gắn số đời, sắp theo bảng
            chữ cái. Ghi kèm vợ/chồng trong họ để tra ngược.
          </Text>
          {chunk(
            [...inLaws].sort((a, b) =>
              a.full_name.localeCompare(b.full_name, "vi"),
            ),
            3,
          ).map((row, i) => (
            <View key={i} style={styles.cardRow} wrap={false}>
              {row.map((p, ci) => (
                <View
                  key={p.id}
                  style={
                    ci === row.length - 1
                      ? [styles.card, styles.cardLast]
                      : styles.card
                  }
                >
                  {renderInLawCard(p, spousesByPerson, personById, photoByPersonId)}
                </View>
              ))}
            </View>
          ))}
        </Page>
      )}

      {/* ─── Mộ phần & tro cốt ──────────────────────────────── */}
      {showRestingPlaces && data.restingPlaces.length > 0 && (
        <Page size="A4" style={styles.page}>
          <VineBorder />
          <Text style={styles.h1}>Mộ phần &amp; tro cốt</Text>
          <View style={styles.h1Underline} />
          <Text style={styles.intro}>
            Nơi an nghỉ của các cụ: mộ phần, tro cốt gửi chùa / tháp họ.
          </Text>
          {data.restingPlaces.map((rp) => {
            const loc = [rp.location_name, rp.location_detail]
              .filter(Boolean)
              .join(" · ");
            return (
              <View key={rp.id} wrap={false} style={{ marginBottom: 9 }}>
                <Text style={{ fontSize: 11, fontWeight: 700 }}>
                  {rp.name || rp.location_name || RP_KIND_LABEL[rp.kind]}
                </Text>
                <Text style={{ fontSize: 9.5, color: "#6F665F" }}>
                  {RP_KIND_LABEL[rp.kind]}
                  {loc ? ` — ${loc}` : ""}
                  {rp.status !== "existing"
                    ? ` (${RP_STATUS_LABEL[rp.status]})`
                    : ""}
                </Text>
                {rp.address ? (
                  <Text style={{ fontSize: 9.5, color: "#6F665F" }}>
                    {rp.address}
                  </Text>
                ) : null}
                {rp.occupant_names.length > 0 ? (
                  <Text style={{ fontSize: 9.5 }}>
                    Người an nghỉ: {rp.occupant_names.join(", ")}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </Page>
      )}
    </Document>
  );
}

// ─── Person card (3-up grid version) ──────────────────────────────

function renderPersonCard(
  p: PersonDetail,
  orderInSiblings: Map<string, number>,
  childrenByParent: Map<string, string[]>,
  spousesByPerson: Map<string, string[]>,
  fatherOf: Map<string, string>,
  motherOf: Map<string, string>,
  personById: Map<string, PersonDetail>,
  branchById: Map<string, string>,
  genOffset: number,
  photoByPersonId?: Map<string, string>,
  showDeathDetails = false,
): React.ReactNode {
  const birthSolar = formatPartialDate({
    date: p.birth_date,
    precision: p.birth_date_precision ?? null,
  });
  const deathSolar = formatPartialDate({
    date: p.death_date,
    precision: p.death_date_precision ?? null,
  });
  const birthLunar = formatLunarDate({
    year: p.birth_lunar_year ?? undefined,
    month: p.birth_lunar_month ?? undefined,
    day: p.birth_lunar_day ?? undefined,
  });
  const gioRow = formatLunarAnniversary({
    month: p.death_anniv_lunar_month ?? undefined,
    day: p.death_anniv_lunar_day ?? undefined,
  });
  const thoYears = computeLifespanYears(
    p.lifespan_years,
    p.birth_date,
    p.death_date,
  );

  const spouses = (spousesByPerson.get(p.id) ?? [])
    .map((id) => personById.get(id))
    .filter((s): s is PersonDetail => !!s);
  const children = (childrenByParent.get(p.id) ?? [])
    .map((id) => personById.get(id))
    .filter((c): c is PersonDetail => !!c && c.generation !== null)
    .sort(birthOrder);

  const father = fatherOf.has(p.id)
    ? (personById.get(fatherOf.get(p.id)!) ?? null)
    : null;
  const mother = motherOf.has(p.id)
    ? (personById.get(motherOf.get(p.id)!) ?? null)
    : null;

  const branchName = p.branch_id ? branchById.get(p.branch_id) : null;
  const order = orderInSiblings.get(p.id) ?? 0;
  const vaiVe = order === 0 ? "trưởng" : "thứ";

  const metaParts: string[] = [];
  if (p.generation !== null)
    metaParts.push(`Đời ${p.generation - genOffset}`);
  metaParts.push(`${p.gender === "M" ? "Nam" : "Nữ"} (${vaiVe})`);
  if (!p.is_living) metaParts.push("đã mất");
  if (branchName) metaParts.push(`chi ${branchName}`);

  const photoUri = photoByPersonId?.get(p.id);

  return (
    <>
      <Image
        src={photoUri ?? avatarSrc(p.gender)}
        style={styles.avatarImg}
      />
      <Text style={styles.personName}>{p.full_name}</Text>
      {p.is_root && (
        <Text
          style={{
            fontSize: 8,
            color: COLORS.accent,
            marginBottom: 2,
            textAlign: "center",
          }}
        >
          Thuỷ tổ
        </Text>
      )}
      <Text style={styles.personMeta}>{metaParts.join(" · ")}</Text>

      <View style={styles.cardBody}>
        <FieldLine label="Sinh" value={birthSolar || null} />
        {birthLunar ? <FieldLine label="Sinh ÂL" value={birthLunar} /> : null}
        {!p.is_living && (
          <>
            <FieldLine label="Mất" value={deathSolar || null} />
            <FieldLine label="Giỗ" value={gioRow || null} />
            {showDeathDetails && thoYears != null ? (
              <FieldLine
                label={lifespanLabel(thoYears)}
                value={`${thoYears} tuổi`}
              />
            ) : null}
          </>
        )}
        <FieldLine label="Cha" value={father?.full_name ?? null} />
        <FieldLine label="Mẹ" value={mother?.full_name ?? null} />
        <FieldLine
          label={p.gender === "M" ? "Vợ" : "Chồng"}
          value={
            spouses.length > 0
              ? spouses.map((s) => s.full_name).join(", ")
              : null
          }
        />
        <FieldLine
          label="Con"
          value={
            children.length > 0
              ? children.map((c) => c.full_name).join(", ")
              : null
          }
        />
      </View>
    </>
  );
}


// ─── In-law card (matches bloodline card layout) ──────────────────

function renderInLawCard(
  p: PersonDetail,
  spousesByPerson: Map<string, string[]>,
  personById: Map<string, PersonDetail>,
  photoByPersonId?: Map<string, string>,
): React.ReactNode {
  const ls = lifespanText(p);
  const spouseList = (spousesByPerson.get(p.id) ?? [])
    .map((id) => personById.get(id))
    .filter((s): s is PersonDetail => !!s);

  const metaParts: string[] = [p.gender === "M" ? "Nam" : "Nữ"];
  if (ls) metaParts.push(ls);
  if (!p.is_living) metaParts.push("đã mất");

  const photoUri = photoByPersonId?.get(p.id);

  return (
    <>
      <Image
        src={photoUri ?? avatarSrc(p.gender)}
        style={styles.avatarImg}
      />
      <Text style={styles.personName}>{p.full_name}</Text>
      <Text style={styles.personMeta}>{metaParts.join(" · ")}</Text>

      <View style={styles.cardBody}>
        <FieldLine
          label="Vợ/chồng của"
          value={
            spouseList.length > 0
              ? spouseList.map((s) => s.full_name).join(", ")
              : null
          }
        />
        <FieldLine label="Nơi sinh" value={p.birth_place} />
        <FieldLine label="Nơi an táng" value={p.burial_place} />
        <FieldLine label="Tiểu sử" value={p.bio} />
      </View>
    </>
  );
}

// ─── Tree diagram (A4 landscape SVG) ───────────────────────────────

interface TreeNode {
  person: PersonDetail;
  x: number; // grid coords; normalized later
  y: number;
  children: TreeNode[];
}

interface TreeEdge {
  parent: TreeNode;
  child: TreeNode;
}

function buildTreeLayout(
  roots: PersonDetail[],
  childrenByParent: Map<string, string[]>,
  personById: Map<string, PersonDetail>,
  /** Restrict the traversal to this set if provided. */
  memberFilter?: Set<string>,
): { nodes: TreeNode[]; edges: TreeEdge[]; leafCount: number; maxDepth: number } {
  let leafCounter = 0;
  const nodes: TreeNode[] = [];
  const edges: TreeEdge[] = [];

  function visit(p: PersonDetail, depth: number): TreeNode {
    const childIds = (childrenByParent.get(p.id) ?? [])
      .map((id) => personById.get(id))
      .filter((c): c is PersonDetail => !!c && c.generation !== null)
      .filter((c) => !memberFilter || memberFilter.has(c.id));
    childIds.sort(birthOrder);

    let node: TreeNode;
    if (childIds.length === 0) {
      const x = leafCounter++;
      node = { person: p, x, y: depth, children: [] };
    } else {
      const childNodes = childIds.map((c) => visit(c, depth + 1));
      const x =
        (childNodes[0].x + childNodes[childNodes.length - 1].x) / 2;
      node = { person: p, x, y: depth, children: childNodes };
      for (const c of childNodes) {
        edges.push({ parent: node, child: c });
      }
    }
    nodes.push(node);
    return node;
  }

  for (const r of roots) visit(r, 0);

  const maxDepth = nodes.reduce((m, n) => Math.max(m, n.y), 0);
  return { nodes, edges, leafCount: Math.max(leafCounter, 1), maxDepth };
}

/** Soft cap before we split the diagram into multiple pages.
 *  At 12 leaves, each lane is ~60pt → cards 56pt with a 4pt gap; 4-char
 *  Vietnamese names ("Ngô Văn A") fit comfortably at 7pt. */
const MAX_LEAVES_PER_PAGE = 12;

function countLeaves(
  roots: PersonDetail[],
  childrenByParent: Map<string, string[]>,
  personById: Map<string, PersonDetail>,
  memberFilter?: Set<string>,
): number {
  let n = 0;
  const walk = (p: PersonDetail) => {
    const kids = (childrenByParent.get(p.id) ?? [])
      .map((id) => personById.get(id))
      .filter((c): c is PersonDetail => !!c && c.generation !== null)
      .filter((c) => !memberFilter || memberFilter.has(c.id));
    if (kids.length === 0) n++;
    else kids.forEach(walk);
  };
  roots.forEach(walk);
  return n || 1;
}

/**
 * Decide how to slice the tree across pages:
 *   - If the clan has ≥ 2 branches, render one page per chi.
 *   - Else if the single tree has too many leaves, render one page
 *     per Đời-2 sub-root (a child of the Thuỷ tổ).
 *   - Else, one page covers the whole tree.
 */
function renderTreePages({
  bloodline,
  roots,
  branches,
  childrenByParent,
  personById,
  showDeathDetails = false,
  showLivingFullDob = false,
}: {
  bloodline: PersonDetail[];
  roots: PersonDetail[];
  branches: { id: string; name: string }[];
  childrenByParent: Map<string, string[]>;
  personById: Map<string, PersonDetail>;
  showDeathDetails?: boolean;
  showLivingFullDob?: boolean;
}): React.ReactNode {
  // ─── Strategy A: one page per chi ───────────────────────────
  const byBranch = new Map<string, PersonDetail[]>();
  for (const p of bloodline) {
    if (!p.branch_id) continue;
    const arr = byBranch.get(p.branch_id) ?? [];
    arr.push(p);
    byBranch.set(p.branch_id, arr);
  }
  if (byBranch.size >= 2) {
    return branches
      .filter((b) => (byBranch.get(b.id)?.length ?? 0) > 0)
      .map((b) => {
        const members = byBranch.get(b.id)!;
        const memberSet = new Set(members.map((m) => m.id));
        // Roots of this branch: members whose father/mother isn't in
        // the same branch (the chi's founder).
        const branchRoots = members
          .filter((p) => {
            const famId = p.id; // we don't have father refs handy here
            void famId;
            // approximate: smallest generation in branch is the root
            return true;
          })
          .sort((a, b2) => (a.generation ?? 999) - (b2.generation ?? 999));
        const minGen = branchRoots[0]?.generation ?? null;
        const realRoots = members.filter((p) => p.generation === minGen);
        return (
          <TreeDiagramPage
            key={b.id}
            title={`Chi ${b.name}`}
            roots={realRoots}
            childrenByParent={childrenByParent}
            personById={personById}
            memberFilter={memberSet}
            showDeathDetails={showDeathDetails}
            showLivingFullDob={showLivingFullDob}
          />
        );
      });
  }

  // ─── Strategy B: single tree, check size ─────────────────────
  const totalLeaves = countLeaves(roots, childrenByParent, personById);
  if (totalLeaves <= MAX_LEAVES_PER_PAGE) {
    return (
      <TreeDiagramPage
        title="Sơ đồ cây gia phả"
        roots={roots}
        childrenByParent={childrenByParent}
        personById={personById}
        showDeathDetails={showDeathDetails}
        showLivingFullDob={showLivingFullDob}
      />
    );
  }

  // ─── Strategy C: recursively split by sub-roots ──────────────
  // Walk down the tree; for each node, if its subtree fits the leaf
  // budget, render one page. Otherwise descend to its children and
  // recurse. The Thuỷ tổ itself is skipped from page generation
  // (we go straight to its children) because it's listed at the top
  // of every chi/sub-root subtree anyway.
  const pages: React.ReactNode[] = [];
  const seedNodes = roots.flatMap((r) =>
    (childrenByParent.get(r.id) ?? [])
      .map((id) => personById.get(id))
      .filter((c): c is PersonDetail => !!c && c.generation !== null),
  );

  function descendantsOf(p: PersonDetail): Set<string> {
    const universe = new Set<string>([p.id]);
    const queue = [p.id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const c of childrenByParent.get(cur) ?? []) {
        if (!universe.has(c)) {
          universe.add(c);
          queue.push(c);
        }
      }
    }
    return universe;
  }

  function emit(p: PersonDetail) {
    const leaves = countLeaves([p], childrenByParent, personById);
    if (leaves <= MAX_LEAVES_PER_PAGE) {
      const universe = descendantsOf(p);
      pages.push(
        <TreeDiagramPage
          key={p.id}
          title={`Phả hệ từ ${p.full_name}`}
          subtitle={`Một nhánh của họ — ${universe.size} người`}
          roots={[p]}
          childrenByParent={childrenByParent}
          personById={personById}
          memberFilter={universe}
          showDeathDetails={showDeathDetails}
          showLivingFullDob={showLivingFullDob}
        />,
      );
      return;
    }
    // Too big — descend to children.
    const children = (childrenByParent.get(p.id) ?? [])
      .map((id) => personById.get(id))
      .filter((c): c is PersonDetail => !!c && c.generation !== null);
    if (children.length === 0) {
      // Leaf with > MAX_LEAVES_PER_PAGE shouldn't happen (leaf = 1
      // descendant). Emit anyway as a fallback.
      const universe = descendantsOf(p);
      pages.push(
        <TreeDiagramPage
          key={p.id}
          title={`Phả hệ từ ${p.full_name}`}
          subtitle={`Một nhánh của họ — ${universe.size} người`}
          roots={[p]}
          childrenByParent={childrenByParent}
          personById={personById}
          memberFilter={universe}
          showDeathDetails={showDeathDetails}
          showLivingFullDob={showLivingFullDob}
        />,
      );
      return;
    }
    for (const c of children) emit(c);
  }

  // Trang MỞ ĐẦU: luôn bắt đầu từ Thuỷ tổ. Sơ đồ đầy đủ quá rộng cho
  // một trang nên trang này chỉ vẽ Thuỷ tổ + các đời kế tiếp vừa đủ bề
  // ngang; chi tiết từng nhánh nằm ở các trang sau. Bao giờ cũng gồm
  // đời con (đời 2) để Thuỷ tổ không đứng trơ một mình.
  const overview = new Set<string>(roots.map((r) => r.id));
  let frontier = roots;
  let firstGen = true;
  while (true) {
    const next = frontier.flatMap((p) =>
      (childrenByParent.get(p.id) ?? [])
        .map((id) => personById.get(id))
        .filter((c): c is PersonDetail => !!c && c.generation !== null),
    );
    if (next.length === 0) break;
    if (!firstGen && next.length > MAX_LEAVES_PER_PAGE) break;
    next.forEach((c) => overview.add(c.id));
    frontier = next;
    firstGen = false;
  }
  if (overview.size > roots.length) {
    const founders = roots.filter((r) => r.is_root);
    const founderNames = (founders.length ? founders : roots)
      .map((r) => r.full_name)
      .join(", ");
    pages.push(
      <TreeDiagramPage
        key="overview"
        title="Sơ đồ cây gia phả"
        subtitle={`Bắt đầu từ Thuỷ tổ ${founderNames}`}
        roots={roots}
        childrenByParent={childrenByParent}
        personById={personById}
        memberFilter={overview}
        showDeathDetails={showDeathDetails}
        showLivingFullDob={showLivingFullDob}
      />,
    );
  }

  for (const seed of seedNodes) emit(seed);
  return pages;
}

function TreeDiagramPage({
  title = "Sơ đồ cây gia phả",
  subtitle,
  roots,
  childrenByParent,
  personById,
  memberFilter,
  showDeathDetails = false,
  showLivingFullDob = false,
}: {
  title?: string;
  subtitle?: string;
  roots: PersonDetail[];
  childrenByParent: Map<string, string[]>;
  personById: Map<string, PersonDetail>;
  memberFilter?: Set<string>;
  showDeathDetails?: boolean;
  showLivingFullDob?: boolean;
}): React.ReactNode {
  const { nodes, edges, leafCount, maxDepth } = buildTreeLayout(
    roots,
    childrenByParent,
    personById,
    memberFilter,
  );

  // A4 landscape: 842 × 595 pt. The Page applies its own padding via
  // styles.page (top 60 / bottom 68 / sides 56). The SVG sits in flex
  // flow under the title block, so we keep it just shy of the
  // remaining height so it doesn't bump to a new page.
  const PAGE_W_LS = 842;
  const PAGE_H_LS = 595;
  const SVG_W = PAGE_W_LS - 56 * 2; // 730
  const SVG_H = 360; // leaves ~107pt for h1 + underline + intro

  // Top/bottom inset for cards. Sides are handled by the lane scheme
  // below so edge cards always sit fully inside the SVG.
  const TOP_INSET = 20;
  const BOTTOM_INSET = 12;
  const SAFETY = 8;
  const H = SVG_H - TOP_INSET - BOTTOM_INSET;

  // Lane scheme: divide the SVG width into N equal "lanes" (one per
  // leaf) and centre each leaf at its lane midpoint. This keeps the
  // outermost cards comfortably inside the SVG bounds instead of
  // hanging off the edge.
  const lane = leafCount > 0 ? (SVG_W - SAFETY * 2) / leafCount : SVG_W;
  const CARD_W = Math.max(48, Math.min(80, lane - 6));
  // Người đã mất cần thêm dòng thọ + dòng giỗ riêng → thẻ cao hơn (vẫn
  // nằm gọn trong khoảng cách hàng ROW ≥ 56pt nên không đè lên nhau).
  const CARD_H = showDeathDetails ? 28 : 24;
  const ROW = Math.max(56, Math.min(110, H / Math.max(maxDepth + 1, 2)));

  const pxOf = (gridX: number) =>
    leafCount === 1 ? SVG_W / 2 : SAFETY + lane * (gridX + 0.5);
  const pyOf = (gridY: number) => TOP_INSET + gridY * ROW + CARD_H / 2;

  const nameFontSize = CARD_W < 56 ? 6.5 : CARD_W < 70 ? 7 : 7.5;
  const yearFontSize = nameFontSize - 1.5;
  // Truncate to fit width: each glyph ≈ fontSize × 0.55 wide.
  const maxChars = Math.max(6, Math.floor(CARD_W / (nameFontSize * 0.55)));
  const truncate = (s: string) =>
    s.length > maxChars ? s.slice(0, maxChars - 1) + "…" : s;
  // Dòng phụ (năm / thọ / giỗ) dùng cỡ chữ nhỏ hơn → vừa được nhiều
  // ký tự hơn trên cùng bề rộng thẻ.
  const maxCharsMeta = Math.max(8, Math.floor(CARD_W / (yearFontSize * 0.5)));
  const truncateMeta = (s: string) =>
    s.length > maxCharsMeta ? s.slice(0, maxCharsMeta - 1) + "…" : s;

  return (
    <Page size="A4" orientation="landscape" style={styles.page}>
      <VineBorder width={PAGE_W_LS} height={PAGE_H_LS} />
      <Text style={styles.h1}>{title}</Text>
      <View style={styles.h1Underline} />
      <Text style={styles.intro}>
        {subtitle ??
          "Mỗi ô là một thành viên trong huyết thống. Đường nối thể hiện quan hệ cha-con. Đời 1 (Thuỷ tổ) ở đầu sơ đồ, các đời sau xuôi xuống dưới."}
      </Text>
      <Svg
        width={SVG_W}
        height={SVG_H}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      >
        {/* Orthogonal connectors: parent → horizontal bus → child */}
        {edges.map((e, i) => {
          const px = pxOf(e.parent.x);
          const py = pyOf(e.parent.y) + CARD_H / 2;
          const cx = pxOf(e.child.x);
          const cy = pyOf(e.child.y) - CARD_H / 2;
          const midY = (py + cy) / 2;
          return (
            <Path
              key={i}
              d={`M ${px} ${py} V ${midY} H ${cx} V ${cy}`}
              stroke={COLORS.divider}
              strokeWidth={0.7}
              fill="none"
            />
          );
        })}
        {/* Cards */}
        {nodes.map((n) => {
          const cx = pxOf(n.x);
          const cy = pyOf(n.y);
          const x = cx - CARD_W / 2;
          const y = cy - CARD_H / 2;
          const fill = n.person.gender === "M" ? "#D4DDE4" : "#E8D2CC";
          const person = n.person;
          // Các dòng phụ dưới tên, mỗi thông tin một dòng riêng để không
          // bị cắt mất chữ: [năm sinh-mất] / [thọ|hưởng dương] / [giỗ].
          const metaLines: string[] = [];
          // Dòng năm: người sống + bật "ngày sinh đủ" → ngày sinh đầy đủ;
          // còn lại "YYYY-YYYY".
          let yearLine = lifespanText(person);
          if (showLivingFullDob && person.is_living) {
            const full = formatPartialDate({
              date: person.birth_date,
              precision: person.birth_date_precision ?? null,
            });
            if (full) yearLine = full;
          }
          if (yearLine) metaLines.push(truncateMeta(yearLine));
          if (showDeathDetails && !person.is_living) {
            const tho = computeLifespanYears(
              person.lifespan_years,
              person.birth_date,
              person.death_date,
            );
            if (tho != null)
              metaLines.push(
                truncateMeta(
                  `${tho >= THO_MIN_AGE ? "thọ" : "hưởng dương"} ${tho} tuổi`,
                ),
              );
            if (person.death_anniv_lunar_month && person.death_anniv_lunar_day)
              metaLines.push(
                truncateMeta(
                  `giỗ ${person.death_anniv_lunar_day}/${person.death_anniv_lunar_month} ÂL`,
                ),
              );
          }
          return (
            <G key={n.person.id}>
              <Rect
                x={x}
                y={y}
                width={CARD_W}
                height={CARD_H}
                rx={3}
                ry={3}
                fill={fill}
                stroke={COLORS.primary}
                strokeWidth={0.5}
              />
              <Text
                x={cx}
                y={y + (metaLines.length ? 8 : 14)}
                style={{
                  fontFamily: PDF_FONT_FAMILY,
                  fontSize: nameFontSize,
                  fontWeight: 600,
                  fill: COLORS.ink,
                  textAnchor: "middle",
                }}
              >
                {truncate(n.person.full_name)}
              </Text>
              {metaLines.map((line, li) => (
                <Text
                  key={li}
                  x={cx}
                  y={y + 15 + li * 7}
                  style={{
                    fontFamily: PDF_FONT_FAMILY,
                    fontSize: yearFontSize,
                    fill: COLORS.muted,
                    textAnchor: "middle",
                  }}
                >
                  {line}
                </Text>
              ))}
            </G>
          );
        })}
      </Svg>
    </Page>
  );
}

// ─── Shared sub-components & helpers ───────────────────────────────

function FieldLine({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <Text style={styles.field}>
      {label}: {value}
    </Text>
  );
}


function lifespanText(p: PersonDetail): string {
  const b = p.birth_date?.slice(0, 4);
  const d = p.death_date?.slice(0, 4);
  if (b && d) return `${b}-${d}`;
  if (b && p.is_living) return `sinh ${b}`;
  if (b && !p.is_living) return `${b}-`;
  if (d && !p.is_living) return `-${d}`;
  return "";
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function pushTo<K, V>(m: Map<K, V[]>, key: K, value: V) {
  const arr = m.get(key);
  if (arr) arr.push(value);
  else m.set(key, [value]);
}

function stripParenthetical(s: string): string {
  return s.replace(/\s*\([^)]*\)\s*$/, "").trim() || s;
}

/** Add "Họ " prefix unless the clan name already starts with "Họ". */
function withHoPrefix(s: string): string {
  return /^h[ọo]\s/i.test(s) ? s : `Họ ${s}`;
}

function looksLikeDebug(s: string): boolean {
  return /\b(demo|test|fixture|seed|sample)\b/i.test(s);
}

function birthOrder(a: PersonDetail, b: PersonDetail): number {
  // Ưu tiên "con thứ mấy" (birth_order) như cây & hồ sơ; rồi tới ngày
  // sinh; cuối cùng theo tên. Khớp familyChartAdapter để sổ và cây có
  // cùng thứ tự anh chị em.
  const oa = a.birth_order ?? null;
  const ob = b.birth_order ?? null;
  if (oa !== null && ob !== null && oa !== ob) return oa - ob;
  if (oa !== null && ob === null) return -1;
  if (oa === null && ob !== null) return 1;
  const ay = a.birth_date ?? "";
  const by = b.birth_date ?? "";
  if (ay && by) return ay.localeCompare(by);
  if (ay) return -1;
  if (by) return 1;
  return a.full_name.localeCompare(b.full_name, "vi");
}

function avatarSrc(g: "M" | "F"): string {
  return g === "M" ? "/avatars/male.png" : "/avatars/female.png";
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function compareStt(a: string, b: string): number {
  const aa = a.split(".").map(Number);
  const bb = b.split(".").map(Number);
  for (let i = 0; i < Math.min(aa.length, bb.length); i++) {
    if (aa[i] !== bb[i]) return aa[i] - bb[i];
  }
  return aa.length - bb.length;
}
