import { VN_MAP_PROVINCES, VN_MAP_VIEWBOX } from "@/lib/vnMapPaths";

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
}: {
  /** Số lượng theo mã tỉnh. Tỉnh vắng mặt = 0. */
  counts: Record<string, number>;
  selected: string | null;
  onSelect: (code: string | null) => void;
  /** Đơn vị hiện trong chú giải khi rê chuột, vd "người". */
  unit: string;
}) {
  const max = Math.max(1, ...Object.values(counts));
  return (
    <svg
      viewBox={VN_MAP_VIEWBOX}
      role="img"
      aria-label="Bản đồ Việt Nam theo tỉnh"
      className="h-auto w-full"
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
    </svg>
  );
}
