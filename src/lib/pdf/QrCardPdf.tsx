import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { ensurePdfFontRegistered, PDF_FONT_FAMILY } from "./registerFont";

// ─── Page geometry ────────────────────────────────────────────────
// @react-pdf accepts named sizes ('A6', 'A4'); for the bulk grid we
// also need exact cell dimensions. Sizes are in PDF points (72/inch).
// A6 = 105 × 148 mm; the 2×3 bulk cell = 105 × 99 mm (one third of
// A4 height instead of half) so we fit 6 cards per A4 sheet.
const MM_PER_POINT = 25.4 / 72;
const A6_W = 105 / MM_PER_POINT; // ≈ 297.6
const A6_H = 148 / MM_PER_POINT; // ≈ 419.5
const BULK_CELL_W = 105 / MM_PER_POINT; // ≈ 297.6 (2 across A4)
const BULK_CELL_H = 99 / MM_PER_POINT; // ≈ 280.6 (3 down A4)

const COLORS = {
  ink: "#1F1A17",
  muted: "#6F665F",
  divider: "#D8CFC2",
  primary: "#7A2230",
  accent: "#C19A5B",
  paper: "#FFFFFF",
};

export interface QrCardItem {
  id: string;
  fullName: string;
  /** Tên tự (courtesy name) — italic subtitle on the card if present. */
  courtesyName: string | null;
  /** Đời thứ N — small badge top-right if not null. */
  generation: number | null;
  /** "1920" or null. */
  birthYear: string | null;
  /** "1990" or null. */
  deathYear: string | null;
  isLiving: boolean;
  /** PNG data URL produced by qrcode.toDataURL(). */
  qrDataUrl: string;
}

interface QrCardProps {
  clanName: string;
  item: QrCardItem;
  /** Outer box width in pt. Defaults to A6_W. */
  width?: number;
  /** Outer box height in pt. Defaults to A6_H. */
  height?: number;
}

/**
 * One printable QR card sized to an A6 box. Used both as a full-page
 * A6 PDF (single download from the person modal) and as one cell in
 * a 2×2 A4 sheet (bulk export). Layout is intentionally minimal:
 * clan name eyebrow, person name + lifespan, large centred QR, and a
 * small scan hint at the bottom. No photo — these are printed in
 * black-and-white onto stone or paper.
 */
function QrCard({ clanName, item, width = A6_W, height = A6_H }: QrCardProps) {
  const lifespan = formatLifespan(item);
  // QR ~ 58% of the card's short edge — slightly bigger than before so
  // the layout reads as a single tight column instead of three blocks
  // floating in whitespace.
  const qrSize = Math.min(width, height) * 0.58;

  return (
    <View
      style={{
        width,
        height,
        backgroundColor: COLORS.paper,
        paddingTop: 14,
        paddingBottom: 10,
        paddingHorizontal: 16,
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontSize: 8.5,
          color: COLORS.muted,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {clanName}
      </Text>
      <View
        style={{
          width: 28,
          height: 1,
          backgroundColor: COLORS.accent,
          marginBottom: 6,
        }}
      />
      <Text
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: COLORS.primary,
          textAlign: "center",
          lineHeight: 1.2,
        }}
      >
        {item.fullName}
      </Text>
      {item.courtesyName && (
        <Text
          style={{
            fontSize: 9.5,
            color: COLORS.muted,
            marginTop: 2,
            textAlign: "center",
          }}
        >
          Tự {item.courtesyName}
        </Text>
      )}
      {(lifespan || item.generation !== null) && (
        <Text
          style={{
            fontSize: 9,
            color: COLORS.ink,
            marginTop: 2,
            textAlign: "center",
          }}
        >
          {[
            item.generation !== null ? `Đời ${item.generation}` : null,
            lifespan,
          ]
            .filter(Boolean)
            .join("  ·  ")}
        </Text>
      )}

      <Image
        src={item.qrDataUrl}
        style={{ width: qrSize, height: qrSize, marginTop: 10 }}
      />

      <Text
        style={{
          fontSize: 7.5,
          color: COLORS.muted,
          textAlign: "center",
          marginTop: 6,
        }}
      >
        Quét mã để xem trang cá nhân
      </Text>
    </View>
  );
}

function formatLifespan(item: QrCardItem): string | null {
  if (item.isLiving) {
    return item.birthYear ? `${item.birthYear} —` : null;
  }
  if (!item.birthYear && !item.deathYear) return null;
  return `${item.birthYear ?? "?"} — ${item.deathYear ?? "?"}`;
}

const styles = StyleSheet.create({
  // A4 sheet, no outer padding — the 2×3 grid tiles edge-to-edge so
  // the hairline cell borders double as cut lines.
  a4Page: {
    fontFamily: PDF_FONT_FAMILY,
    backgroundColor: COLORS.paper,
    flexDirection: "column",
    padding: 0,
  },
  // One row of two cells.
  a4Row: {
    flexDirection: "row",
  },
  // Bulk cell — 105 × 99 mm. 2 across × 3 down = 6 per A4 sheet.
  a4Cell: {
    width: BULK_CELL_W,
    height: BULK_CELL_H,
    borderRightWidth: 0.4,
    borderBottomWidth: 0.4,
    borderColor: COLORS.divider,
  },
});

interface PdfProps {
  clanName: string;
  items: QrCardItem[];
}

/**
 * Single-person A6 PDF — one page, no cut marks.
 */
export function PersonQrSinglePdf({ clanName, items }: PdfProps) {
  ensurePdfFontRegistered();
  return (
    <Document>
      {items.map((item) => (
        <Page
          key={item.id}
          size="A6"
          orientation="portrait"
          style={{ fontFamily: PDF_FONT_FAMILY, backgroundColor: COLORS.paper }}
        >
          <QrCard clanName={clanName} item={item} />
        </Page>
      ))}
    </Document>
  );
}

const BULK_PER_PAGE = 6;
const BULK_ROWS = 3;
const BULK_COLS = 2;

/**
 * Bulk PDF — A4 portrait, 6 cards per page (2 cols × 3 rows). Each
 * cell is 105 × 99 mm. Faint hairline borders double as cut lines for
 * guillotine trimming.
 */
export function PersonQrBulkPdf({ clanName, items }: PdfProps) {
  ensurePdfFontRegistered();
  const pages: QrCardItem[][] = [];
  for (let i = 0; i < items.length; i += BULK_PER_PAGE) {
    pages.push(items.slice(i, i + BULK_PER_PAGE));
  }
  return (
    <Document>
      {pages.map((pageItems, pageIdx) => (
        <Page key={pageIdx} size="A4" orientation="portrait" style={styles.a4Page}>
          {Array.from({ length: BULK_ROWS }, (_, rowIdx) => (
            <View key={rowIdx} style={styles.a4Row}>
              {Array.from({ length: BULK_COLS }, (_, colIdx) => {
                const item = pageItems[rowIdx * BULK_COLS + colIdx];
                if (!item) return null;
                return (
                  <View key={item.id} style={styles.a4Cell}>
                    <QrCard
                      clanName={clanName}
                      item={item}
                      width={BULK_CELL_W}
                      height={BULK_CELL_H}
                    />
                  </View>
                );
              })}
            </View>
          ))}
        </Page>
      ))}
    </Document>
  );
}
