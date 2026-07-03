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
import { displayGenLabel } from "@/lib/displayGeneration";
import { formatPartialDate } from "@/lib/partialDate";
import { computeLifespanYears, lifespanLabel } from "@/lib/lifespan";
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
  // Thẻ Mộ phần / Di sản — như card người nhưng chữ canh trái + ảnh chữ nhật.
  mediaCard: {
    width: 152,
    marginRight: 6,
    padding: 8,
    borderWidth: 0.5,
    borderColor: COLORS.divider,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  mediaImg: { width: "100%", height: 82, borderRadius: 3, marginBottom: 5 },
  mediaTitle: { fontSize: 10, fontWeight: 700, color: COLORS.primary, marginBottom: 1 },
  mediaMeta: { fontSize: 8, color: COLORS.muted, marginBottom: 3 },
  mediaSummary: { fontSize: 8.5, fontWeight: 700, marginBottom: 2 },
  mediaText: { fontSize: 8.5, marginBottom: 2 },
  mediaSubhead: {
    fontSize: 12,
    fontWeight: 700,
    color: COLORS.primary,
    marginTop: 8,
    marginBottom: 5,
  },
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
  include?: {
    tree?: boolean;
    detail?: boolean;
    restingPlaces?: boolean;
    heritage?: boolean;
    /** Số "lá" tối đa mỗi trang sơ đồ (mật độ do user chọn). */
    treePerPage?: number;
  };
  /**
   * Optional personId → JPEG data URI map for embedding real avatar
   * photos. Persons not in the map fall back to the gendered
   * illustration. The caller pre-fetches these in exportClanBook so
   * the PDF render stays synchronous.
   */
  photoByPersonId?: Map<string, string>;
  /** id mục Mộ phần / Di sản → ảnh bìa data URI (cho thẻ). */
  coverByItemId?: Map<string, string>;
  /** QR (data URI) trỏ tới trang gia phả công khai — in ở trang bìa. */
  coverQrDataUri?: string;
}

