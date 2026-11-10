import { Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { bioToPlainText } from "@/lib/bio";
import type { ClanBookData } from "@/lib/queries/clan-book";
import type { PersonDetail } from "@/lib/queries/persons";
import { formatLunarAnniversary } from "@/lib/lunarDate";

import { COLORS, VineBorder, styles as bookStyles } from "./ClanBookPdf";
import { serifStyle } from "./registerFont";

/**
 * Các phần theo bố cục "bộ gia phả hoàn chỉnh": lời nói đầu, phả ký,
 * phả hệ theo đời, ngoại phả (ngày giỗ, cưới gả), phụ khảo.
 *
 * Style tạo trễ vì file này và ClanBookPdf import lẫn nhau: COLORS chỉ có
 * giá trị sau khi ClanBookPdf chạy xong, nên không được đọc ở cấp module.
 */
let cached: ReturnType<typeof makeStyles> | null = null;
function S() {
  return (cached ??= makeStyles());
}
function makeStyles() {
  return StyleSheet.create({
    h1: {
      fontSize: 22,
      fontWeight: 600,
      lineHeight: 1.2,
      color: COLORS.primary,
      marginBottom: 2,
    },
    underline: {
      width: 60,
      height: 1.5,
      backgroundColor: COLORS.accent,
      marginBottom: 14,
    },
    intro: { color: COLORS.muted, marginBottom: 12, fontSize: 10 },
    para: { fontSize: 10.5, lineHeight: 1.5, marginBottom: 6, textAlign: "justify" },
    sub: {
      fontSize: 12.5,
      fontWeight: 600,
      color: COLORS.primary,
      marginTop: 10,
      marginBottom: 4,
    },
    genHead: {
      fontSize: 15,
      fontWeight: 600,
      color: COLORS.primary,
      textAlign: "center",
      marginTop: 8,
      marginBottom: 6,
    },
    groupHead: {
      fontSize: 10.5,
      fontWeight: 700,
      color: COLORS.ink,
      textAlign: "center",
      marginTop: 8,
      marginBottom: 5,
    },
    box: {
      flexDirection: "row",
      borderWidth: 0.8,
      borderColor: COLORS.primary,
      marginBottom: 2,
    },
    boxCell: { flex: 1, padding: 5 },
    boxCellRight: {
      flex: 1,
      padding: 5,
      borderLeftWidth: 0.8,
      borderLeftColor: COLORS.primary,
    },
    boxName: { fontSize: 10, fontWeight: 700, color: COLORS.ink },
    boxLine: { fontSize: 8.5, color: COLORS.ink },
    boxSep: { marginTop: 4, paddingTop: 3, borderTopWidth: 0.4, borderTopColor: COLORS.divider },
    kySu: { fontSize: 9, lineHeight: 1.4, color: COLORS.ink, marginBottom: 6, marginTop: 2 },
    row: {
      flexDirection: "row",
      paddingVertical: 3,
      borderBottomWidth: 0.4,
      borderBottomColor: COLORS.divider,
    },
    th: { fontSize: 9, fontWeight: 700, color: COLORS.primary },
    td: { fontSize: 9.5, color: COLORS.ink },
    tocRow: { flexDirection: "row", marginBottom: 7, fontSize: 12 },
    tocNum: { width: 34, fontWeight: 700, color: COLORS.primary },
  });
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function TextPage({
  title,
  intro,
  text,
  children,
}: {
  title: string;
  intro?: string;
  text?: string | null;
  children?: React.ReactNode;
}) {
  const s = S();
  return (
    <Page size="A4" style={BOOK_PAGE()}>
      <VineBorder />
      <Text style={[s.h1, serifStyle()]}>{title}</Text>
      <View style={s.underline} />
      {intro ? <Text style={s.intro}>{intro}</Text> : null}
      {text
        ? paragraphs(text).map((t, i) => (
            <Text key={i} style={s.para}>
              {t}
            </Text>
          ))
        : null}
      {children}
    </Page>
  );
}

// Cùng khung trang với các trang khác của sổ (đọc lúc render, không phải lúc nạp module).
function BOOK_PAGE() {
  return bookStyles.page;
}

// ─── Mục lục ───────────────────────────────────────────────────────

export function TocPage({ items }: { items: string[] }) {
  const s = S();
  return (
    <Page size="A4" style={BOOK_PAGE()}>
      <VineBorder />
      <Text style={[s.h1, serifStyle()]}>Mục lục</Text>
      <View style={s.underline} />
      {items.map((t, i) => (
        <View key={i} style={s.tocRow}>
          <Text style={s.tocNum}>{toRoman(i + 1)}.</Text>
          <Text style={serifStyle()}>{t}</Text>
        </View>
      ))}
    </Page>
  );
}

function toRoman(n: number): string {
  const map: [number, string][] = [
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  for (const [v, r] of map) while (n >= v) { out += r; n -= v; }
  return out;
}

// ─── Lời nói đầu ───────────────────────────────────────────────────

export function PrefacePage({ text }: { text: string }) {
  return <TextPage title="Lời nói đầu" text={text} />;
}

// ─── Phả ký (văn bản + số liệu tự tính) ────────────────────────────

export interface PhaKyStats {
  bloodline: PersonDetail[];
  inLaws: PersonDetail[];
  branchName: (id: string | null) => string | null;
  genOffset: number;
  spousesByPerson: Map<string, string[]>;
  personById: Map<string, PersonDetail>;
}

export function PhaKyPages({ text, stats }: { text: string | null; stats: PhaKyStats }) {
  const s = S();
  const { bloodline, genOffset } = stats;
  const male = bloodline.filter((p) => p.gender === "M").length;
  const female = bloodline.length - male;
  const living = bloodline.filter((p) => p.is_living).length;

  const byGen = new Map<number, { m: number; f: number }>();
  for (const p of bloodline) {
    if (p.generation === null) continue;
    const g = p.generation - genOffset;
    const c = byGen.get(g) ?? { m: 0, f: 0 };
    if (p.gender === "M") c.m++;
    else c.f++;
    byGen.set(g, c);
  }
  const gens = [...byGen.entries()].sort((a, b) => a[0] - b[0]);

  const byBranch = new Map<string, { m: number; f: number }>();
  for (const p of bloodline) {
    const name = stats.branchName(p.branch_id);
    if (!name) continue;
    const c = byBranch.get(name) ?? { m: 0, f: 0 };
    if (p.gender === "M") c.m++;
    else c.f++;
    byBranch.set(name, c);
  }

  // Họ của người cưới vào: chữ đầu của tên. Chỉ là ước tính vì tên ghi
  // tự do, nhưng đủ cho câu "đã kết thông gia với khoảng N họ khác".
  const otherHo = new Set(
    stats.inLaws.map((p) => p.full_name.trim().split(/\s+/)[0]?.toLowerCase()).filter(Boolean),
  );

  return (
    <TextPage
      title="Phả ký"
      intro="Lịch sử tổng hợp của dòng họ."
      text={text}
    >
      <Text style={[s.sub, serifStyle()]}>Số liệu tổng hợp</Text>
      <Text style={s.para}>
        Hiện sổ ghi nhận {bloodline.length} người thuộc huyết thống ({male} nam,
        {" "}{female} nữ; {living} người còn sống), kéo dài {gens.length} đời
        {byBranch.size > 0 ? `, chia ${byBranch.size} chi` : ""}.
        {stats.inLaws.length > 0
          ? ` Có ${stats.inLaws.length} dâu/rể, kết thông gia với khoảng ${otherHo.size} họ khác.`
          : ""}
      </Text>
      {gens.length > 0 ? (
        <View wrap={false}>
          <Text style={[s.groupHead, { textAlign: "left" }]}>Theo đời</Text>
          <View style={s.row}>
            <Text style={[s.th, { width: 70 }]}>Đời</Text>
            <Text style={[s.th, { width: 60 }]}>Nam</Text>
            <Text style={[s.th, { width: 60 }]}>Nữ</Text>
            <Text style={[s.th, { width: 60 }]}>Cộng</Text>
          </View>
          {gens.map(([g, c]) => (
            <View key={g} style={s.row}>
              <Text style={[s.td, { width: 70 }]}>{g}</Text>
              <Text style={[s.td, { width: 60 }]}>{c.m}</Text>
              <Text style={[s.td, { width: 60 }]}>{c.f}</Text>
              <Text style={[s.td, { width: 60 }]}>{c.m + c.f}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {byBranch.size > 0 ? (
        <View wrap={false}>
          <Text style={[s.groupHead, { textAlign: "left" }]}>Theo chi</Text>
          <View style={s.row}>
            <Text style={[s.th, { flex: 1 }]}>Chi</Text>
            <Text style={[s.th, { width: 50 }]}>Nam</Text>
            <Text style={[s.th, { width: 50 }]}>Nữ</Text>
            <Text style={[s.th, { width: 50 }]}>Cộng</Text>
          </View>
          {[...byBranch.entries()].map(([name, c]) => (
            <View key={name} style={s.row}>
              <Text style={[s.td, { flex: 1 }]}>{name}</Text>
              <Text style={[s.td, { width: 50 }]}>{c.m}</Text>
              <Text style={[s.td, { width: 50 }]}>{c.f}</Text>
              <Text style={[s.td, { width: 50 }]}>{c.m + c.f}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </TextPage>
  );
}

// ─── Phả hệ theo đời ───────────────────────────────────────────────

export interface PhaHeInput {
  data: ClanBookData;
  bloodline: PersonDetail[];
  personById: Map<string, PersonDetail>;
  spousesByPerson: Map<string, string[]>;
  fatherOf: Map<string, string>;
  motherOf: Map<string, string>;
  sttById: Map<string, string>;
  genOffset: number;
}

function yearOf(p: PersonDetail, kind: "birth" | "death"): string | null {
  const solar = kind === "birth" ? p.birth_date : p.death_date;
  const lunar = kind === "birth" ? p.birth_lunar_year : p.death_lunar_year;
  return solar?.slice(0, 4) ?? (lunar ? String(lunar) : null);
}

function PersonBoxCell({
  p,
  index,
  burial,
}: {
  p: PersonDetail;
  index?: number;
  burial: (p: PersonDetail) => string | null;
}) {
  const s = S();
  const b = yearOf(p, "birth");
  const d = yearOf(p, "death");
  const years = b || d ? `(${b ?? "?"}–${d ?? (p.is_living ? "nay" : "?")})` : "";
  const gio = !p.is_living
    ? formatLunarAnniversary({
        month: p.death_anniv_lunar_month ?? undefined,
        day: p.death_anniv_lunar_day ?? undefined,
      })
    : "";
  const mo = !p.is_living ? burial(p) : null;
  return (
    <>
      <Text style={s.boxName}>
        {index != null ? `${index}. ` : ""}
        {p.full_name}
      </Text>
      {years ? <Text style={s.boxLine}>{years}</Text> : null}
      {gio ? <Text style={s.boxLine}>Giỗ: {gio}</Text> : null}
      {mo ? <Text style={s.boxLine}>Mộ: {mo}</Text> : null}
    </>
  );
}

/**
 * Phả hệ trình bày tổng hợp: mỗi ĐỜI một tiêu đề, trong đó từng nhóm
 * "CÁC CON ÔNG … VÀ BÀ …"; mỗi con một khung chia đôi (trái: người trong họ,
 * phải: vợ/chồng), kèm kỷ sự ngắn bên dưới.
 */
export function PhaHePages({ input }: { input: PhaHeInput }) {
  const s = S();
  const { bloodline, personById, spousesByPerson, fatherOf, motherOf, sttById, genOffset } = input;

  const burialByName = new Map<string, string>();
  for (const rp of input.data.restingPlaces) {
    const where = [rp.name, rp.location_name].filter(Boolean).join(", ");
    if (!where) continue;
    for (const n of rp.occupant_names) burialByName.set(n, where);
  }
  const burial = (p: PersonDetail) => p.burial_place || burialByName.get(p.full_name) || null;

  type Group = { key: string; father?: PersonDetail; mother?: PersonDetail; kids: PersonDetail[] };
  const groups = new Map<number, Map<string, Group>>();
  for (const p of bloodline) {
    if (p.generation === null) continue;
    const g = p.generation - genOffset;
    const fid = fatherOf.get(p.id);
    const mid = motherOf.get(p.id);
    const key = `${fid ?? ""}|${mid ?? ""}`;
    const gm = groups.get(g) ?? new Map<string, Group>();
    const grp = gm.get(key) ?? {
      key,
      father: fid ? personById.get(fid) : undefined,
      mother: mid ? personById.get(mid) : undefined,
      kids: [],
    };
    grp.kids.push(p);
    gm.set(key, grp);
    groups.set(g, gm);
  }

  const sttKey = (g: Group) => {
    const ref = g.father ?? g.mother ?? g.kids[0];
    return sttById.get(ref.id) ?? sttById.get(g.kids[0].id) ?? "999";
  };
  const cmp = (a: string, b: string) => {
    const aa = a.split(".").map(Number);
    const bb = b.split(".").map(Number);
    for (let i = 0; i < Math.min(aa.length, bb.length); i++) {
      if (aa[i] !== bb[i]) return aa[i] - bb[i];
    }
    return aa.length - bb.length;
  };

  const genList = [...groups.keys()].sort((a, b) => a - b);
  return (
    <Page size="A4" style={BOOK_PAGE()}>
      <VineBorder />
      <Text style={[s.h1, serifStyle()]}>Phả hệ</Text>
      <View style={s.underline} />
      <Text style={s.intro}>
        Trình bày theo từng đời; trong mỗi đời, các con của cùng một cặp cha mẹ
        xếp theo thứ tự trưởng – thứ. Ô trái là người trong họ, ô phải là vợ/chồng.
        Ngày giỗ tính theo âm lịch.
      </Text>
      {genList.map((g) => (
        <View key={g}>
          <Text style={[s.genHead, serifStyle()]} minPresenceAhead={80}>
            ĐỜI {toRoman2(g)}
          </Text>
          {[...groups.get(g)!.values()]
            .sort((a, b) => cmp(sttKey(a), sttKey(b)))
            .map((grp) => {
              const parents = [grp.father?.full_name, grp.mother?.full_name]
                .filter(Boolean);
              const head =
                parents.length === 0
                  ? "THUỶ TỔ"
                  : grp.father && grp.mother
                    ? `CÁC CON ÔNG ${grp.father.full_name.toUpperCase()} VÀ BÀ ${grp.mother.full_name.toUpperCase()}`
                    : grp.father
                      ? `CÁC CON ÔNG ${grp.father.full_name.toUpperCase()}`
                      : `CÁC CON BÀ ${grp.mother!.full_name.toUpperCase()}`;
              return (
                <View key={grp.key}>
                  <Text style={s.groupHead} minPresenceAhead={70}>
                    {head}
                  </Text>
                  {grp.kids.map((k, i) => {
                    const spouses = (spousesByPerson.get(k.id) ?? [])
                      .map((id) => personById.get(id))
                      .filter((x): x is PersonDetail => !!x);
                    const kySu = k.bio ? bioToPlainText(k.bio).trim() : "";
                    return (
                      <View key={k.id} wrap={false}>
                        <View style={s.box}>
                          <View style={s.boxCell}>
                            <PersonBoxCell p={k} index={i + 1} burial={burial} />
                          </View>
                          <View style={s.boxCellRight}>
                            {spouses.length === 0 ? (
                              <Text style={s.boxLine}> </Text>
                            ) : (
                              spouses.map((sp, si) => (
                                <View key={sp.id} style={si > 0 ? s.boxSep : undefined}>
                                  <PersonBoxCell p={sp} burial={burial} />
                                </View>
                              ))
                            )}
                          </View>
                        </View>
                        <Text style={s.kySu}>
                          {kySu
                            ? kySu.length > 500
                              ? `${kySu.slice(0, 500).trimEnd()}…`
                              : kySu
                            : " "}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              );
            })}
        </View>
      ))}
    </Page>
  );
}

function toRoman2(n: number): string {
  if (n <= 0) return String(n);
  const map: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  for (const [v, r] of map) while (n >= v) { out += r; n -= v; }
  return out;
}

// ─── Ngoại phả ─────────────────────────────────────────────────────

export function NgoaiPhaTextPage({ text }: { text: string }) {
  return <TextPage title="Ngoại phả" text={text} />;
}

/** Danh sách ngày giỗ theo âm lịch, xếp từ tháng 1 đến tháng 12. */
export function DeathAnniversaryPages({
  persons,
  genOffset,
}: {
  persons: PersonDetail[];
  genOffset: number;
}) {
  const s = S();
  const rows = persons
    .filter((p) => !p.is_living && p.death_anniv_lunar_month && p.death_anniv_lunar_day)
    .sort(
      (a, b) =>
        a.death_anniv_lunar_month! - b.death_anniv_lunar_month! ||
        a.death_anniv_lunar_day! - b.death_anniv_lunar_day! ||
        a.full_name.localeCompare(b.full_name, "vi"),
    );
  if (rows.length === 0) return null;
  return (
    <Page size="A4" style={BOOK_PAGE()}>
      <VineBorder />
      <Text style={[s.h1, serifStyle()]}>Danh sách ngày giỗ</Text>
      <View style={s.underline} />
      <Text style={s.intro}>Ngày giỗ tính theo âm lịch.</Text>
      <View style={s.row} fixed>
        <Text style={[s.th, { width: 90 }]}>Ngày giỗ</Text>
        <Text style={[s.th, { flex: 1 }]}>Người mất</Text>
        <Text style={[s.th, { width: 50 }]}>Đời</Text>
      </View>
      {rows.map((p) => (
        <View key={p.id} style={s.row} wrap={false}>
          <Text style={[s.td, { width: 90 }]}>
            {p.death_anniv_lunar_day}/{p.death_anniv_lunar_month} ÂL
          </Text>
          <Text style={[s.td, { flex: 1 }]}>{p.full_name}</Text>
          <Text style={[s.td, { width: 50 }]}>
            {p.generation === null ? "" : p.generation - genOffset}
          </Text>
        </View>
      ))}
    </Page>
  );
}

/** Biểu quan hệ cưới gả: con trai cưới (vợ họ nào), con gái gả (chồng họ nào). */
export function MarriageTablePages({
  bloodline,
  spousesByPerson,
  personById,
  genOffset,
}: {
  bloodline: PersonDetail[];
  spousesByPerson: Map<string, string[]>;
  personById: Map<string, PersonDetail>;
  genOffset: number;
}) {
  const s = S();
  const rows: { who: PersonDetail; spouse: PersonDetail }[] = [];
  for (const p of bloodline) {
    for (const id of spousesByPerson.get(p.id) ?? []) {
      const sp = personById.get(id);
      if (sp) rows.push({ who: p, spouse: sp });
    }
  }
  if (rows.length === 0) return null;
  rows.sort(
    (a, b) =>
      (a.who.generation ?? 0) - (b.who.generation ?? 0) ||
      a.who.full_name.localeCompare(b.who.full_name, "vi"),
  );
  return (
    <Page size="A4" style={BOOK_PAGE()}>
      <VineBorder />
      <Text style={[s.h1, serifStyle()]}>Quan hệ cưới gả</Text>
      <View style={s.underline} />
      <Text style={s.intro}>
        Con trai cưới vợ, con gái gả chồng; ghi theo đời của người trong họ.
      </Text>
      <View style={s.row} fixed>
        <Text style={[s.th, { width: 36 }]}>Đời</Text>
        <Text style={[s.th, { flex: 1 }]}>Người trong họ</Text>
        <Text style={[s.th, { width: 44 }]}>Quan hệ</Text>
        <Text style={[s.th, { flex: 1 }]}>Vợ / chồng</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={s.row} wrap={false}>
          <Text style={[s.td, { width: 36 }]}>
            {r.who.generation === null ? "" : r.who.generation - genOffset}
          </Text>
          <Text style={[s.td, { flex: 1 }]}>{r.who.full_name}</Text>
          <Text style={[s.td, { width: 44 }]}>{r.who.gender === "M" ? "cưới" : "gả"}</Text>
          <Text style={[s.td, { flex: 1 }]}>{r.spouse.full_name}</Text>
        </View>
      ))}
    </Page>
  );
}

// ─── Phụ khảo ──────────────────────────────────────────────────────

export function PhuKhaoPage({ text }: { text: string }) {
  return <TextPage title="Phụ khảo" text={text} />;
}
