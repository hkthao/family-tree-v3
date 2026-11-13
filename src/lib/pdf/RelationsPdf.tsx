import { Document, Image, Page, Text, View } from "@react-pdf/renderer";

import { PageNumber, SectionTitle } from "@/lib/pdf/bookPages";
import { BOOK_WATERMARKS } from "@/lib/pdf/bookWatermarks";
import { DataTable, sectionStyles, type Col } from "@/lib/pdf/bookSections";
import {
  COLORS,
  VineBorder,
  WatermarkContext,
  styles as bookStyles,
} from "@/lib/pdf/ClanBookPdf";
import { pdfAssets } from "@/lib/pdf/pdfAssets";
import { ensurePdfFontRegistered, serifStyle } from "@/lib/pdf/registerFont";
import type { ClanDetail } from "@/lib/queries/clan-detail";
import {
  deathLabel,
  ancestorLabel,
  yearOf,
  type RelPerson,
  type RelationsReport,
} from "@/lib/relations";

const stripParen = (name: string): string =>
  name.replace(/\s*\(.*?\)\s*$/, "").trim() || name;

const dmy = (d: Date): string =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

const dash = (v: string | null | undefined): string =>
  v && v.trim() ? v : "—";

// Bề rộng nội dung trang A4 (595 − 2×56 lề) và cỡ chữ / dòng của DataTable (11pt × 1,45).
const CONTENT_W = 483;
const LINE_H = 16;
// Một khối bảng không được cao hơn trang (DataTable không ngắt giữa chừng): trình duyệt báo
// "VIEW can't wrap between pages and it's bigger than available page height" rồi dồn cả trang lại.
const MAX_CHUNK_H = 560;

/**
 * Chia hàng thành các khối theo CHIỀU CAO ƯỚC TÍNH (không theo số hàng): ô dài như "Bố / Mẹ" xuống
 * 2–3 dòng làm hàng cao gấp đôi, nên 24 hàng cố định của ChunkedTable có thể vượt cả trang.
 */
