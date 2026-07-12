import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { COLORS, VineBorder } from "@/lib/pdf/ClanBookPdf";
import type { ClanDetail } from "@/lib/queries/clan-detail";
import type { FundSummary, FundTransaction } from "@/lib/queries/clanFund";

import { ensurePdfFontRegistered, PDF_FONT_FAMILY } from "./registerFont";

// Cùng khổ A4 + lề như Sổ gia phả để đồng nhất.
const SIDE_PAD = 56;
const TOP_PAD = 60;
const BOTTOM_PAD = 68;

// Màu thu (xanh) / chi (đỏ trầm) — chỉ dùng trong báo cáo quỹ.
const IN_COLOR = "#2E7D32";
const OUT_COLOR = "#B23A48";

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
  intro: { color: COLORS.muted, marginBottom: 16, fontSize: 10 },
  subhead: {
    fontSize: 13,
    fontWeight: 700,
    color: COLORS.primary,
    marginTop: 10,
    marginBottom: 6,
  },

  // Thẻ tổng quan (Tổng thu / Tổng chi / Số dư).
  summaryRow: { flexDirection: "row", marginBottom: 16 },
  sumCard: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: COLORS.divider,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    padding: 10,
    marginRight: 8,
  },
  sumCardLast: { marginRight: 0 },
  sumLabel: { fontSize: 9, color: COLORS.muted, marginBottom: 4 },
  sumValue: { fontSize: 14, fontWeight: 700 },

  // Bảng.
  th: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
    paddingBottom: 4,
    marginBottom: 1,
  },
  thText: { fontSize: 9, fontWeight: 700, color: COLORS.primary },
  tr: {
    flexDirection: "row",
    paddingVertical: 3.5,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.divider,
  },
  cellDate: { width: 62, fontSize: 9 },
  cellFund: { width: 88, fontSize: 9, paddingRight: 4 },
  cellNote: { flex: 1, fontSize: 9, paddingRight: 6 },
  cellAmt: { width: 92, fontSize: 9.5, textAlign: "right", fontWeight: 700 },
  cellNum: { width: 84, fontSize: 9, textAlign: "right" },

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

function formatVnd(n: number): string {
  return `${n.toLocaleString("vi-VN")} đ`;
}

function formatDmy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function stripParen(name: string): string {
  return name.replace(/\s*\(.*?\)\s*$/, "").trim() || name;
}

interface Props {
  clan: ClanDetail;
  txs: FundTransaction[];
  summary: FundSummary;
  generatedAt: Date;
}

/**
 * Báo cáo Quỹ họ ra PDF — đồng nhất style với Sổ gia phả (khổ A4, viền dây leo,
 * bảng màu). Gồm: tổng thu/chi/số dư, số dư theo từng quỹ, và bảng chi tiết
 * thu–chi theo thời gian. Để trưởng họ/thủ quỹ in hoặc gửi cho cả họ.
 */
export function FundReportPdf({ clan, txs, summary, generatedAt }: Props) {
  ensurePdfFontRegistered();
  const cleanName = stripParen(clan.name);
  const todayLabel = formatDmy(generatedAt.toISOString().slice(0, 10));

  // Bảng chi tiết đọc theo thứ tự thời gian (cũ → mới) như sổ kế toán.
  const ordered = [...txs].sort((a, b) =>
    a.occurred_on < b.occurred_on
      ? -1
      : a.occurred_on > b.occurred_on
        ? 1
        : a.created_at.localeCompare(b.created_at),
  );

  return (
    <Document
      title={`Báo cáo Quỹ họ - ${cleanName}`}
      author="Dòng Họ Việt"
      subject={`Báo cáo thu chi quỹ dòng họ ${cleanName}`}
    >
      <Page size="A4" style={styles.page}>
        <VineBorder />

        <Text style={styles.h1}>Báo cáo Quỹ họ</Text>
        <View style={styles.h1Underline} />
        <Text style={styles.intro}>
          Dòng họ {cleanName} · Lập ngày {todayLabel} · {txs.length} giao dịch.
          Sổ thu – chi minh bạch, ai trong họ cũng xem được.
        </Text>

        {/* Tổng quan */}
        <View style={styles.summaryRow}>
          <View style={styles.sumCard}>
            <Text style={styles.sumLabel}>Tổng thu</Text>
            <Text style={[styles.sumValue, { color: IN_COLOR }]}>
              {formatVnd(summary.totalIn)}
            </Text>
          </View>
          <View style={styles.sumCard}>
            <Text style={styles.sumLabel}>Tổng chi</Text>
            <Text style={[styles.sumValue, { color: OUT_COLOR }]}>
              {formatVnd(summary.totalOut)}
            </Text>
          </View>
          <View style={[styles.sumCard, styles.sumCardLast]}>
            <Text style={styles.sumLabel}>Số dư hiện tại</Text>
            <Text style={[styles.sumValue, { color: COLORS.primary }]}>
              {formatVnd(summary.balance)}
            </Text>
          </View>
        </View>

        {/* Số dư theo từng quỹ */}
        {summary.byFund.length > 0 && (
          <>
            <Text style={styles.subhead}>Số dư theo từng quỹ</Text>
            <View style={styles.th}>
              <Text style={[styles.cellFund, styles.thText, { width: "auto", flex: 1 }]}>
                Quỹ
              </Text>
              <Text style={[styles.cellNum, styles.thText]}>Thu</Text>
              <Text style={[styles.cellNum, styles.thText]}>Chi</Text>
              <Text style={[styles.cellNum, styles.thText]}>Dư</Text>
            </View>
            {summary.byFund.map((f) => (
              <View key={f.fund} style={styles.tr} wrap={false}>
                <Text style={{ flex: 1, fontSize: 9, paddingRight: 4 }}>
                  {f.fund}
                </Text>
                <Text style={[styles.cellNum, { color: IN_COLOR }]}>
                  {formatVnd(f.in)}
                </Text>
                <Text style={[styles.cellNum, { color: OUT_COLOR }]}>
                  {formatVnd(f.out)}
                </Text>
                <Text style={[styles.cellNum, { fontWeight: 700 }]}>
                  {formatVnd(f.balance)}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Chi tiết thu – chi */}
        <Text style={styles.subhead}>Chi tiết thu – chi</Text>
        {ordered.length === 0 ? (
          <Text style={{ fontSize: 10, color: COLORS.muted }}>
            Chưa có giao dịch nào.
          </Text>
        ) : (
          <>
            <View style={styles.th} fixed>
              <Text style={[styles.cellDate, styles.thText]}>Ngày</Text>
              <Text style={[styles.cellFund, styles.thText]}>Quỹ</Text>
              <Text style={[styles.cellNote, styles.thText]}>Nội dung</Text>
              <Text style={[styles.cellAmt, styles.thText]}>Số tiền</Text>
            </View>
            {ordered.map((t) => (
              <View key={t.id} style={styles.tr} wrap={false}>
                <Text style={styles.cellDate}>{formatDmy(t.occurred_on)}</Text>
                <Text style={styles.cellFund}>{t.fund}</Text>
                <Text style={styles.cellNote}>
                  {t.note || t.category || (t.direction === "in" ? "Thu" : "Chi")}
                </Text>
                <Text
                  style={[
                    styles.cellAmt,
                    { color: t.direction === "in" ? IN_COLOR : OUT_COLOR },
                  ]}
                >
                  {t.direction === "in" ? "+" : "−"}
                  {formatVnd(t.amount)}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Footer với số trang */}
        <View style={styles.footer} fixed>
          <Text>Quỹ họ {cleanName}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Trang ${pageNumber}/${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
