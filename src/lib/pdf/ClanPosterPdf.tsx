import {
  Circle,
  Document,
  Line,
  Page,
  Path,
  Rect,
  Svg,
  Text,
} from "@react-pdf/renderer";

import type { PosterDoc } from "@/lib/poster/buildPoster";
import type { PosterSize } from "@/lib/poster/frame";
import { PDF_FONT_FAMILY } from "@/lib/pdf/registerFont";
import type { Prim } from "@/lib/poster/prims";

/**
 * Bảng gia phả một trang, khổ lớn, để mang ra tiệm in.
 *
 * Toàn bộ tấm là VECTOR: khung hoa văn, ô, nét nối, chữ đều là đường
 * nét, nên in A0 vẫn nét như in A3 — ảnh bitmap phóng tới cỡ đó thì rỗ.
 *
 * Chỉ dịch nguyên thuỷ sang thẻ của @react-pdf, không tính lại bố cục:
 * bố cục nào cũng chỉ được tính một lần, ở buildPoster.
 */

// @react-pdf đọc style.fontSize cho chữ trong <Svg> nhưng kiểu công bố
// của nó không kể fontSize/fontFamily — nên phải ép kiểu ở đúng một chỗ
// này thay vì rải `as any` khắp nơi.
interface SvgTextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: 400 | 600;
}
const textStyle = (size: number, weight: 400 | 600) =>
  ({
    fontFamily: PDF_FONT_FAMILY,
    fontSize: size,
    fontWeight: weight,
  }) as SvgTextStyle as never;

function renderPrim(p: Prim, i: number) {
  switch (p.k) {
    case "rect":
      return (
        <Rect
          key={i}
          x={p.x}
          y={p.y}
          width={p.w}
          height={p.h}
          rx={p.rx}
          fill={p.fill ?? "none"}
          stroke={p.stroke}
          strokeWidth={p.sw}
        />
      );
    case "line":
      return (
        <Line
          key={i}
          x1={p.x1}
          y1={p.y1}
          x2={p.x2}
          y2={p.y2}
          stroke={p.stroke}
          strokeWidth={p.sw}
        />
      );
    case "path":
      return (
        <Path
          key={i}
          d={p.d}
          fill={p.fill ?? "none"}
          stroke={p.stroke}
          strokeWidth={p.sw}
        />
      );
    case "circle":
      return (
        <Circle
          key={i}
          cx={p.cx}
          cy={p.cy}
          r={p.r}
          fill={p.fill ?? "none"}
          stroke={p.stroke}
          strokeWidth={p.sw}
        />
      );
    case "text":
      return (
        <Text
          key={i}
          x={p.x}
          y={p.y}
          fill={p.fill}
          textAnchor={p.anchor ?? "middle"}
          style={textStyle(p.size, p.weight ?? 400)}
        >
          {p.s}
        </Text>
      );
  }
}

export function ClanPosterPdf({
  doc,
  size,
  title,
}: {
  doc: PosterDoc;
  size: PosterSize;
  title: string;
}) {
  return (
    <Document title={title}>
      <Page size={size} orientation="landscape">
        <Svg width={doc.w} height={doc.h} viewBox={`0 0 ${doc.w} ${doc.h}`}>
          {doc.prims.map(renderPrim)}
        </Svg>
      </Page>
    </Document>
  );
}