function chunkByHeight(cols: Col[], rows: string[][]): string[][][] {
  const fixed = cols.reduce((sum, c) => sum + (c.width ?? 0), 0);
  const flexCols = cols.filter((c) => !c.width).length || 1;
  const widthOf = (c: Col) =>
    c.width ?? Math.max(60, (CONTENT_W - fixed) / flexCols);
  const rowH = (r: string[]) => {
    const lines = cols.reduce((max, c, i) => {
      const capacity = Math.max(4, Math.floor((widthOf(c) - 12) / 6)); // ~6pt mỗi ký tự, trừ đệm ô
      return Math.max(max, Math.ceil((r[i] ?? "").length / capacity) || 1);
    }, 1);
    return lines * LINE_H + 9;
  };
  const chunks: string[][][] = [];
  let cur: string[][] = [];
  let h = LINE_H + 9; // hàng tiêu đề
  for (const r of rows) {
    const rh = rowH(r);
    if (cur.length > 0 && h + rh > MAX_CHUNK_H) {
      chunks.push(cur);
      cur = [];
      h = LINE_H + 9;
    }
    cur.push(r);
    h += rh;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

/** "1887 – 1942", "sinh 1950", hoặc rỗng nếu chưa rõ năm. */
function lifeLine(p: RelPerson): string {
  const b = yearOf(p.birth_date);
  const d = yearOf(p.death_date);
  if (b && d) return `${b} – ${d}`;
  if (b) return p.is_living ? `Sinh ${b}` : `${b} – ?`;
  return d ? `? – ${d}` : "";
}

/** Các cột "Sinh – Mất – Quê quán" dùng chung cho mọi bảng người. */
const personCols = (p: RelPerson): string[] => [
  dash(yearOf(p.birth_date)),
  deathLabel(p),
  dash(p.birth_place),
];

/**
 * PDF "Tra cứu quan hệ" của một người — cùng kiểu Sổ gia phả: khổ A4, khung dây leo, hình nền mờ,
 * số trang giữa chân trang, bảng khung rượu vang bo nhẹ (DataTable), tiêu đề màu rượu vang.
 * Nội dung lấy từ `RelationsReport`, đúng một nguồn với màn hình và CSV.
 */
export function RelationsPdf({
  clan,
  report,
  genOffset,
  generatedAt,
  coverQrDataUri,
}: {
  clan: ClanDetail;
  report: RelationsReport;
  genOffset: number;
  generatedAt: Date;
  /** QR trang bìa → link xem gia phả công khai (bỏ trống = không in QR). */
  coverQrDataUri?: string;
}) {
  ensurePdfFontRegistered();
  const s = sectionStyles();
  const clanName = stripParen(clan.name);
  // "Họ Trần" giữ nguyên, "Trần" thành "Họ Trần" — tránh "Dòng họ Họ Trần".
  const clanLabel = /^họ\s/i.test(clanName) ? clanName : `Họ ${clanName}`;
  const { focal } = report;
  const heading = (text: string) => (
    <Text style={[s.sub, serifStyle()]} minPresenceAhead={70}>
      {text}
    </Text>
  );
  const empty = (text: string) => (
    <Text style={[s.intro, { marginBottom: 8 }]}>{text}</Text>
  );

  const genderCol: Col = { label: "Giới tính", width: 64, align: "center" };
  const yearCol: Col = { label: "Sinh", width: 44, align: "center" };
  const deathCol: Col = { label: "Mất", width: 48, align: "center" };
  const placeCol: Col = { label: "Quê quán" };

  const infoRows: [string, string][] = [
    ["Họ và tên", focal.full_name],
    ["Đời", report.generation !== null ? String(report.generation) : "—"],
    ["Giới tính", focal.gender === "M" ? "Nam" : "Nữ"],
    ["Sinh", dash(yearOf(focal.birth_date))],
    ["Mất", deathLabel(focal)],
    ["Hưởng thọ", focal.lifespan_years ? `${focal.lifespan_years} tuổi` : "—"],
    ["Quê quán", dash(focal.birth_place)],
    ["Nơi an táng", dash(focal.burial_place)],
  ];

  const ancestorRows = [
    ...report.line.map((a, i) => [
      ancestorLabel(i + 1),
      a.full_name,
      ...personCols(a),
    ]),
    ...(report.mother
      ? [["Mẹ", report.mother.full_name, ...personCols(report.mother)]]
      : []),
  ];
  const uncleRows = [
    ...report.fatherSiblings.map((u) => [
      "Bên cha",
      u.full_name,
      u.gender === "M" ? "Nam" : "Nữ",
      ...personCols(u),
    ]),
    ...report.motherSiblings.map((u) => [
      "Bên mẹ",
      u.full_name,
      u.gender === "M" ? "Nam" : "Nữ",
      ...personCols(u),
    ]),
  ];
  const descendantCols: Col[] = [
    { label: "Đời", width: 30, align: "center" },
    { label: "Họ tên", width: 112, bold: true },
    { label: "Sinh", width: 40, align: "center" },
    { label: "Vợ / chồng", width: 110 },
    { label: "Quê quán", width: 76 },
    { label: "Bố / Mẹ" },
  ];
  const descendantRows = report.rows.map((r) => [
    r.person.generation !== null
      ? String(r.person.generation - genOffset)
      : "—",
    r.person.full_name,
    dash(yearOf(r.person.birth_date)),
    r.spouses.length
      ? r.spouses
          .map((sp) => {
            const y = yearOf(sp.birth_date);
            return y ? `${sp.full_name} (${y})` : sp.full_name;
          })
          .join("; ")
      : "—",
    dash(
      r.person.birth_place ??
        r.spouses.map((sp) => sp.birth_place).find(Boolean),
    ),
    dash(
      [r.father?.full_name, r.mother?.full_name].filter(Boolean).join(" · "),
    ),
  ]);

  return (
    <Document
      title={`Tra cứu quan hệ - ${focal.full_name}`}
      author="Dòng Họ Việt"
      subject={`Quan hệ của ${focal.full_name} — ${clanLabel}`}
    >
      <WatermarkContext.Provider
        value={{
          ...BOOK_WATERMARKS.phoenix,
          src: pdfAssets.watermarks.phoenix ?? BOOK_WATERMARKS.phoenix.src,
        }}
      >
        {/* ─── Bìa: cùng bố cục bìa Sổ gia phả ─────────────────────── */}
        <Page size="A4" style={bookStyles.page}>
          <VineBorder />
          <View style={bookStyles.coverWrap}>
            <Image src={pdfAssets.logo} style={bookStyles.coverLogo} />
            <Text style={[bookStyles.coverEyebrow, serifStyle()]}>
              TRA CỨU QUAN HỆ
            </Text>
            <Text style={[bookStyles.coverTitle, serifStyle()]}>
              {focal.full_name}
            </Text>
            <View style={bookStyles.coverDivider} />
            <Text style={[bookStyles.coverTagline, serifStyle()]}>
              {clanLabel}
            </Text>
            <Text style={bookStyles.coverSubtitle}>Quan hệ trong dòng họ</Text>
            <Text style={bookStyles.coverStat}>
              {[
                report.generation !== null ? `Đời ${report.generation}` : null,
                lifeLine(focal),
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            {report.summary ? (
              <Text style={bookStyles.coverStat}>Có {report.summary}</Text>
            ) : null}
            <Text style={bookStyles.coverDateline}>
              Biên soạn ngày {dmy(generatedAt)}
            </Text>
            {coverQrDataUri ? (
              <View style={{ alignItems: "center", marginTop: 18 }}>
                <Image src={coverQrDataUri} style={{ width: 94, height: 94 }} />
                <Text
                  style={{ fontSize: 9, color: COLORS.muted, marginTop: 4 }}
                >
                  Quét để xem gia phả online
                </Text>
              </View>
            ) : null}
          </View>
        </Page>

        <Page size="A4" style={bookStyles.page}>
          <VineBorder />
          <PageNumber />
          <SectionTitle id="rel-title" style={[s.h1]}>
            Tra cứu quan hệ
          </SectionTitle>
          <View style={s.underline} />
          <Text style={s.intro}>
            {focal.full_name} · {clanLabel} · Lập ngày {dmy(generatedAt)}
          </Text>

          {heading("Thông tin cá nhân")}
          <DataTable
            cols={[{ label: "Mục", width: 110 }, { label: "Nội dung" }]}
            rows={infoRows}
          />

          {heading("Tổ tiên (dòng cha) và mẹ")}
          {ancestorRows.length === 0 ? (
            empty("Chưa ghi nhận cha mẹ.")
          ) : (
            <DataTable
              cols={[
                { label: "Quan hệ", width: 80 },
                { label: "Họ tên", bold: true },
                yearCol,
                deathCol,
                placeCol,
              ]}
              rows={ancestorRows}
            />
          )}

          {heading(`Vợ / chồng (${report.spouses.length})`)}
          {report.spouses.length === 0 ? (
            empty("Chưa ghi nhận vợ/chồng.")
          ) : (
            <DataTable
              cols={[
                { label: "Họ tên", bold: true },
                yearCol,
                deathCol,
                placeCol,
              ]}
              rows={report.spouses.map((sp) => [
                sp.full_name,
                ...personCols(sp),
              ])}
            />
          )}

          {heading(`Anh chị em (${report.siblings.length})`)}
          {report.siblings.length === 0 ? (
            empty("Không có anh chị em được ghi nhận.")
          ) : (
            <DataTable
              cols={[
                { label: "Họ tên", bold: true },
                genderCol,
                yearCol,
                deathCol,
                placeCol,
              ]}
              rows={report.siblings.map((sb) => [
                sb.full_name,
                sb.gender === "M" ? "Nam" : "Nữ",
                ...personCols(sb),
              ])}
            />
          )}

          {heading(`Bác, chú, cô, cậu, dì (${uncleRows.length})`)}
          {uncleRows.length === 0 ? (
            empty("Chưa ghi nhận anh chị em của cha mẹ.")
          ) : (
            <DataTable
              cols={[
                { label: "Bên", width: 56 },
                { label: "Họ tên", bold: true },
                genderCol,
                yearCol,
                deathCol,
                placeCol,
              ]}
              rows={uncleRows}
            />
          )}

          {descendantRows.length === 0 ? (
            <>
              {heading("Con cháu")}
              {empty("Chưa ghi nhận con cháu.")}
            </>
          ) : (
            chunkByHeight(descendantCols, descendantRows).map((part, i) =>
              i === 0 ? (
                // Tiêu đề + tóm tắt + khối bảng đầu không tách trang: tránh tiêu đề mồ côi cuối trang.
                <View key={i} wrap={false}>
                  {heading("Con cháu")}
                  <Text style={[s.intro, { marginBottom: 6 }]}>
                    Có {report.summary}.
                  </Text>
                  <DataTable cols={descendantCols} rows={part} />
                </View>
              ) : (
                <DataTable key={i} cols={descendantCols} rows={part} />
              ),
            )
          )}
          <Text style={{ fontSize: 9, color: COLORS.muted, marginTop: 6 }}>
            Tài liệu lập từ gia phả {clanLabel} trên Dòng Họ Việt.
          </Text>
        </Page>
      </WatermarkContext.Provider>
    </Document>
  );
}
