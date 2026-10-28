import { Circle, Image, Page, Path, Svg, Text, View } from "@react-pdf/renderer";

import { generationColor } from "@/lib/tree/folderModel";

import { COLORS, VineBorder } from "./ClanBookPdf";
import {
  FOLDER_AVATAR as PERSON_AVATAR,
  FOLDER_INDENT,
  FOLDER_META_PT,
  FOLDER_NAME_PT,
  FOLDER_SPOUSE_AVATAR as SPOUSE_AVATAR,
  FOLDER_ROW_H,
  paginateFolderRows,
  type FolderPdfPerson,
  type FolderPdfRow,
} from "./folderTreeRows";
import { PDF_FONT_FAMILY } from "./registerFont";

/**
 * Trang "Cây thư mục" trong Sổ gia phả.
 *
 * Phả đồ dạng sơ đồ phải cắt thành nhiều trang A4, mỗi trang một khúc —
 * muốn dò một nhánh từ Thuỷ tổ xuống là phải lật qua lật lại. Trang này
 * in CẢ CÂY liền một cột, mỗi người một dòng, nên KHỔ GIẤY TỰ TÍNH theo
 * cây (xem paginateFolderRows): rộng tối thiểu bằng A4 nằm ngang, dài
 * vừa đủ số người.
 *
 * Cách vẽ giữ đúng kiểu xem "Thư mục" trên màn hình: ảnh tròn viền màu
 * đời, vợ chồng chung một dòng, nét nối kiểu cây thư mục, huy hiệu + nền
 * nhạt theo màu đời, ký hiệu giới tính sau tên. Người nhiều vợ/chồng thì
 * mỗi cuộc hôn nhân một dòng ⚭ riêng, con treo dưới đúng mẹ/cha mình.
 */

const PAD_X = 56;
const PAD_TOP = 60;
const PAD_BOTTOM = 80; // chừa chỗ cho hoa văn góc dưới
const HEADER_H = 78;
const LINE = "#A79C8E";
const LINE_W = 0.7;
const MID = FOLDER_ROW_H / 2;
const RAIL_X = FOLDER_INDENT / 2;

/** Ký hiệu ♂/♀ vẽ bằng nét — font của sổ không có hai glyph này. */
function GenderMark({ gender }: { gender: "M" | "F" }) {
  const color = gender === "M" ? "#2F7FD1" : "#D0458F";
  return (
    <Svg width={8.5} height={8.5} viewBox="0 0 24 24" style={{ marginLeft: 2 }}>
      {gender === "M" ? (
        <>
          <Circle cx={10} cy={14} r={6} stroke={color} strokeWidth={2.6} fill="none" />
          <Path d="M16 3h5v5 M21 3l-6.75 6.75" stroke={color} strokeWidth={2.6} fill="none" />
        </>
      ) : (
        <>
          <Circle cx={12} cy={9} r={6} stroke={color} strokeWidth={2.6} fill="none" />
          <Path d="M12 15v7 M9 19h6" stroke={color} strokeWidth={2.6} fill="none" />
        </>
      )}
    </Svg>
  );
}

/**
 * Ảnh tròn có viền màu theo đời — y như trên web. Người chưa ghi đời vẫn
 * giữ vòng đệm (trong suốt) để ảnh mọi dòng to bằng nhau.
 */
function Avatar({
  p,
  size,
  ring,
}: {
  p: FolderPdfPerson;
  size: number;
  ring: string | null;
}) {
  return (
    <View
      style={{
        padding: 1.5,
        borderRadius: size / 2 + 1.5,
        backgroundColor: ring ?? "transparent",
        marginRight: 5,
      }}
    >
      <Image
        src={p.photo}
        style={{ width: size, height: size, borderRadius: size / 2, objectFit: "cover", objectPositionY: "0%" }}
      />
    </View>
  );
}

function GenBadge({ generation }: { generation: number | null }) {
  const color = generationColor(generation);
  if (!color) return null;
  return (
    <View
      style={{
        backgroundColor: color,
        borderRadius: 6,
        paddingHorizontal: 4,
        marginRight: 4,
      }}
    >
      <Text style={{ fontSize: 7.5, fontWeight: 600, color: "#FFFFFF" }}>
        Đời {generation}
      </Text>
    </View>
  );
}

/**
 * Một người: ảnh + hai dòng chữ (tên và ký hiệu giới tính ở trên; huy
 * hiệu đời, năm sinh–mất, ghi chú ở dưới). Dòng dưới LUÔN có mặt dù
 * trống, để tên của vợ chồng đứng cạnh nhau không cao thấp lệch nhau.
 */
