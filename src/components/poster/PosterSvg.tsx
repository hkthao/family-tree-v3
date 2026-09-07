import type { PosterDoc } from "@/lib/poster/buildPoster";
import type { Prim } from "@/lib/poster/prims";

/**
 * Xem trước bảng gia phả trên màn hình.
 *
 * Không tự tính gì cả — đọc đúng danh sách nguyên thuỷ mà bản PDF cũng
 * đọc, nên thấy sao là in ra vậy. Đó là toàn bộ lý do tách tầng nguyên
 * thuỷ ra: người ta sẽ đem tấm này ra tiệm in khổ A1, sai một chi tiết
 * là mất tiền in lại.
 */

function renderPrim(p: Prim, i: number) {
  switch (p.k) {
    case "rect":
      return (
        <rect
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
        <line
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
        <path
          key={i}
          d={p.d}
          fill={p.fill ?? "none"}
          stroke={p.stroke}
          strokeWidth={p.sw}
        />
      );
    case "circle":
      return (
        <circle
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
        <text
          key={i}
          x={p.x}
          y={p.y}
          fill={p.fill}
          fontSize={p.size}
          fontWeight={p.weight ?? 400}
          textAnchor={p.anchor ?? "middle"}
        >
          {p.s}
        </text>
      );
  }
}

export function PosterSvg({
  doc,
  className,
}: {
  doc: PosterDoc;
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${doc.w} ${doc.h}`}
      className={className}
      role="img"
      aria-label="Xem trước bảng gia phả"
    >
      {doc.prims.map(renderPrim)}
    </svg>
  );
}
