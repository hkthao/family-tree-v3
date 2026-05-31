import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { ClanDetail } from "@/lib/queries/clan-detail";
import type { ClanBookData } from "@/lib/queries/clan-book";
import type { PersonDetail } from "@/lib/queries/persons";
import { formatPartialDate } from "@/lib/partialDate";
import {
  formatLunarAnniversary,
  formatLunarDate,
} from "@/lib/lunarDate";

import { ensurePdfFontRegistered, PDF_FONT_FAMILY } from "./registerFont";

// ─── Page geometry (A4 in points) ──────────────────────────────────

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
  coverWrap: { marginTop: 140, alignItems: "center" },
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
  // Circle uses explicit paddingTop instead of justifyContent: center.
  // PDF text baselines sit lower in the line-box than browser CSS, so
  // flex-centering drops the glyph below the geometric centre. Push
  // it back up with a measured top padding.
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    paddingTop: 9,
    marginBottom: 6,
  },
  avatarCircleM: { backgroundColor: COLORS.primary },
  avatarCircleF: { backgroundColor: COLORS.accent },
  avatarLetter: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: 600,
    lineHeight: 1,
    textAlign: "center",
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

// ─── Document ───────────────────────────────────────────────────────

interface Props {
  clan: ClanDetail;
  data: ClanBookData;
  include?: { tree?: boolean; detail?: boolean };
}

export function ClanBookPdf({ clan, data, include }: Props) {
  ensurePdfFontRegistered();

  const showTree = include?.tree ?? true;
  const showDetail = include?.detail ?? true;

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

  const bloodlineSorted = [...bloodline]
    .filter((p) => sttById.has(p.id))
    .sort((a, b) => compareStt(sttById.get(a.id)!, sttById.get(b.id)!));

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
        <View style={styles.coverWrap}>
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

      {/* ─── Cây phả hệ (flat by generation) ─────────────────── */}
      {showTree && bloodline.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.h1}>Cây phả hệ</Text>
          <View style={styles.h1Underline} />
          <Text style={styles.intro}>
            Liệt kê theo từng đời. Số d'Aboville đi đầu mỗi dòng để tra
            ngược trong danh bạ chi tiết.
          </Text>
          {Array.from(
            new Set(bloodlineSorted.map((p) => p.generation as number)),
          )
            .sort((a, b) => a - b)
            .map((g) => {
              const list = bloodlineSorted.filter((p) => p.generation === g);
              return (
                <View key={g} style={{ marginTop: 10 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: COLORS.accent,
                      marginBottom: 4,
                    }}
                  >
                    {`Đời ${g} (${list.length} người)`}
                  </Text>
                  {list.map((p) => {
                    const stt = sttById.get(p.id) ?? "";
                    const g2 = p.gender === "M" ? "Nam" : "Nữ";
                    const ls = lifespanText(p);
                    return (
                      <Text key={p.id} style={styles.treeLine}>
                        {`${stt}  ${p.full_name}  (${g2})${ls ? `  ${ls}` : ""}`}
                      </Text>
                    );
                  })}
                </View>
              );
            })}
        </Page>
      )}

      {/* ─── Danh bạ chi tiết (3-card grid) ─────────────────── */}
      {showDetail && bloodlineSorted.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.h1}>Danh bạ chi tiết</Text>
          <View style={styles.h1Underline} />
          <Text style={styles.intro}>
            Sắp xếp theo số d'Aboville (trưởng - thứ trong từng đời).
            Mỗi hàng ba thẻ.
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
                  {renderInLawCard(p, spousesByPerson, personById)}
                </View>
              ))}
            </View>
          ))}
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
  if (p.generation !== null) metaParts.push(`Đời ${p.generation}`);
  metaParts.push(`${p.gender === "M" ? "Nam" : "Nữ"} (${vaiVe})`);
  if (!p.is_living) metaParts.push("đã mất");
  if (branchName) metaParts.push(`chi ${branchName}`);

  return (
    <>
      <View
        style={
          p.gender === "M"
            ? [styles.avatarCircle, styles.avatarCircleM]
            : [styles.avatarCircle, styles.avatarCircleF]
        }
      >
        <Text style={styles.avatarLetter}>{firstInitial(p.full_name)}</Text>
      </View>
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
): React.ReactNode {
  const ls = lifespanText(p);
  const spouseList = (spousesByPerson.get(p.id) ?? [])
    .map((id) => personById.get(id))
    .filter((s): s is PersonDetail => !!s);

  const metaParts: string[] = [p.gender === "M" ? "Nam" : "Nữ"];
  if (ls) metaParts.push(ls);
  if (!p.is_living) metaParts.push("đã mất");

  return (
    <>
      <View
        style={
          p.gender === "M"
            ? [styles.avatarCircle, styles.avatarCircleM]
            : [styles.avatarCircle, styles.avatarCircleF]
        }
      >
        <Text style={styles.avatarLetter}>{firstInitial(p.full_name)}</Text>
      </View>
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
  const ay = a.birth_date ?? "";
  const by = b.birth_date ?? "";
  if (ay && by) return ay.localeCompare(by);
  if (ay) return -1;
  if (by) return 1;
  return a.full_name.localeCompare(b.full_name, "vi");
}

function firstInitial(fullName: string): string {
  const tokens = fullName.trim().split(/\s+/);
  const last = tokens[tokens.length - 1] ?? "";
  return last.charAt(0).toUpperCase() || "?";
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