export function ClanBookPdf({ clan, data, include, photoByPersonId, coverByItemId, coverQrDataUri }: Props) {
  ensurePdfFontRegistered();

  const showTree = include?.tree ?? true;
  const showDetail = include?.detail ?? true;
  const showRestingPlaces = include?.restingPlaces ?? true;
  const showHeritage = include?.heritage ?? true;

  const HERITAGE_CAT_LABEL: Record<string, string> = {
    place: "Từ đường / đền / chùa",
    custom: "Tục lệ / gia phong",
    story: "Giai thoại / công trạng",
    artifact: "Tư liệu / kỷ vật",
  };

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

  // Huyết thống vs dâu/rể phải phân theo DÒNG MÁU, KHÔNG theo generation:
  // recompute_generation cố ý "lan đời sang vợ/chồng" nên dâu/rể cũng có
  // generation (= đời của người bạn đời). Vì vậy generation != null KHÔNG
  // đồng nghĩa huyết thống. Dòng máu = Thuỷ tổ, hoặc sinh ra trong họ (có
  // mặt trong childToFamily).
  const isLineage = (pid: string): boolean =>
    personById.get(pid)?.is_root === true || data.childToFamily[pid] != null;
  const bloodline = persons.filter((p) => isLineage(p.id));
  const inLaws = persons.filter((p) => !isLineage(p.id));

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
    // Cha/mẹ sinh học — ghi cả hai để hiển thị "Cha" / "Mẹ".
    if (fam.husband_id) fatherOf.set(childId, fam.husband_id);
    if (fam.wife_id) motherOf.set(childId, fam.wife_id);
    // Sơ đồ + đánh số d'Aboville + danh sách "Con": chỉ gắn con vào
    // MỘT cha/mẹ thuộc dòng máu (ưu tiên cha) để tránh nhân đôi cả
    // nhánh khi người hôn phối lỡ bị gán đời. Người cưới vào không
    // hiện như một gốc song song nữa.
    const h = fam.husband_id;
    const w = fam.wife_id;
    const parent =
      h && isLineage(h) ? h : w && isLineage(w) ? w : (h ?? w ?? null);
    if (parent) pushTo(childrenByParent, parent, childId);
  }

  // Sắp con theo thứ tự anh chị em (con thứ mấy → ngày sinh → tên) MỘT
  // lần, để mọi nơi đọc childrenByParent (sơ đồ cây, phân trang nhánh,
  // đánh số, danh sách Con) đều cùng thứ tự — con cả luôn đứng đầu.
  for (const arr of childrenByParent.values()) {
    arr.sort((a, b) => {
      const pa = personById.get(a);
      const pb = personById.get(b);
      if (!pa || !pb) return 0;
      return birthOrder(pa, pb);
    });
  }

  // d'Aboville numbering — DFS from roots.
  const sttById = new Map<string, string>();
  const orderInSiblings = new Map<string, number>();
  const minGen = bloodline.reduce(
    (m, p) => Math.min(m, p.generation ?? Infinity),
    Infinity,
  );
  // Gốc cây = Thuỷ tổ (is_root). Chỉ khi không ai được đánh dấu mới
  // tạm lấy theo đời nhỏ nhất — tránh kéo cả vợ/chồng đời 1 thành gốc.
  const explicitRoots = bloodline.filter((p) => p.is_root);
  const roots = (
    explicitRoots.length > 0
      ? explicitRoots
      : bloodline.filter((p) => p.generation === minGen)
  ).sort(birthOrder);

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

  // Gốc cho SƠ ĐỒ CÂY = Thuỷ tổ + mọi người huyết thống không tới được từ
  // Thuỷ tổ (mồ côi liên kết) làm gốc phụ → không sót ai trên sơ đồ (khớp
  // với danh bạ). Đây là lỗi "xuất thiếu thành viên" trước đây.
  const treeCovered = new Set<string>();
  const treeRoots: PersonDetail[] = [];
  const addSubtree = (id: string) => {
    const q = [id];
    while (q.length > 0) {
      const cur = q.shift()!;
      if (treeCovered.has(cur)) continue;
      treeCovered.add(cur);
      for (const cid of childrenByParent.get(cur) ?? []) {
        const c = personById.get(cid);
        if (c && c.generation !== null && !treeCovered.has(cid)) q.push(cid);
      }
    }
  };
  for (const r of roots) {
    if (treeCovered.has(r.id)) continue;
    treeRoots.push(r);
    addSubtree(r.id);
  }
  for (const p of bloodlineSorted) {
    if (treeCovered.has(p.id)) continue;
    treeRoots.push(p);
    addSubtree(p.id);
  }

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
      author="Dòng Họ Việt"
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
          {coverQrDataUri ? (
            <View style={{ alignItems: "center", marginTop: 18 }}>
              <Image src={coverQrDataUri} style={{ width: 94, height: 94 }} />
              <Text style={{ fontSize: 9, color: COLORS.muted, marginTop: 4 }}>
                Quét để xem gia phả online
              </Text>
            </View>
          ) : null}
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
          - Cuốn sách gồm các phần: Phả đồ (sơ đồ cây), Danh bạ chi tiết
          {" "}từng người, Dâu/rể, Mộ phần &amp; tro cốt, và Di sản &amp; Văn
          {" "}hoá (từ đường, tục lệ, giai thoại, tư liệu của dòng họ).
        </Text>
        <Text style={styles.prefaceItem}>
          - Mỗi người trong huyết thống ghi kèm "Đời N" — số đời tính từ
          {" "}Thuỷ tổ. (Tuỳ cấu hình dòng họ, Thuỷ tổ được tính là Đời 1
          {" "}hoặc Đời 0; các đời sau cộng dần.)
        </Text>
        <Text style={styles.prefaceItem}>
          - Danh bạ bắt đầu từ Thuỷ tổ, lần lượt theo từng đời; trong mỗi
          {" "}đời xếp theo thứ tự anh - chị - em (con trưởng trước). Người
          {" "}ngoài huyết thống (dâu/rể) liệt kê ở mục riêng cuối sách.
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
          - Phần Mộ phần &amp; Di sản trình bày dạng thẻ (mỗi mục một thẻ,
          {" "}có ảnh kèm theo nếu có); Di sản được gom theo nhóm: từ đường,
          {" "}tục lệ, giai thoại, tư liệu.
        </Text>
        <Text style={styles.prefaceItem}>
          - Trường để trống nghĩa là chưa có thông tin - chứ không
          {" "}phải là không tồn tại.
        </Text>
      </Page>

      {/* ─── Cây phả hệ (SVG diagram, paginated) ─────────────── */}
      {showTree && bloodline.length > 0 &&
        renderTreePages({
          roots: treeRoots,
          childrenByParent,
          personById,
          spousesByPerson,
          genOffset: clan.generation_offset ?? 0,
          budget: include?.treePerPage,
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

      {/* ─── Mộ phần & tro cốt (lưới thẻ) ───────────────────── */}
      {showRestingPlaces && data.restingPlaces.length > 0 && (
        <Page size="A4" style={styles.page}>
          <VineBorder />
          <Text style={styles.h1}>Mộ phần &amp; tro cốt</Text>
          <View style={styles.h1Underline} />
          <Text style={styles.intro}>
            Nơi an nghỉ của các cụ: mộ phần, tro cốt gửi chùa / tháp họ.
          </Text>
          {chunk(data.restingPlaces, 3).map((row, i) => (
            <View key={i} style={styles.cardRow} wrap={false}>
              {row.map((rp, ci) => {
                const cover = coverByItemId?.get(rp.id);
                const loc = [rp.location_name, rp.location_detail].filter(Boolean).join(" · ");
                return (
                  <View key={rp.id} style={ci === row.length - 1 ? [styles.mediaCard, styles.cardLast] : styles.mediaCard}>
                    {cover ? <Image src={cover} style={styles.mediaImg} /> : null}
                    <Text style={styles.mediaTitle}>
                      {rp.name || rp.location_name || RP_KIND_LABEL[rp.kind]}
                    </Text>
                    <Text style={styles.mediaMeta}>
                      {RP_KIND_LABEL[rp.kind]}
                      {rp.status !== "existing" ? ` · ${RP_STATUS_LABEL[rp.status]}` : ""}
                    </Text>
                    {loc ? <Text style={styles.mediaText}>{loc}</Text> : null}
                    {rp.address ? <Text style={styles.mediaText}>{rp.address}</Text> : null}
                    {rp.occupant_names.length > 0 ? (
                      <Text style={styles.mediaMeta}>An nghỉ: {rp.occupant_names.join(", ")}</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
        </Page>
      )}

      {/* ─── Di sản & Văn hoá (nhóm theo loại + lưới thẻ) ────── */}
      {showHeritage && data.heritage.length > 0 && (
        <Page size="A4" style={styles.page}>
          <VineBorder />
          <Text style={styles.h1}>Di sản &amp; Văn hoá</Text>
          <View style={styles.h1Underline} />
          <Text style={styles.intro}>
            Từ đường, tục lệ, giai thoại, tư liệu — những giá trị tinh thần
            của dòng họ.
          </Text>
          {(["place", "custom", "story", "artifact"] as const).map((cat) => {
            const items = data.heritage.filter((h) => h.category === cat);
            if (items.length === 0) return null;
            return (
              <View key={cat}>
                <Text style={styles.mediaSubhead}>{HERITAGE_CAT_LABEL[cat]}</Text>
                {chunk(items, 3).map((row, i) => (
                  <View key={i} style={styles.cardRow} wrap={false}>
                    {row.map((h, ci) => {
                      const cover = coverByItemId?.get(h.id);
                      const meta = [h.location_name || null, h.built_year ? `năm ${h.built_year}` : null]
                        .filter(Boolean)
                        .join(" · ");
                      const body = h.body && h.body.length > 150 ? `${h.body.slice(0, 150)}…` : h.body;
                      return (
                        <View key={h.id} style={ci === row.length - 1 ? [styles.mediaCard, styles.cardLast] : styles.mediaCard}>
                          {cover ? <Image src={cover} style={styles.mediaImg} /> : null}
                          <Text style={styles.mediaTitle}>{h.title}</Text>
                          {meta ? <Text style={styles.mediaMeta}>{meta}</Text> : null}
                          {h.summary ? <Text style={styles.mediaSummary}>{h.summary}</Text> : null}
                          {body ? <Text style={styles.mediaText}>{body}</Text> : null}
                          {h.people_names.length > 0 ? (
                            <Text style={styles.mediaMeta}>Liên quan: {h.people_names.join(", ")}</Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ))}
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

/** Tách tên thành các âm tiết (mỗi âm tiết một dòng khi vẽ dọc). */
function nameSyllables(name: string): string[] {
  const s = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return s.length ? s : [(name ?? "").trim() || "?"];
}

/** Số lá tối đa mỗi trang phả đồ. Ô dọc hẹp + viewBox tự co nên chứa
 *  được nhiều hơn kiểu ô ngang cũ. */
const TREE_LEAF_BUDGET = 24;

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
 * Chia sơ đồ ra nhiều trang mà KHÔNG cắt đôi một nhánh:
 *   - Cả cây vừa 1 trang → 1 trang.
 *   - Không thì: 1 trang tổng quan (Thuỷ tổ + vài đời), rồi mỗi trang là
 *     một hoặc vài nhánh-con TRỌN VẸN (gói theo số lá); nhánh nào quá lớn
 *     thì đệ quy tách sâu hơn nhưng vẫn giữ mỗi nhánh nguyên vẹn.
 * Tiêu đề trang nhánh kèm "Đời N" của gốc nhánh.
 */
function renderTreePages({
  roots,
  childrenByParent,
  personById,
  spousesByPerson,
  genOffset,
  budget: budgetOpt,
  showLivingFullDob = false,
}: {
  roots: PersonDetail[];
  childrenByParent: Map<string, string[]>;
  personById: Map<string, PersonDetail>;
  spousesByPerson: Map<string, string[]>;
  genOffset: number;
  budget?: number;
  showLivingFullDob?: boolean;
}): React.ReactNode {
  const budget =
    budgetOpt && budgetOpt >= 4 ? Math.floor(budgetOpt) : TREE_LEAF_BUDGET;
  const kidsOf = (id: string): PersonDetail[] =>
    (childrenByParent.get(id) ?? [])
      .map((cid) => personById.get(cid))
      .filter((c): c is PersonDetail => !!c && c.generation !== null);

  const descendantsOf = (id: string): Set<string> => {
    const set = new Set<string>([id]);
    const q = [id];
    while (q.length > 0) {
      const cur = q.shift()!;
      for (const k of kidsOf(cur)) {
        if (!set.has(k.id)) {
          set.add(k.id);
          q.push(k.id);
        }
      }
    }
    return set;
  };

  const pages: React.ReactNode[] = [];
  const mkPage = (
    key: string,
    rootsArg: PersonDetail[],
    mf: Set<string> | undefined,
    title: string,
    subtitle?: string,
  ) =>
    pages.push(
      <TreeDiagramPage
        key={key}
        title={title}
        subtitle={subtitle}
        roots={rootsArg}
        childrenByParent={childrenByParent}
        personById={personById}
        spousesByPerson={spousesByPerson}
        memberFilter={mf}
        showLivingFullDob={showLivingFullDob}
      />,
    );

  const genOf = (p: PersonDetail) => displayGenLabel(p.generation, genOffset);

  // ─── Chia trang theo CHIỀU SÂU ─────────────────────────────────────
  // Cây dòng dõi dài (ít nhánh nhưng nhiều đời) nếu để một trang sẽ bị co
  // rất nhỏ + thừa hai bên. Giới hạn số đời mỗi trang; đời sâu hơn tách
  // sang trang tiếp, gốc mỗi trang là người ở ranh giới (lặp lại làm mốc).
  const MAX_GEN_PER_PAGE = 6;

  const kidsIn = (id: string, mf?: Set<string>): PersonDetail[] =>
    kidsOf(id).filter((c) => !mf || mf.has(c.id));

  function subtreeDepth(rootsArg: PersonDetail[], mf?: Set<string>): number {
    let max = 1;
    const walk = (p: PersonDetail, d: number) => {
      if (d > max) max = d;
      for (const c of kidsIn(p.id, mf)) walk(c, d + 1);
    };
    for (const r of rootsArg) walk(r, 1);
    return max;
  }

  // Tập node trong <= maxGen đời từ rootsArg (theo mf); frontier = node ở
  // đời cuối cùng còn con sâu hơn (để mở trang tiếp).
  function depthSlice(
    rootsArg: PersonDetail[],
    mf: Set<string> | undefined,
    maxGen: number,
  ): { set: Set<string>; frontier: PersonDetail[] } {
    const set = new Set<string>();
    const frontier: PersonDetail[] = [];
    const walk = (p: PersonDetail, depth: number) => {
      set.add(p.id);
      const kids = kidsIn(p.id, mf);
      if (depth + 1 >= maxGen) {
        if (kids.length > 0) frontier.push(p);
        return;
      }
      for (const c of kids) walk(c, depth + 1);
    };
    for (const r of rootsArg) walk(r, 0);
    return { set, frontier };
  }

  // Emit một cây (đã giới hạn bề ngang) — cắt thêm theo chiều sâu nếu quá
  // nhiều đời.
  function emitTree(
    rootsArg: PersonDetail[],
    mf: Set<string> | undefined,
    title: string,
    subtitle: string | undefined,
    keyPrefix: string,
  ) {
    if (subtreeDepth(rootsArg, mf) <= MAX_GEN_PER_PAGE) {
      mkPage(keyPrefix, rootsArg, mf, title, subtitle);
      return;
    }
    const { set, frontier } = depthSlice(rootsArg, mf, MAX_GEN_PER_PAGE);
    mkPage(
      keyPrefix,
      rootsArg,
      set,
      title,
      subtitle ? `${subtitle} · đời sau ở trang kế` : "Đời sau tiếp ở trang kế",
    );
    frontier.forEach((f, i) => {
      const sub = new Set<string>();
      for (const d of descendantsOf(f.id)) if (!mf || mf.has(d)) sub.add(d);
      emitTree(
        [f],
        sub,
        `Phả hệ từ ${f.full_name} — ${genOf(f)} (tiếp)`,
        undefined,
        `${keyPrefix}d${i}`,
      );
    });
  }

  // Gói các nhánh-con của R vào từng trang (mỗi trang: R + vài nhánh trọn
  // vẹn), nhánh-con quá lớn thì đệ quy — không bao giờ cắt đôi một nhánh.
  function emitBranchesOf(r: PersonDetail, keyPrefix: string) {
    const kids = kidsOf(r.id);
    const groups: PersonDetail[][] = [];
    const big: PersonDetail[] = [];
    let cur: PersonDetail[] = [];
    let curLeaves = 0;
    for (const c of kids) {
      const cl = countLeaves([c], childrenByParent, personById);
      if (cl > budget) {
        if (cur.length) {
          groups.push(cur);
          cur = [];
          curLeaves = 0;
        }
        big.push(c);
      } else if (curLeaves + cl <= budget) {
        cur.push(c);
        curLeaves += cl;
      } else {
        groups.push(cur);
        cur = [c];
        curLeaves = cl;
      }
    }
    if (cur.length) groups.push(cur);

    const label = `Phả hệ từ ${r.full_name} — ${genOf(r)}`;
    if (groups.length === 0 && big.length > 0) {
      // Mọi nhánh con đều lớn → 1 trang tổng quan R + các con (1 đời).
      const mf = new Set<string>([r.id, ...kids.map((k) => k.id)]);
      mkPage(`${keyPrefix}-ov`, [r], mf, label, "Tổng quan các nhánh con");
    } else {
      groups.forEach((g, gi) => {
        const mf = new Set<string>([r.id]);
        for (const c of g) for (const d of descendantsOf(c.id)) mf.add(d);
        const part = groups.length > 1 ? ` (phần ${gi + 1}/${groups.length})` : "";
        emitTree([r], mf, label, `Các nhánh con${part}`, `${keyPrefix}-${gi}`);
      });
    }
    big.forEach((c, bi) => emitBranchesOf(c, `${keyPrefix}b${bi}`));
  }

  // Cả cây vừa một trang.
  const totalLeaves = countLeaves(roots, childrenByParent, personById);
  if (totalLeaves <= budget) {
    emitTree(roots, undefined, "Sơ đồ cây gia phả", undefined, "tree");
    return pages;
  }

  // Trang tổng quan: Thuỷ tổ + các đời kế tiếp — vừa bề ngang VÀ không quá
  // sâu (giới hạn số đời để thẻ không bị co nhỏ).
  const overview = new Set<string>(roots.map((r) => r.id));
  let frontier = roots;
  let ovDepth = 1;
  while (ovDepth < MAX_GEN_PER_PAGE) {
    const next = frontier.flatMap((p) => kidsOf(p.id));
    if (next.length === 0) break;
    if (overview.size + next.length > budget) break;
    next.forEach((c) => overview.add(c.id));
    frontier = next;
    ovDepth += 1;
  }
  if (overview.size > roots.length) {
    const founders = roots.filter((r) => kidsOf(r.id).length > 0);
    const lead = founders[0]?.full_name ?? roots[0]?.full_name ?? "";
    mkPage(
      "overview",
      roots,
      overview,
      "Sơ đồ cây gia phả",
      `Tổng quan từ ${lead}${founders.length > 1 ? " và các chi" : ""} — chi tiết từng nhánh ở các trang sau`,
    );
  }

  // Chi tiết: mỗi gốc → gói các nhánh con trọn vẹn.
  roots.forEach((r, i) => emitBranchesOf(r, `t${i}`));
  return pages;
}

/**
 * Một trang phả đồ. Ô DỌC: tên xếp mỗi âm tiết một dòng + dòng năm; vợ/
 * chồng (dâu/rể) vẽ cạnh (ô nhạt, viền đứt), con nối xuống từ giữa cặp.
 * viewBox tự co cho vừa trang.
 */
function TreeDiagramPage({
  title = "Sơ đồ cây gia phả",
  subtitle,
  roots,
  childrenByParent,
  personById,
  spousesByPerson,
  memberFilter,
  showLivingFullDob = false,
}: {
  title?: string;
  subtitle?: string;
  roots: PersonDetail[];
  childrenByParent: Map<string, string[]>;
  personById: Map<string, PersonDetail>;
  spousesByPerson: Map<string, string[]>;
  memberFilter?: Set<string>;
  showLivingFullDob?: boolean;
}): React.ReactNode {
  const PAGE_W_LS = 842;
  const PAGE_H_LS = 595;
  const SVG_W = PAGE_W_LS - 56 * 2; // 730
  // Chừa đủ chỗ cho tiêu đề + phụ đề (tối đa ~2 dòng) phía trên: cao trang
  // trong lòng ≈ 595-60-68=467, khối tiêu đề ~86 → SVG tối đa ~340 để cả
  // hai NẰM CÙNG MỘT TRANG (nếu cao hơn, react-pdf đẩy SVG sang trang mới
  // → trang tiêu đề bị trống). drawH ≤ SVG_H nên luôn an toàn.
  const SVG_H = 352;

  const kidsOf = (id: string): PersonDetail[] =>
    (childrenByParent.get(id) ?? [])
      .map((cid) => personById.get(cid))
      .filter((c): c is PersonDetail => !!c && c.generation !== null)
      .filter((c) => !memberFilter || memberFilter.has(c.id));

  // Cây huyết thống hiện TRÊN TRANG NÀY = các gốc có con + toàn bộ hậu duệ.
  const connectedRoots = roots.filter((r) => kidsOf(r.id).length > 0);
  const lineagePrimaries = new Set<string>();
  {
    const collect = (id: string) => {
      if (lineagePrimaries.has(id)) return;
      lineagePrimaries.add(id);
      for (const c of kidsOf(id)) collect(c.id);
    };
    for (const r of connectedRoots) collect(r.id);
  }

  // Ô vợ/chồng vẽ cạnh = bạn đời KHÔNG xuất hiện như một node dòng máu trên
  // trang này: dâu/rể cưới vào, HOẶC người trong họ nhưng nhánh cha mẹ ở
  // trang khác (vd lấy người cùng họ — Đặng Thị Tần là vợ Huỳnh Văn Hiếu
  // nhưng có cha mẹ ở nhánh khác). Tối đa 2 ô.
  const spousesToShow = (id: string): PersonDetail[] =>
    (spousesByPerson.get(id) ?? [])
      .map((sid) => personById.get(sid))
      .filter((s): s is PersonDetail => !!s && !lineagePrimaries.has(s.id))
      .slice(0, 2);
  // Ai đã được vẽ như ô vợ/chồng → không cho rơi vào lưới "người rời rạc".
  const shownAsSpouse = new Set<string>();

  // Kích thước ô ĐỒNG NHẤT theo trang: rộng = âm tiết dài nhất, cao = số
  // âm tiết nhiều nhất (+ dòng năm) → mọi ô thẳng hàng.
  const rendered: PersonDetail[] = [];
  {
    const seen = new Set<string>();
    const walk = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      const p = personById.get(id);
      if (!p) return;
      rendered.push(p, ...spousesToShow(id));
      for (const c of kidsOf(id)) walk(c.id);
    };
    for (const r of roots) walk(r.id);
  }
  let maxSyl = 1;
  let maxSylLen = 1;
  for (const p of rendered) {
    const sy = nameSyllables(p.full_name);
    maxSyl = Math.max(maxSyl, sy.length);
    for (const s of sy) maxSylLen = Math.max(maxSylLen, s.length);
  }
  maxSyl = Math.min(maxSyl, 6); // tên quá dài: cắt bớt (… ) ở dòng cuối

  const NAME_FS = 7;
  const YEAR_FS = 5;
  // Giãn dòng giữa các âm tiết cho dễ đọc (thẻ cao thêm chút).
  const LINE_H = NAME_FS + 3.4;
  const PAD_T = 5;
  const PAD_B = 3;
  const CARD_W = Math.round(
    Math.min(34, Math.max(15, maxSylLen * NAME_FS * 0.62 + 5)),
  );
  const CARD_H = Math.round(PAD_T + maxSyl * LINE_H + YEAR_FS + 2 + PAD_B);
  const MARRIAGE_GAP = 6;
  const SIBLING_GAP = 12;
  const ROW_GAP = 26;
  const ROW_PITCH = CARD_H + ROW_GAP;

  type Card = {
    person: PersonDetail;
    cx: number;
    y: number;
    kind: "primary" | "spouse";
    coupleCenterX: number;
    /** Có vợ/chồng vẽ cạnh → con thả từ NÉT HÔN NHÂN (giữa cặp), không
     *  phải từ đáy ô đơn. */
    hasSpouse: boolean;
  };
  const cards: Card[] = [];
  const childLinks: { parent: Card; child: Card }[] = [];
  const marriageLinks: { a: Card; b: Card }[] = [];
  let cursor = 0;

  function place(person: PersonDetail, depth: number): Card {
    const spouses = spousesToShow(person.id);
    const groupCount = 1 + spouses.length;
    const groupWidth = groupCount * CARD_W + (groupCount - 1) * MARRIAGE_GAP;
    const kids = kidsOf(person.id);
    const startIdx = cards.length;
    const childCards: Card[] = [];
    let groupLeft: number;

    if (kids.length === 0) {
      groupLeft = cursor;
      cursor += groupWidth + SIBLING_GAP;
    } else {
      const childStart = cursor;
      for (const k of kids) childCards.push(place(k, depth + 1));
      const childrenWidth = cursor - SIBLING_GAP - childStart;
      // Căn cha giữa các CẶP con (dùng tâm cặp, không phải ô đơn) — nếu dùng
      // cx ô đơn, cha của 1 con-có-vợ/chồng bị đẩy lệch trái (âm → tràn mép).
      const childrenCenter =
        (childCards[0].coupleCenterX +
          childCards[childCards.length - 1].coupleCenterX) /
        2;
      if (groupWidth > childrenWidth) {
        // Cặp rộng hơn hàng con → dịch con sang phải cho cân giữa cặp.
        const shift = (groupWidth - childrenWidth) / 2;
        for (let i = startIdx; i < cards.length; i++) {
          cards[i].cx += shift;
          cards[i].coupleCenterX += shift;
        }
        groupLeft = childStart;
        cursor = childStart + groupWidth + SIBLING_GAP;
      } else {
        groupLeft = childrenCenter - groupWidth / 2;
      }
    }

    const y = depth * ROW_PITCH;
    const primary: Card = {
      person,
      cx: groupLeft + CARD_W / 2,
      y,
      kind: "primary",
      coupleCenterX: groupLeft + groupWidth / 2,
      hasSpouse: spouses.length > 0,
    };
    cards.push(primary);
    let sx = groupLeft + CARD_W + MARRIAGE_GAP;
    for (const s of spouses) {
      const sc: Card = {
        person: s,
        cx: sx + CARD_W / 2,
        y,
        kind: "spouse",
        coupleCenterX: sx + CARD_W / 2,
        hasSpouse: false,
      };
      cards.push(sc);
      marriageLinks.push({ a: primary, b: sc });
      shownAsSpouse.add(s.id);
      sx += CARD_W + MARRIAGE_GAP;
    }
    for (const cc of childCards) childLinks.push({ parent: primary, child: cc });
    return primary;
  }
  // Vẽ cây huyết thống trước (kèm ô vợ/chồng cạnh mỗi người).
  for (const r of connectedRoots) place(r, 0);

  // Người RỜI RẠC = gốc không con, KHÔNG thuộc cây trên trang, và CHƯA được
  // vẽ như ô vợ/chồng → gom vào LƯỚI nhiều hàng bên dưới (tránh kéo trang
  // rộng làm chữ bé). Bạn đời của người trong họ đã nằm cạnh họ rồi.
  const singleRoots = roots.filter(
    (r) =>
      kidsOf(r.id).length === 0 &&
      !lineagePrimaries.has(r.id) &&
      !shownAsSpouse.has(r.id),
  );

  if (singleRoots.length > 0) {
    const treeBottom = cards.reduce((m, c) => Math.max(m, c.y + CARD_H), 0);
    const gridTop = connectedRoots.length > 0 ? treeBottom + ROW_GAP * 1.4 : 0;
    const cols = Math.max(
      1,
      Math.ceil(Math.sqrt(singleRoots.length * (SVG_W / SVG_H))),
    );
    let gx = 0;
    let gy = gridTop;
    let col = 0;
    for (const s of singleRoots) {
      if (shownAsSpouse.has(s.id)) continue; // đã là ô vợ/chồng của single khác
      const spouses = spousesToShow(s.id);
      const gw = (1 + spouses.length) * CARD_W + spouses.length * MARRIAGE_GAP;
      const primary: Card = {
        person: s,
        cx: gx + CARD_W / 2,
        y: gy,
        kind: "primary",
        coupleCenterX: gx + gw / 2,
        hasSpouse: spouses.length > 0,
      };
      cards.push(primary);
      let sx = gx + CARD_W + MARRIAGE_GAP;
      for (const sp of spouses) {
        const sc: Card = {
          person: sp,
          cx: sx + CARD_W / 2,
          y: gy,
          kind: "spouse",
          coupleCenterX: sx + CARD_W / 2,
          hasSpouse: false,
        };
        cards.push(sc);
        marriageLinks.push({ a: primary, b: sc });
        shownAsSpouse.add(sp.id);
        sx += CARD_W + MARRIAGE_GAP;
      }
      gx += gw + SIBLING_GAP;
      col += 1;
      if (col >= cols) {
        col = 0;
        gx = 0;
        gy += CARD_H + ROW_GAP * 0.7;
      }
    }
  }

  // Chuẩn hoá: nếu có ô lệch sang trái mép (x âm), dịch cả sơ đồ về ≥ 0
  // để không bị cắt mất mép trái.
  const minX = cards.reduce((m, c) => Math.min(m, c.cx - CARD_W / 2), 0);
  if (minX < 0) {
    for (const c of cards) {
      c.cx -= minX;
      c.coupleCenterX -= minX;
    }
  }

  const contentW = Math.max(
    1,
    cards.reduce((m, c) => Math.max(m, c.cx + CARD_W / 2), 0),
  );
  const contentH = Math.max(
    1,
    cards.reduce((m, c) => Math.max(m, c.y + CARD_H), 0),
  );
  // Vẽ SVG đúng cỡ nội dung đã co (không letterbox) → thẻ to hết mức mà
  // vẫn nằm gọn trong khung trang, bớt khoảng trắng thừa.
  const fit = Math.min(SVG_W / contentW, SVG_H / contentH);
  const drawW = Math.max(1, Math.round(contentW * fit));
  const drawH = Math.max(1, Math.round(contentH * fit));

  const yearOf = (p: PersonDetail): string => {
    if (showLivingFullDob && p.is_living) {
      const full = formatPartialDate({
        date: p.birth_date,
        precision: p.birth_date_precision ?? null,
      });
      if (full) return full;
    }
    return lifespanText(p);
  };

  return (
    <Page size="A4" orientation="landscape" style={styles.page}>
      <VineBorder width={PAGE_W_LS} height={PAGE_H_LS} />
      <Text style={styles.h1}>{title}</Text>
      <View style={styles.h1Underline} />
      <Text style={styles.intro}>
        {subtitle ??
          "Mỗi ô là một thành viên; ô nhạt viền đứt là dâu/rể kết hôn vào họ. Tên đọc từ trên xuống. Thuỷ tổ ở đầu, các đời xuôi xuống dưới."}
      </Text>
      <View style={{ alignItems: "center" }}>
      <Svg
        width={drawW}
        height={drawH}
        viewBox={`0 0 ${contentW} ${contentH}`}
        preserveAspectRatio="xMidYMin meet"
      >
        {/* Nối cha/mẹ → con. Có vợ/chồng: thả từ NÉT HÔN NHÂN (giữa cặp,
            ngay giữa chiều cao ô); độc thân: thả từ đáy ô. */}
        {childLinks.map((e, i) => {
          const px = e.parent.coupleCenterX;
          const py = e.parent.hasSpouse
            ? e.parent.y + CARD_H / 2
            : e.parent.y + CARD_H;
          const cx = e.child.cx;
          const cy = e.child.y;
          const midY = (e.parent.y + CARD_H + cy) / 2;
          return (
            <Path
              key={`c${i}`}
              d={`M ${px} ${py} V ${midY} H ${cx} V ${cy}`}
              stroke={COLORS.divider}
              strokeWidth={0.6}
              fill="none"
            />
          );
        })}
        {/* Đường hôn nhân: gạch ngang giữa hai ô */}
        {marriageLinks.map((m, i) => {
          const y = m.a.y + CARD_H / 2;
          return (
            <Path
              key={`m${i}`}
              d={`M ${m.a.cx + CARD_W / 2} ${y} H ${m.b.cx - CARD_W / 2}`}
              stroke={COLORS.muted}
              strokeWidth={0.6}
              fill="none"
            />
          );
        })}
        {/* Ô thành viên (dọc) */}
        {cards.map((c, i) => {
          const p = c.person;
          const x = c.cx - CARD_W / 2;
          // Kiểu ô theo VỊ TRÍ: ô đứng ở chỗ vợ/chồng (kind="spouse") tô nhạt
          // + viền đứt = "kết hôn vào nhánh này" — kể cả khi người đó là con
          // gái trong họ lấy người cùng họ (vd Đặng Thị Tần bên nhánh chồng).
          // Ở trang nhánh cha mẹ của họ, họ là node chính → tô đặc bình thường.
          const isSpouse = c.kind === "spouse";
          const fill = isSpouse
            ? "#EEE7DA"
            : p.gender === "M"
              ? "#D4DDE4"
              : p.gender === "F"
                ? "#E8D2CC"
                : "#E8E0D2";
          const sylls = nameSyllables(p.full_name);
          // Tên dài hơn số dòng cho phép: giữ MỖI DÒNG MỘT âm tiết (khỏi
          // tràn ngang), dòng cuối thêm "…" báo còn nữa (tên đầy đủ ở Danh bạ).
          const lines =
            sylls.length > maxSyl
              ? [...sylls.slice(0, maxSyl - 1), sylls[maxSyl - 1] + "…"]
              : sylls;
          const yr = yearOf(p);
          return (
            <G key={`${p.id}-${i}`}>
              <Rect
                x={x}
                y={c.y}
                width={CARD_W}
                height={CARD_H}
                rx={2.5}
                ry={2.5}
                fill={fill}
                stroke={isSpouse ? COLORS.muted : COLORS.primary}
                strokeWidth={0.5}
                strokeDasharray={isSpouse ? "1.5 1.5" : undefined}
              />
              {lines.map((ln, li) => (
                <Text
                  key={li}
                  x={c.cx}
                  y={c.y + PAD_T + (li + 1) * LINE_H - 1.8}
                  style={{
                    fontFamily: PDF_FONT_FAMILY,
                    fontSize: NAME_FS,
                    fontWeight: isSpouse ? 400 : 600,
                    fill: COLORS.ink,
                    textAnchor: "middle",
                  }}
                >
                  {ln}
                </Text>
              ))}
              {yr ? (
                <Text
                  x={c.cx}
                  y={c.y + CARD_H - PAD_B - 1}
                  style={{
                    fontFamily: PDF_FONT_FAMILY,
                    fontSize: YEAR_FS,
                    fill: COLORS.muted,
                    textAnchor: "middle",
                  }}
                >
                  {yr}
                </Text>
              ) : null}
            </G>
          );
        })}
      </Svg>
      </View>
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