function PersonBlock({
  p,
  bold,
  avatar,
  ring,
  badge = null,
  note,
}: {
  p: FolderPdfPerson;
  bold: boolean;
  avatar: number;
  ring: string | null;
  badge?: number | null;
  note?: string;
}) {
  const meta = [p.years, note].filter(Boolean).join(" · ");
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Avatar p={p} size={avatar} ring={ring} />
      <View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text
            style={{ fontSize: FOLDER_NAME_PT, fontWeight: bold ? 600 : 400 }}
          >
            {p.name}
          </Text>
          <GenderMark gender={p.gender} />
        </View>
        <View
          style={{ flexDirection: "row", alignItems: "center", height: 11 }}
        >
          <GenBadge generation={badge} />
          <Text style={{ fontSize: FOLDER_META_PT, color: COLORS.muted }}>
            {meta}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Dấu ⚭ — hai vòng lồng nhau, cũng vẽ bằng nét vì font thiếu glyph. */
function Rings() {
  return (
    <Svg width={13} height={9.1} viewBox="0 0 20 14" style={{ marginRight: 5 }}>
      <Circle cx={7} cy={7} r={5} stroke={COLORS.muted} strokeWidth={1.4} fill="none" />
      <Circle cx={13} cy={7} r={5} stroke={COLORS.muted} strokeWidth={1.4} fill="none" />
    </Svg>
  );
}

function Row({ row }: { row: FolderPdfRow }) {
  const color = generationColor(row.generation);
  return (
    <View style={{ height: FOLDER_ROW_H, flexDirection: "row" }} wrap={false}>
      {/* Các cột thụt lề: nét dọc chạy xuyên nếu tầng đó còn anh em. */}
      {row.rails.map((on, i) => (
        <View key={i} style={{ width: FOLDER_INDENT, height: FOLDER_ROW_H }}>
          {on && (
            <View
              style={{
                position: "absolute",
                left: RAIL_X,
                top: 0,
                width: LINE_W,
                height: FOLDER_ROW_H,
                backgroundColor: LINE,
              }}
            />
          )}
        </View>
      ))}
      {/* Cột rẽ nhánh: "├" hoặc "└" (con út thì nét dọc dừng giữa dòng). */}
      {row.depth > 0 && (
        <View style={{ width: FOLDER_INDENT, height: FOLDER_ROW_H }}>
          <View
            style={{
              position: "absolute",
              left: RAIL_X,
              top: 0,
              width: LINE_W,
              height: row.isLast ? MID : FOLDER_ROW_H,
              backgroundColor: LINE,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: RAIL_X,
              top: MID,
              width: FOLDER_INDENT - RAIL_X,
              height: LINE_W,
              backgroundColor: LINE,
            }}
          />
        </View>
      )}

      <View
        style={{
          flexGrow: 1,
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: 4,
          marginVertical: 1.5,
        }}
      >
        {/* Nền nhạt theo màu đời — lớp riêng để chữ không bị mờ theo. */}
        {color && row.kind === "person" && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: color,
              opacity: 0.09,
              borderRadius: 2,
            }}
          />
        )}

        {row.kind === "marriage" ? (
          // Đầu nhóm của một cuộc hôn nhân: con của bà nào treo ngay dưới
          // dòng của bà ấy.
          <>
            <Rings />
            {row.person ? (
              <PersonBlock
                p={row.person}
                bold={false}
                avatar={SPOUSE_AVATAR}
                ring={color}
                note={row.childCount ? `${row.childCount} con` : "chưa có con"}
              />
            ) : (
              <Text style={{ fontSize: FOLDER_NAME_PT, color: COLORS.muted }}>
                {row.label} · {row.childCount} con
              </Text>
            )}
          </>
        ) : (
          <>
            <PersonBlock
              p={row.person!}
              bold
              avatar={PERSON_AVATAR}
              ring={color}
              badge={row.generation}
            />
            {row.spouses.map((s) => (
              <View
                key={s.id}
                style={{ flexDirection: "row", alignItems: "center", marginLeft: 10 }}
              >
                <Rings />
                <PersonBlock p={s} bold={false} avatar={SPOUSE_AVATAR} ring={color} />
              </View>
            ))}
          </>
        )}
      </View>
    </View>
  );
}

export function renderFolderTreePages(rows: FolderPdfRow[]) {
  const pages = paginateFolderRows(rows, {
    padX: PAD_X,
    padTop: PAD_TOP,
    padBottom: PAD_BOTTOM,
    header: HEADER_H,
  });

  return pages.map((pg, i) => (
    <Page
      key={`folder-tree-${i}`}
      size={[pg.width, pg.height]}
      style={{
        fontFamily: PDF_FONT_FAMILY,
        // KHÔNG đặt lineHeight ở cấp trang: chữ trong các dòng xếp ngang
        // thừa hưởng nó là co về 0 và biến mất hẳn (đã dính, mất tên).
        fontSize: FOLDER_NAME_PT,
        color: COLORS.ink,
        backgroundColor: COLORS.paper,
        paddingTop: PAD_TOP,
        paddingBottom: PAD_BOTTOM,
        paddingHorizontal: PAD_X,
      }}
    >
      <VineBorder width={pg.width} height={pg.height} />
      <View style={{ height: HEADER_H }}>
        <Text style={{ fontSize: 22, fontWeight: 600, color: COLORS.primary }}>
          Sơ đồ cây gia phả
          {pages.length > 1 ? ` (${i + 1}/${pages.length})` : ""}
        </Text>
        <View
          style={{
            width: 60,
            height: 1.5,
            backgroundColor: COLORS.accent,
            marginTop: 2,
            marginBottom: 10,
          }}
        />
        <Text style={{ fontSize: 10, lineHeight: 1.4, color: COLORS.muted }}>
          Cả dòng họ in liền một mạch, mỗi người một dòng; con cháu thụt vào
          dưới cha mẹ. Màu huy hiệu ứng với từng đời.
        </Text>
      </View>
      {pg.rows.map((r) => (
        <Row key={r.key} row={r} />
      ))}
    </Page>
  ));
}
