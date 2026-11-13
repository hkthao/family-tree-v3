import { Fragment } from "react";
import { Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { bioToPlainText } from "@/lib/bio";
import type { ClanBookData, ClanBookTexts } from "@/lib/queries/clan-book";
import type { PersonDetail } from "@/lib/queries/persons";
import { formatLunarAnniversary } from "@/lib/lunarDate";

import { COLORS, VineBorder, styles as bookStyles } from "./ClanBookPdf";
import { PageNumber, SectionTitle } from "./bookPages";
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
    intro: { color: COLORS.muted, marginBottom: 12, fontSize: 11 },
    para: { fontSize: 12, lineHeight: 1.55, marginBottom: 7, textAlign: "justify" },
    sub: {
      fontSize: 14,
      fontWeight: 600,
      color: COLORS.primary,
      marginTop: 10,
      marginBottom: 4,
    },
    genHead: {
      fontSize: 17,
      fontWeight: 600,
      color: COLORS.primary,
      textAlign: "center",
      marginTop: 8,
      marginBottom: 6,
    },
    heading: {
      fontSize: 13.5,
      fontWeight: 700,
      color: COLORS.primary,
      marginTop: 10,
      marginBottom: 4,
    },
    groupHead: {
      fontSize: 12,
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
    genBand: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: COLORS.primary,
      paddingVertical: 6,
      paddingHorizontal: 10,
      marginTop: 14,
      marginBottom: 8,
      borderRadius: 5,
    },
    genBandText: { fontSize: 13, fontWeight: 700, color: "#FFFFFF", letterSpacing: 1 },
    genBandCount: { fontSize: 9.5, color: "#F3E3C0" },
    grpHead: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6,
      marginTop: 4,
      paddingVertical: 4,
      paddingHorizontal: 8,
      backgroundColor: "#EFE3C6",
      borderRadius: 4,
    },
    grpLabel: { fontSize: 9.5, color: COLORS.muted, marginRight: 5 },
    grpNames: { fontSize: 11.5, fontWeight: 700, color: COLORS.primary, flex: 1 },
    // Mỗi người một nền kem nhạt bo nhẹ để tách khỏi người khác; vợ/chồng và
    // kỷ sự có nền đậm hơn một chút để phân biệt từng loại thông tin.
    entry: {
      flexDirection: "row",
      paddingVertical: 7,
      paddingHorizontal: 8,
      marginBottom: 6,
      backgroundColor: "#FCF8EC",
      borderWidth: 0.5,
      borderColor: COLORS.divider,
      borderRadius: 5,
    },
    entryNo: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: COLORS.accent,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 9,
      marginTop: 1,
    },
    entryNoText: { fontSize: 10, fontWeight: 700, color: "#FFFFFF" },
    entryBody: { flex: 1 },
    entryName: { fontSize: 12.5, fontWeight: 700, color: COLORS.ink },
    entryTag: { fontSize: 9, fontWeight: 400, color: COLORS.muted },
    entryFacts: { flexDirection: "row", flexWrap: "wrap", marginTop: 2 },
    fact: { fontSize: 10, color: COLORS.ink, marginRight: 12 },
    factLabel: { color: COLORS.muted },
    spouseLine: {
      marginTop: 4,
      flexDirection: "row",
      backgroundColor: "#F4ECD6",
      borderRadius: 4,
      paddingVertical: 3,
      paddingHorizontal: 6,
    },
    spouseTag: {
      fontSize: 9,
      fontWeight: 700,
      color: COLORS.primary,
      width: 34,
      marginTop: 1,
    },
    spouseBody: { flex: 1 },
    spouseName: { fontSize: 10.5, fontWeight: 700, color: COLORS.ink },
    kySuBox: {
      marginTop: 5,
      paddingVertical: 4,
      paddingHorizontal: 7,
      backgroundColor: "#F1EAD9",
      borderRadius: 4,
      borderLeftWidth: 2,
      borderLeftColor: COLORS.accent,
    },
    boxName: { fontSize: 11.5, fontWeight: 700, color: COLORS.ink },
    boxLine: { fontSize: 10, color: COLORS.ink },
    boxSep: { marginTop: 4, paddingTop: 3, borderTopWidth: 0.4, borderTopColor: COLORS.divider },
    kySu: { fontSize: 10, lineHeight: 1.45, color: COLORS.muted },
    row: {
      flexDirection: "row",
      paddingVertical: 3,
      borderBottomWidth: 0.4,
      borderBottomColor: COLORS.divider,
    },
    th: { fontSize: 10.5, fontWeight: 700, color: COLORS.primary },
    td: { fontSize: 11, color: COLORS.ink },
    tocRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 9, fontSize: 14 },
    tocLeader: {
      flex: 1,
      marginHorizontal: 6,
      marginBottom: 3,
      borderBottomWidth: 1,
      borderBottomStyle: "dotted",
      borderBottomColor: COLORS.muted,
    },
    tocPage: { width: 28, textAlign: "right", fontWeight: 700 },
    tocNum: { width: 40, fontWeight: 700, color: COLORS.primary },
  });
}

