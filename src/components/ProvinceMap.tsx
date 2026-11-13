import { VN_MAP_PROVINCES, VN_MAP_VIEWBOX } from "@/lib/vnMapPaths";

import { t } from "@lingui/core/macro";
export interface MapMarker {
  id: string;
  /** Toạ độ trong viewBox của bản đồ (xem lonLatToXY / tâm tỉnh). */
  x: number;
  y: number;
  /** Chữ hiện khi rê chuột / đọc bằng trình đọc màn hình. */
  label: string;
  /** Có số thì ghim hiện số lượng (kiểu cụm của Google Maps). */
  count?: number;
  /** primary = vị trí chính xác (GPS); muted = chỉ biết tỉnh (đặt ở tâm tỉnh). */
  tone?: "primary" | "muted";
  onClick?: () => void;
}

/** Ghim giọt nước kiểu Google Maps; mũi nhọn nằm đúng ở gốc (0,0), thân nằm phía trên. */
function Pin({ m }: { m: MapMarker }) {
  const fill =
    m.tone === "muted" ? "hsl(var(--muted-foreground))" : "hsl(var(--primary))";
  const text =
    m.count != null ? (m.count > 99 ? "99+" : String(m.count)) : null;
  return (
    <g
      transform={`translate(${m.x} ${m.y}) scale(0.85)`}
      role="button"
      tabIndex={0}
      aria-label={m.label}
      onClick={(e) => {
        e.stopPropagation();
        m.onClick?.();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          m.onClick?.();
        }
      }}
      style={{
        cursor: m.onClick ? "pointer" : "default",
        filter: "drop-shadow(0 1px 1.2px rgb(0 0 0 / 0.4))",
      }}
    >
      <path
        d="M0 0C-3.5-6.5-10-11.5-10-19A10 10 0 1 1 10-19C10-11.5 3.5-6.5 0 0Z"
        fill={fill}
        stroke="#fff"
        strokeWidth="1.4"
      />
      <circle cx="0" cy="-19" r="6.2" fill="#fff" />
      {text ? (
        <text
          x="0"
          y="-16.4"
          textAnchor="middle"
          fontSize={text.length > 2 ? 6 : 7.5}
          fontWeight="700"
          fill={fill}
        >
          {text}
        </text>
      ) : (
        <circle cx="0" cy="-19" r="2.6" fill={fill} />
      )}
      <title>{m.label}</title>
    </g>
  );
}

/**
 * Bản đồ Việt Nam theo tỉnh (SVG tĩnh, không tải tile ngoài). Tô đậm theo số lượng; bấm một tỉnh để chọn.
 * Gồm quần đảo Hoàng Sa (thuộc Đà Nẵng) và Trường Sa (thuộc Khánh Hoà). Dữ liệu ranh giới:
 * thanglequoc/vietnamese-provinces-database (MIT), đã đơn giản hoá — xem scripts/gen-vn-map-paths.py.
 */
export function ProvinceMap({
  counts,
  selected,
  onSelect,
  unit,
  markers = [],
  className = "h-auto w-full",
}: {
  /** Số lượng theo mã tỉnh. Tỉnh vắng mặt = 0. */
  counts: Record<string, number>;
  selected: string | null;
  onSelect: (code: string | null) => void;
  /** Đơn vị hiện trong chú giải khi rê chuột, vd "người". */
  unit: string;
  /** Ghim kiểu Google Maps vẽ đè lên bản đồ. */
  markers?: MapMarker[];
  className?: string;
}) {
  const max = Math.max(1, ...Object.values(counts));
  return (
    <svg
      viewBox={VN_MAP_VIEWBOX}
      role="img"
      aria-label={t`Bản đồ Việt Nam theo tỉnh`}
      className={className}
      onClick={() => onSelect(null)}
    >
      {VN_MAP_PROVINCES.map((p) => {
        const n = counts[p.code] ?? 0;
        // Căn bậc hai để tỉnh ít người vẫn thấy được so với tỉnh nhiều người.
        const strength = n > 0 ? 0.3 + 0.7 * Math.sqrt(n / max) : 0;
        const isSel = selected === p.code;
        return (
          <path
            key={p.code}
            d={p.d}
            role="button"
            tabIndex={0}
            aria-label={`${p.name}: ${n} ${unit}`}
            aria-pressed={isSel}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(isSel ? null : p.code);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(isSel ? null : p.code);
              }
            }}
            style={{
              fill: n > 0 ? "hsl(var(--primary))" : "hsl(var(--muted))",
              fillOpacity: n > 0 ? strength : 0.5,
              stroke: isSel ? "hsl(var(--accent))" : "hsl(var(--border))",
              strokeWidth: isSel ? 2 : 0.6,
              cursor: "pointer",
            }}
          >
            <title>
              {p.name}: {n} {unit}
            </title>
          </path>
        );
      })}
      {/* Ghim vẽ sau cùng; sắp theo y để ghim phía dưới đè lên ghim phía trên như Google Maps. */}
      {[...markers]
        .sort((a, b) => a.y - b.y)
        .map((m) => (
          <Pin key={m.id} m={m} />
        ))}
    </svg>
  );
}
