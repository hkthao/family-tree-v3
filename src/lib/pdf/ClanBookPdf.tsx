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
    fontSize: 10.5,
    lineHeight: 1.45,
    color: COLORS.ink,
    padding: 56,
    backgroundColor: COLORS.paper,
  },
  cover: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  },
  coverTitle: {
    fontSize: 36,
    fontWeight: 600,
    color: COLORS.primary,
    marginBottom: 8,
  },
  coverSubtitle: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 32,
  },
  coverDateline: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 24,
  },
  statRow: {
    flexDirection: "row",
    gap: 24,
    marginTop: 12,
  },
  statBox: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontWeight: 600,
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 9,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  h1: {
    fontSize: 22,
    fontWeight: 600,
    color: COLORS.primary,
    marginBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.accent,
    paddingBottom: 4,
  },
  h2: {
    fontSize: 14,
    fontWeight: 600,
    color: COLORS.primary,
    marginTop: 14,
    marginBottom: 4,
  },
  generationHeading: {
    fontSize: 12,
    fontWeight: 600,
    color: COLORS.accent,
    marginTop: 12,
    marginBottom: 4,
  },
  treeItem: {
    flexDirection: "row",
    marginBottom: 2,
  },
  treeBullet: {
    width: 12,
    color: COLORS.muted,
  },
  treeNameLine: {
    flex: 1,
  },
  personEntry: {
    marginTop: 10,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.divider,
  },
  personName: {
    fontSize: 12.5,
    fontWeight: 600,
    color: COLORS.ink,
  },
  personMeta: {
    fontSize: 10,
    color: COLORS.muted,
    marginBottom: 4,
  },
  fieldRow: {
    flexDirection: "row",
    marginBottom: 1,
  },
  fieldLabel: {
    width: 92,
    color: COLORS.muted,
    fontSize: 10,
  },
  fieldValue: {
    flex: 1,
    fontSize: 10,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 56,
    right: 56,
    fontSize: 9,
    color: COLORS.muted,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: COLORS.divider,
    paddingTop: 6,
  },
});

// ─── Document ───────────────────────────────────────────────────────

interface Props {
  clan: ClanDetail;
  data: ClanBookData;
  /** Optional flags to toggle sections — defaults all true. */
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

  // Family lookups for spouses + children
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

  // Group by generation for the "cây tóm tắt" page
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
      title={`Gia phả — ${clan.name}`}
      author="Gia phả"
      subject={`Sổ gia phả dòng họ ${clan.name}`}
    >
      {/* ─── Cover ──────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.cover}>
          <Text style={{ fontSize: 11, color: COLORS.muted, marginBottom: 6 }}>
            GIA PHẢ
          </Text>
          <Text style={styles.coverTitle}>{clan.name}</Text>
          {clan.description ? (
            <Text style={styles.coverSubtitle}>{clan.description}</Text>
          ) : null}

          <View style={styles.statRow}>
            <Stat label="Người" value={stats.persons} />
            <Stat label="Đời" value={stats.maxGen} />
            <Stat label="Chi" value={stats.branches} />
          </View>

          <Text style={styles.coverDateline}>Xuất ngày {todayLabel}</Text>
        </View>
      </Page>

      {/* ─── Tree by generation ───────────────────────────────── */}
      {showTree && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.h1}>Cây gia phả theo đời</Text>
          <Text style={{ color: COLORS.muted, marginBottom: 8 }}>
            Mỗi đời liệt kê thành viên trong dòng họ, kèm năm sinh – năm
            mất khi có.
          </Text>

          {generations.map((g) => {
            const list = byGeneration.get(g)!;
            return (
              <View key={g} wrap={false}>
                <Text style={styles.generationHeading}>
                  Đời {g} · {list.length} người
                </Text>
                {list.map((p) => (
                  <View key={p.id} style={styles.treeItem}>
                    <Text style={styles.treeBullet}>•</Text>
                    <Text style={styles.treeNameLine}>
                      <Text style={{ fontWeight: 600 }}>{p.full_name}</Text>
                      <Text style={{ color: COLORS.muted }}>
                        {" "}
                        ({p.gender === "M" ? "nam" : "nữ"})
                        {lifespanShort(p) ? `, ${lifespanShort(p)}` : ""}
                        {p.branch_id && branchById.get(p.branch_id)
                          ? ` · chi ${branchById.get(p.branch_id)}`
                          : ""}
                      </Text>
                    </Text>
                  </View>
                ))}
              </View>
            );
          })}

          <PageFooter clanName={clan.name} todayLabel={todayLabel} />
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
            const giỗ = formatLunarAnniversary({
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

            return (
              <View key={p.id} style={styles.personEntry} wrap={false}>
                <Text style={styles.personName}>
                  {p.full_name}
                  {p.is_root ? "  ⟨thuỷ tổ⟩" : ""}
                </Text>
                <Text style={styles.personMeta}>
                  {p.generation !== null ? `Đời ${p.generation} · ` : ""}
                  {p.gender === "M" ? "Nam" : "Nữ"}
                  {p.is_living ? "" : " · đã mất"}
                  {p.branch_id && branchById.get(p.branch_id)
                    ? ` · chi ${branchById.get(p.branch_id)}`
                    : ""}
                </Text>

                <Field label="Tên tự" value={p.courtesy_name} />
                <Field label="Tên húy" value={p.nickname} />
                <Field label="Tên thụy" value={p.posthumous_name} />

                <Field label="Ngày sinh" value={birthSolar || null} />
                <Field
                  label="Ngày sinh ÂL"
                  value={[birthLunar, dayCanChi ? formatCanChiShort(dayCanChi) : ""]
                    .filter(Boolean)
                    .join(" — ") || null}
                />
                {!p.is_living && (
                  <>
                    <Field label="Ngày mất" value={deathSolar || null} />
                    <Field label="Ngày mất ÂL" value={deathLunar || null} />
                    <Field label="Ngày giỗ" value={giỗ || null} />
                  </>
                )}

                <Field label="Nơi sinh" value={p.birth_place} />
                <Field label="Nơi an táng" value={p.burial_place} />

                <Field
                  label="Vợ/chồng"
                  value={spouseNames.length > 0 ? spouseNames.join(", ") : null}
                />
                <Field
                  label="Con"
                  value={childNames.length > 0 ? childNames.join(", ") : null}
                />
                <Field label="Tiểu sử" value={p.bio} />
              </View>
            );
          })}

          <PageFooter clanName={clan.name} todayLabel={todayLabel} />
        </Page>
      )}
    </Document>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function PageFooter({
  clanName,
  todayLabel,
}: {
  clanName: string;
  todayLabel: string;
}) {
  return (
    <View style={styles.footer} fixed>
      <Text>
        Gia phả {clanName} · {todayLabel}
      </Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          `Trang ${pageNumber}/${totalPages}`
        }
      />
    </View>
  );
}

function lifespanShort(p: PersonDetail): string {
  const b = p.birth_date?.slice(0, 4);
  const d = p.death_date?.slice(0, 4);
  if (!b && !d && p.is_living) return "";
  if (!b && !d) return "?–?";
  if (!d && p.is_living) return `${b}–`;
  return `${b ?? "?"}–${d ?? "?"}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function addTo<K, V>(m: Map<K, V[]>, key: K, value: V) {
  const arr = m.get(key);
  if (arr) arr.push(value);
  else m.set(key, [value]);
}