/** Bỏ ký hiệu markdown AI hay chèn (#, **) để không in ra dấu thừa. */
function stripMarkdown(t: string): string {
  return t.replace(/^#{1,6}\s+/, "").replace(/\*\*(.+?)\*\*/g, "$1").trim();
}

const NUMBERED = /^((?:\d+|[IVXLC]+)[.)])\s+(\S.*)$/;

/**
 * Dòng đánh số "1. …", "2) …", "II. …" hoặc "PHẦN …" là chỉ mục: luôn in
 * đậm. Dòng ngắn thì đậm cả dòng (đề mục); dòng dài (cả đoạn văn mở đầu
 * bằng số) thì chỉ đậm phần số và tiêu đề đầu câu.
 */
export function parseNumbered(t: string): { prefix: string; rest: string; heading: boolean } | null {
  const m = NUMBERED.exec(t);
  if (m) return { prefix: m[1], rest: m[2], heading: t.length <= 120 };
  if (/^PHẦN\s+\S/.test(t)) return { prefix: "", rest: t, heading: true };
  return null;
}

/** Giữ cho test cũ/nơi khác còn dùng: dòng đó là đề mục đậm nguyên dòng. */
export function isHeadingLine(t: string): boolean {
  return parseNumbered(t)?.heading ?? false;
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((t) => stripMarkdown(t))
    .filter(Boolean);
}

