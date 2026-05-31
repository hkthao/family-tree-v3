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
  formatCanChiShort,
  formatLunarAnniversary,
  formatLunarDate,
  getCanChiForSolarDate,
} from "@/lib/lunarDate";

import { ensurePdfFontRegistered, PDF_FONT_FAMILY } from "./registerFont";

// ─── Styles ─────────────────────────────────────────────────────────

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
    fontSize: 11,
    lineHeight: 1.45,
    color: COLORS.ink,
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 56,
    backgroundColor: COLORS.paper,
  },
  coverWrap: {
    marginTop: 200,
    alignItems: "center",
  },
  coverEyebrow: {
    fontSize: 11,
    color: COLORS.muted,
    marginBottom: 6,
  },
  coverTitle: {
    fontSize: 32,
    fontWeight: 600,
    color: COLORS.primary,
    marginBottom: 10,
  },
  coverSubtitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 28,
  },
  coverStat: {
    fontSize: 13,
    color: COLORS.ink,
    marginBottom: 4,
  },
  coverDateline: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 24,
  },
  h1: {
    fontSize: 20,
    fontWeight: 600,
    color: COLORS.primary,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.accent,
  },
  intro: {
    color: COLORS.muted,
    marginBottom: 10,
    fontSize: 10,
  },
  generationHeading: {
    fontSize: 13,
    fontWeight: 600,
    color: COLORS.accent,
    marginTop: 14,
    marginBottom: 4,
  },
  treeRow: {
    fontSize: 11,
    marginBottom: 2,
  },
  personEntry: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.divider,
  },
  personName: {
    fontSize: 12.5,
    fontWeight: 600,
    color: COLORS.ink,
    marginBottom: 2,
  },
  personMeta: {
    fontSize: 10,
    color: COLORS.muted,
    marginBottom: 4,
  },
  field: {
    fontSize: 10.5,
    marginBottom: 1,
  },
  fieldLabel: {
    color: COLORS.muted,
    fontWeight: 600,
  },
});

// ─── Document ───────────────────────────────────────────────────────

interface Props {
  clan: ClanDetail;
  data: ClanBookData;
  include?: {
    tree?: boolean;
    detail?: boolean;
  };
}

export function ClanBookPdf({ clan, data, include }: Props) {
  ensurePdfFontRegistered();

  const showTree = include?.tree ?? true;
  const showDetail = include?.detail ?? true;

  const { persons, families } = data;
  const branchById = new Map(data.branches.map((b) => [b.id, b.name]));

  const spousesByPerson = new Map<string, string[]>();
  const childrenByFamily = new Map<string, string[]>();
  for (const fam of families) {
    if (fam.husband_id && fam.wife_id) {
      addTo(spousesByPerson, fam.husband_id, fam.wife_id);
      addTo(spousesByPerson, fam.wife_id, fam.husband_id);
    }
  }
  for (const [childId, famId] of Object.entries(data.childToFamily)) {
    addTo(childrenByFamily, famId, childId);
  }
  const personById = new Map(persons.map((p) => [p.id, p]));

  const byGeneration = new Map<number, PersonDetail[]>();
  for (const p of persons) {
    const g = p.generation ?? 0;
    if (!byGeneration.has(g)) byGeneration.set(g, []);
    byGeneration.get(g)!.push(p);
  }
  const generations = Array.from(byGeneration.keys()).sort((a, b) => a - b);

  const stats = {
    persons: persons.length,
    maxGen: persons.reduce((m, p) => Math.max(m, p.generation ?? 0), 0),
    branches: data.branches.length,
  };

  const today = new Date();
  const todayLabel = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;

  return (
    <Document
      title={`Gia phả - ${clan.name}`}
      author="Gia phả"
      subject={`Sổ gia phả dòng họ ${clan.name}`}
    >
      {/* ─── Cover ──────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.coverWrap}>
          <Text style={styles.coverEyebrow}>GIA PHẢ</Text>
          <Text style={styles.coverTitle}>{clan.name}</Text>
          {clan.description ? (
            <Text style={styles.coverSubtitle}>{clan.description}</Text>
          ) : null}
          <Text style={styles.coverStat}>Số người: {stats.persons}</Text>
          <Text style={styles.coverStat}>Số đời: {stats.maxGen}</Text>
          <Text style={styles.coverStat}>Số chi: {stats.branches}</Text>
          <Text style={styles.coverDateline}>Xuất ngày {todayLabel}</Text>
        </View>
      </Page>

      {/* ─── Tree by generation ───────────────────────────────── */}
      {showTree && persons.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.h1}>Cây gia phả theo đời</Text>
          <Text style={styles.intro}>
            Mỗi đời liệt kê thành viên, kèm năm sinh - năm mất khi có.
          </Text>

          {generations.map((g) => (
            <View key={g}>
              <Text style={styles.generationHeading}>
                Đời {g} ({byGeneration.get(g)!.length} người)
              </Text>
              {byGeneration.get(g)!.map((p) => (
                <Text key={p.id} style={styles.treeRow}>
                  {treeRowText(p, branchById)}
                </Text>
              ))}
            </View>
          ))}
        </Page>
      )}

      {/* ─── Detailed person entries ──────────────────────────── */}
      {showDetail && persons.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.h1}>Danh bạ chi tiết</Text>

          {persons.map((p) => {
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
            const deathLunar = formatLunarDate({
              year: p.death_lunar_year ?? undefined,
              month: p.death_lunar_month ?? undefined,
              day: p.death_lunar_day ?? undefined,
            });
            const gioRow = formatLunarAnniversary({
              month: p.death_anniv_lunar_month ?? undefined,
              day: p.death_anniv_lunar_day ?? undefined,
            });
            const dayCanChi = p.birth_date
              ? getCanChiForSolarDate(p.birth_date)
              : null;

            const spouseNames = (spousesByPerson.get(p.id) ?? [])
              .map((id) => personById.get(id)?.full_name)
              .filter(Boolean) as string[];

            const ownFamilyIds = families
              .filter((f) => f.husband_id === p.id || f.wife_id === p.id)
              .map((f) => f.id);
            const childNames = ownFamilyIds
              .flatMap((fid) => childrenByFamily.get(fid) ?? [])
              .map((id) => personById.get(id)?.full_name)
              .filter(Boolean) as string[];

            const branchName = p.branch_id
              ? branchById.get(p.branch_id)
              : null;

            const metaParts: string[] = [];
            if (p.generation !== null) metaParts.push(`Đời ${p.generation}`);
            metaParts.push(p.gender === "M" ? "Nam" : "Nữ");
            if (!p.is_living) metaParts.push("đã mất");
            if (branchName) metaParts.push(`chi ${branchName}`);

            return (
              <View key={p.id} style={styles.personEntry}>
                <Text style={styles.personName}>
                  {p.full_name}
                  {p.is_root ? "  (thuỷ tổ)" : ""}
                </Text>
                <Text style={styles.personMeta}>{metaParts.join(" - ")}</Text>

                <FieldLine label="Tên tự" value={p.courtesy_name} />
                <FieldLine label="Tên húy" value={p.nickname} />
                <FieldLine label="Tên thụy" value={p.posthumous_name} />

                <FieldLine label="Ngày sinh" value={birthSolar || null} />
                <FieldLine
                  label="Ngày sinh ÂL"
                  value={
                    [birthLunar, dayCanChi ? formatCanChiShort(dayCanChi) : ""]
                      .filter(Boolean)
                      .join(" - ") || null
                  }
                />
                {!p.is_living && (
                  <>
                    <FieldLine label="Ngày mất" value={deathSolar || null} />
                    <FieldLine label="Ngày mất ÂL" value={deathLunar || null} />
                    <FieldLine label="Ngày giỗ" value={gioRow || null} />
                  </>
                )}

                <FieldLine label="Nơi sinh" value={p.birth_place} />
                <FieldLine label="Nơi an táng" value={p.burial_place} />

                <FieldLine
                  label="Vợ/chồng"
                  value={spouseNames.length > 0 ? spouseNames.join(", ") : null}
                />
                <FieldLine
                  label="Con"
                  value={childNames.length > 0 ? childNames.join(", ") : null}
                />
                <FieldLine label="Tiểu sử" value={p.bio} />
              </View>
            );
          })}
        </Page>
      )}
    </Document>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function FieldLine({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <Text style={styles.field}>
      {label}: {value}
    </Text>
  );
}

function treeRowText(
  p: PersonDetail,
  branchById: Map<string, string>,
): string {
  const parts: string[] = [];
  parts.push(p.full_name);
  parts.push(`(${p.gender === "M" ? "nam" : "nữ"})`);
  const ls = lifespanShort(p);
  if (ls) parts.push(ls);
  if (p.branch_id && branchById.get(p.branch_id)) {
    parts.push(`chi ${branchById.get(p.branch_id)}`);
  }
  return `- ${parts.join(" - ")}`;
}

function lifespanShort(p: PersonDetail): string {
  const b = p.birth_date?.slice(0, 4);
  const d = p.death_date?.slice(0, 4);
  if (!b && !d && p.is_living) return "";
  if (!b && !d) return "?-?";
  if (!d && p.is_living) return `${b}-`;
  return `${b ?? "?"}-${d ?? "?"}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function addTo<K, V>(m: Map<K, V[]>, key: K, value: V) {
  const arr = m.get(key);
  if (arr) arr.push(value);
  else m.set(key, [value]);
}