function TextPage({
  title,
  id,
  intro,
  text,
  children,
}: {
  title: string;
  /** Mốc để mục lục bấm nhảy tới. */
  id?: string;
  intro?: string;
  text?: string | null;
  children?: React.ReactNode;
}) {
  const s = S();
  return (
    <Page size="A4" style={BOOK_PAGE()}>
      <VineBorder />
      <PageNumber />
      {id ? <SectionTitle id={id} style={[s.h1]}>{title}</SectionTitle> : <Text style={[s.h1, serifStyle()]}>{title}</Text>}
      <View style={s.underline} />
      {intro ? <Text style={s.intro}>{intro}</Text> : null}
      {text
        ? paragraphs(text).map((t, i) => {
            const n = parseNumbered(t);
            if (n?.heading) {
              return (
                <Text key={i} style={[s.heading, serifStyle()]} minPresenceAhead={60}>
                  {t}
                </Text>
              );
            }
            if (n) {
              return (
                <Text key={i} style={s.para}>
                  <Text style={{ fontWeight: 700, color: COLORS.primary }}>{n.prefix} </Text>
                  {n.rest}
                </Text>
              );
            }
            return (
              <Text key={i} style={s.para}>
                {t}
              </Text>
            );
          })
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

export interface TocEntry {
  title: string;
  /** Có mốc thì dòng mục lục bấm nhảy tới đúng trang. */
  id?: string;
}

export function TocPage({
  items,
  pages,
}: {
  items: TocEntry[];
  /** id mục → số trang (lượt dựng thứ hai). Chưa có thì để trống. */
  pages?: Record<string, number>;
}) {
  const s = S();
  return (
    <Page size="A4" style={BOOK_PAGE()}>
      <VineBorder />
      <PageNumber />
      <Text style={[s.h1, serifStyle()]}>Mục lục</Text>
      <View style={s.underline} />
      {items.map((it, i) => {
        const n = it.id ? pages?.[it.id] : undefined;
        const row = (
          <View style={s.tocRow}>
            <Text style={s.tocNum}>{toRoman(i + 1)}.</Text>
            <Text style={serifStyle()}>{it.title}</Text>
            <View style={s.tocLeader} />
            <Text style={[s.tocPage, serifStyle()]}>{n ?? ""}</Text>
          </View>
        );
        return it.id ? (
          <Link key={i} src={`#${it.id}`} style={{ textDecoration: "none", color: COLORS.ink }}>
            {row}
          </Link>
        ) : (
          <View key={i}>{row}</View>
        );
      })}
    </Page>
  );
}

function toRoman(n: number): string {
  return toRoman2(n);
}

// ─── Giới thiệu dòng họ (thông tin biên soạn) ──────────────────────

const INTRO_ROWS: { key: keyof ClanBookTexts; label: string }[] = [
  { key: "origin_place", label: "Nguyên quán / tổ quán" },
  { key: "ancestral_hall", label: "Nhà thờ họ" },
  { key: "ancestor_anniversary", label: "Ngày giỗ tổ" },
  { key: "chief_name", label: "Trưởng họ / người chủ trì" },
  { key: "compilers", label: "Ban biên soạn" },
  { key: "compiled_year", label: "Năm biên soạn" },
  { key: "contact", label: "Liên hệ" },
];

export function hasClanIntro(t: ClanBookTexts | null | undefined): boolean {
  return !!t && INTRO_ROWS.some((r) => !!t[r.key]);
}

// ─── Bảng dùng chung ───────────────────────────────────────────────

export interface Col {
  label: string;
  width?: number;
  /** Cột co giãn lấp chỗ trống (mặc định nếu không có width). */
  align?: "left" | "center" | "right";
  bold?: boolean;
}

/**
 * Kiểu bảng chuẩn của sổ (lấy bảng "Theo đời" làm mẫu): khung bo nhẹ, hàng
 * tiêu đề tô nền, kẻ ngang giữa các hàng và kẻ dọc giữa các cột, hàng
 * "Tổng" ở cuối nếu có. Đặt `wrap={false}` để một bảng không bị cắt giữa trang.
 */
export function DataTable({
  cols,
  rows,
  total,
}: {
  cols: Col[];
  rows: (string | number)[][];
  total?: (string | number)[];
}) {
  const s = S();
  const edge = COLORS.primary;
  const cellStyle = (c: Col, ci: number) =>
    [
      c.width ? { width: c.width } : { flex: 1 },
      {
        paddingVertical: 4,
        paddingHorizontal: 6,
        textAlign: c.align ?? "left",
      },
      ci > 0 ? { borderLeftWidth: 0.6, borderLeftColor: edge } : {},
    ] as const;
  return (
    <View
      wrap={false}
      style={{ borderWidth: 0.6, borderColor: edge, borderRadius: 5, overflow: "hidden", marginBottom: 8 }}
    >
      <View style={{ flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: edge }}>
        {cols.map((c, ci) => (
          <Text key={ci} style={[s.th, ...cellStyle(c, ci), { backgroundColor: COLORS.divider }]}>
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View
          key={ri}
          style={[
            { flexDirection: "row" },
            ri < rows.length - 1 || total ? { borderBottomWidth: 0.6, borderBottomColor: edge } : {},
          ]}
        >
          {cols.map((c, ci) => (
            <Text key={ci} style={[s.td, ...cellStyle(c, ci), c.bold ? { fontWeight: 700 } : {}]}>
              {r[ci] ?? ""}
            </Text>
          ))}
        </View>
      ))}
      {total ? (
        <View style={{ flexDirection: "row" }}>
          {cols.map((c, ci) => (
            <Text key={ci} style={[s.th, ...cellStyle(c, ci)]}>
              {total[ci] ?? ""}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Bảng dài chia thành các khối (mỗi khối một khung đủ tiêu đề) để khung không bị cắt giữa trang. */
export function ChunkedTable({
  cols,
  rows,
  chunk = 24,
}: {
  cols: Col[];
  rows: (string | number)[][];
  chunk?: number;
}) {
  const parts: (string | number)[][][] = [];
  for (let i = 0; i < rows.length; i += chunk) parts.push(rows.slice(i, i + chunk));
  return (
    <>
      {parts.map((part, i) => (
        <DataTable key={i} cols={cols} rows={part} />
      ))}
    </>
  );
}

export function ClanIntroPage({
  clanName,
  texts,
}: {
  clanName: string;
  texts: ClanBookTexts;
}) {
  const s = S();
  return (
    <Page size="A4" style={BOOK_PAGE()}>
      <VineBorder />
      <PageNumber />
      <SectionTitle id="sec-intro" style={[s.h1, serifStyle()]}>Giới thiệu dòng họ</SectionTitle>
      <View style={s.underline} />
      <Text style={s.intro}>{clanName}</Text>
      <DataTable
        cols={[{ label: "Mục", width: 160 }, { label: "Nội dung" }]}
        rows={INTRO_ROWS.filter((r) => texts[r.key]).map((r) => [r.label, texts[r.key] as string])}
      />
    </Page>
  );
}

// ─── Lời nói đầu ───────────────────────────────────────────────────

export function PrefacePage({ text }: { text: string }) {
  return <TextPage title="Lời nói đầu" id="sec-preface" text={text} />;
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

/** Bảng số liệu: Đời/Chi — Nam — Nữ — Tổng, đơn vị người. */
function StatTable({
  title,
  firstHead,
  rows,
}: {
  title: string;
  firstHead: string;
  rows: { label: string; m: number; f: number }[];
}) {
  const s = S();
  return (
    <View wrap={false}>
      <Text style={[s.groupHead, { textAlign: "left" }]}>
        {title}{" "}
        <Text style={{ fontWeight: 400, color: COLORS.muted, fontSize: 10 }}>(đơn vị: người)</Text>
      </Text>
      <DataTable
        cols={[
          { label: firstHead },
          { label: "Nam", width: 64, align: "center" },
          { label: "Nữ", width: 64, align: "center" },
          { label: "Tổng", width: 64, align: "center", bold: true },
        ]}
        rows={rows.map((r) => [r.label, r.m, r.f, r.m + r.f])}
        total={[
          "Tổng",
          rows.reduce((a, r) => a + r.m, 0),
          rows.reduce((a, r) => a + r.f, 0),
          rows.reduce((a, r) => a + r.m + r.f, 0),
        ]}
      />
    </View>
  );
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
      id="sec-phaky"
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
        <StatTable
          title="Theo đời"
          firstHead="Đời"
          rows={gens.map(([g, c]) => ({ label: String(g), m: c.m, f: c.f }))}
        />
      ) : null}
      {byBranch.size > 0 ? (
        <StatTable
          title="Theo chi"
          firstHead="Chi"
          rows={[...byBranch.entries()].map(([name, c]) => ({ label: name, m: c.m, f: c.f }))}
        />
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

/** Các dữ kiện của một người: sinh–mất, giỗ âm lịch, mộ. */
function personFacts(
  p: PersonDetail,
  burial: (p: PersonDetail) => string | null,
): { label: string; value: string }[] {
  const b = yearOf(p, "birth");
  const d = yearOf(p, "death");
  const out: { label: string; value: string }[] = [];
  if (b || d) {
    out.push({
      label: "Sinh – mất",
      value: `${b ?? "?"} – ${d ?? (p.is_living ? "nay" : "?")}`,
    });
  }
  if (!p.is_living) {
    const gio = formatLunarAnniversary({
      month: p.death_anniv_lunar_month ?? undefined,
      day: p.death_anniv_lunar_day ?? undefined,
    });
    if (gio) out.push({ label: "Giỗ", value: gio });
    const mo = burial(p);
    if (mo) out.push({ label: "Mộ", value: mo });
  }
  return out;
}

function Facts({ items }: { items: { label: string; value: string }[] }) {
  const s = S();
  if (items.length === 0) return null;
  return (
    <View style={s.entryFacts}>
      {items.map((f) => (
        <Text key={f.label} style={s.fact}>
          <Text style={s.factLabel}>{f.label}: </Text>
          {f.value}
        </Text>
      ))}
    </View>
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

  // Con của từng người (theo cha, không có cha thì theo mẹ), đúng thứ tự trưởng – thứ.
  const childrenOf = new Map<string, PersonDetail[]>();
  for (const c of bloodline) {
    const parent = fatherOf.get(c.id) ?? motherOf.get(c.id);
    if (!parent) continue;
    const arr = childrenOf.get(parent) ?? [];
    arr.push(c);
    childrenOf.set(parent, arr);
  }
  for (const arr of childrenOf.values()) {
    arr.sort((a, b) => cmp(sttById.get(a.id) ?? "999", sttById.get(b.id) ?? "999"));
  }

  const genList = [...groups.keys()].sort((a, b) => a - b);
  return (
    <Page size="A4" style={BOOK_PAGE()}>
      <VineBorder />
      <PageNumber />
      <SectionTitle id="sec-phahe" style={[s.h1, serifStyle()]}>Phả hệ</SectionTitle>
      <View style={s.underline} />
      <Text style={s.intro}>
        Trình bày theo từng đời; trong mỗi đời, các con của cùng một cặp cha mẹ
        xếp theo thứ tự trưởng – thứ, kèm vợ/chồng. Ngày giỗ tính theo âm lịch.
      </Text>
      {genList.map((g) => {
        const gGroups = [...groups.get(g)!.values()].sort((x, y) => cmp(sttKey(x), sttKey(y)));
        const count = gGroups.reduce((n, grp) => n + grp.kids.length, 0);
        return (
          <Fragment key={g}>
            {gGroups.map((grp, gi) => {
              const names = [grp.father?.full_name, grp.mother?.full_name].filter(Boolean);
              const head =
                names.length === 0 ? "Thuỷ tổ" : names.join(" và ");
              return (
                <Fragment key={grp.key}>
                  {grp.kids.map((k, i) => {
                    const spouses = (spousesByPerson.get(k.id) ?? [])
                      .map((id) => personById.get(id))
                      .filter((x): x is PersonDetail => !!x);
                    const kids = (childrenOf.get(k.id) ?? []);
                    const kySu = k.bio ? bioToPlainText(k.bio).trim() : "";
                    // Người quá nhiều vợ/con (cả khối cao hơn một trang) thì không được cấm
                    // ngắt trang — khối không vừa trang sẽ bị vẽ chồng lên nhau.
                    const kidsChars = kids.reduce((n, c) => n + c.full_name.length + 12, 0);
                    const estHeight =
                      70 +
                      Math.ceil(kidsChars / 80) * 13 +
                      spouses.length * 30 +
                      Math.ceil((kySu ? Math.min(kySu.length, 500) : 0) / 85) * 13;
                    const splittable = estHeight > 440;
                    const alias = [
                      k.courtesy_name && `Tự ${k.courtesy_name}`,
                      k.nickname && `Hiệu ${k.nickname}`,
                      k.posthumous_name && `Thuỵ ${k.posthumous_name}`,
                    ].filter(Boolean);
                    return (
                      // Dải đời + tiêu đề nhóm + người đầu tiên là MỘT khối không ngắt trang, để dải không bị bỏ lại cuối trang.
                      <View key={k.id} wrap={splittable}>
                        {i === 0 && gi === 0 ? (
                          <View style={s.genBand} wrap={false} minPresenceAhead={splittable ? 120 : 0}>
                            <Text style={[s.genBandText, serifStyle()]}>ĐỜI THỨ {toRoman2(g)}</Text>
                            <Text style={s.genBandCount}>{count} người</Text>
                          </View>
                        ) : null}
                        {i === 0 ? (
                          <View style={s.grpHead} wrap={false} minPresenceAhead={splittable ? 100 : 0}>
                            <Text style={s.grpLabel}>
                              {names.length === 0 ? "" : "Con của"}
                            </Text>
                            <Text style={s.grpNames}>{head}</Text>
                          </View>
                        ) : null}
                        <View style={s.entry}>
                          <View style={s.entryNo}>
                            <Text style={s.entryNoText}>{i + 1}</Text>
                          </View>
                          <View style={s.entryBody}>
                            <Text style={s.entryName}>
                              {k.full_name}
                              <Text style={s.entryTag}>
                                {"  "}
                                {k.is_root ? "Thuỷ tổ · " : ""}
                                {k.gender === "M" ? "Nam" : "Nữ"}
                              </Text>
                            </Text>
                            {alias.length > 0 ? (
                              <Text style={s.fact}>{alias.join(" · ")}</Text>
                            ) : null}
                            <Facts items={personFacts(k, burial)} />
                            {kids.length > 0 ? (
                              <Text style={[s.fact, { marginTop: 3 }]}>
                                <Text style={s.factLabel}>Con: </Text>
                                {kids
                                  .map((c, ci) => `${ci === 0 ? "trưởng" : `thứ ${ci + 1}`} ${c.full_name}`)
                                  .join("; ")}
                              </Text>
                            ) : null}
                            {spouses.map((sp) => (
                              <View key={sp.id} style={s.spouseLine} wrap={false}>
                                <Text style={s.spouseTag}>{k.gender === "M" ? "Vợ" : "Chồng"}</Text>
                                <View style={s.spouseBody}>
                                  <Text style={s.spouseName}>{sp.full_name}</Text>
                                  <Facts items={personFacts(sp, burial)} />
                                </View>
                              </View>
                            ))}
                            {kySu ? (
                              <View style={s.kySuBox}>
                                <Text style={s.kySu}>
                                  {kySu.length > 500 ? `${kySu.slice(0, 500).trimEnd()}…` : kySu}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </Fragment>
              );
            })}
          </Fragment>
        );
      })}
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
  return <TextPage title="Ngoại phả" id="sec-ngoaipha" text={text} />;
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
      <PageNumber />
      <SectionTitle id="sec-gio" style={[s.h1, serifStyle()]}>Danh sách ngày giỗ</SectionTitle>
      <View style={s.underline} />
      <Text style={s.intro}>Ngày giỗ tính theo âm lịch.</Text>
      <ChunkedTable
        cols={[
          { label: "Ngày giỗ", width: 96 },
          { label: "Người mất" },
          { label: "Đời", width: 56, align: "center" },
        ]}
        rows={rows.map((p) => [
          `${p.death_anniv_lunar_day}/${p.death_anniv_lunar_month} ÂL`,
          p.full_name,
          p.generation === null ? "" : p.generation - genOffset,
        ])}
      />
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
      <PageNumber />
      <SectionTitle id="sec-cuoiga" style={[s.h1, serifStyle()]}>Quan hệ cưới gả</SectionTitle>
      <View style={s.underline} />
      <Text style={s.intro}>
        Con trai cưới vợ, con gái gả chồng; ghi theo đời của người trong họ.
      </Text>
      <ChunkedTable
        cols={[
          { label: "Đời", width: 44, align: "center" },
          { label: "Người trong họ" },
          { label: "Quan hệ", width: 66, align: "center" },
          { label: "Vợ / chồng" },
        ]}
        rows={rows.map((r) => [
          r.who.generation === null ? "" : r.who.generation - genOffset,
          r.who.full_name,
          r.who.gender === "M" ? "cưới" : "gả",
          r.spouse.full_name,
        ])}
      />
    </Page>
  );
}

// ─── Phụ khảo ──────────────────────────────────────────────────────

export function PhuKhaoPage({ text }: { text: string }) {
  return <TextPage title="Phụ khảo" id="sec-phukhao" text={text} />;
}

/** Có người đã mất ghi ngày giỗ âm lịch (để mục lục biết trang Danh sách ngày giỗ có hay không). */
export function hasAnniversaries(persons: PersonDetail[]): boolean {
  return persons.some((p) => !p.is_living && p.death_anniv_lunar_month && p.death_anniv_lunar_day);
}

/** Có ít nhất một cặp vợ chồng trong họ (trang Quan hệ cưới gả có hay không). */
export function hasMarriages(
  bloodline: PersonDetail[],
  spousesByPerson: Map<string, string[]>,
  personById: Map<string, PersonDetail>,
): boolean {
  return bloodline.some((p) => (spousesByPerson.get(p.id) ?? []).some((id) => personById.has(id)));
}

/** Kiểu chữ chung của các trang sổ (tiêu đề, gạch chân, đoạn, tiêu đề phụ…) cho PDF khác dùng lại. */
export { S as sectionStyles };
