"""
Sinh src/lib/vnMapPaths.ts (đường SVG 34 tỉnh/thành) từ GeoJSON ranh giới tỉnh của bộ dữ liệu
thanglequoc/vietnamese-provinces-database (MIT), thư mục json/geojson/<mã>_<tên>/<mã>_<tên>.geojson.

Chạy:  python3 -I scripts/gen-vn-map-paths.py <thư-mục-geojson> [đường-dẫn-ra]

Chiếu bằng equirectangular (nhân cos vĩ độ giữa), đơn giản hoá Douglas-Peucker, làm tròn 1 số lẻ.
Quần đảo Hoàng Sa (thuộc Đà Nẵng) và Trường Sa (thuộc Khánh Hoà) nằm trong chính hình của hai tỉnh đó;
đảo quá nhỏ sau đơn giản hoá được vẽ lại thành một chấm để không biến mất.
"""
import glob, json, math, os, sys

SRC = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else "src/lib/vnMapPaths.ts"
TOL = 0.012          # độ — dung sai đơn giản hoá (~1,3 km)
W = 600.0            # bề rộng viewBox

def dp(pts, tol):
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        n = math.hypot(dx, dy)
        idx, md = -1, 0.0
        for i in range(a + 1, b):
            px, py = pts[i]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / n if n else math.hypot(px - ax, py - ay)
            if d > md:
                idx, md = i, d
        if md > tol and idx != -1:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]

def ring_area(r):
    s = 0.0
    for (x1, y1), (x2, y2) in zip(r, r[1:] + r[:1]):
        s += x1 * y2 - x2 * y1
    return abs(s) / 2

provs = []
for f in sorted(glob.glob(os.path.join(SRC, "*", "*.geojson"))):
    feat = json.load(open(f))
    feat = feat["features"][0] if feat.get("type") == "FeatureCollection" else feat
    p = feat["properties"]
    polys = feat["geometry"]["coordinates"]  # MultiPolygon -> [polygon][ring][pt]
    provs.append((p["code"], p["name"], [[ring for ring in poly] for poly in polys]))

lons = [pt[0] for _, _, polys in provs for poly in polys for ring in poly for pt in ring]
lats = [pt[1] for _, _, polys in provs for poly in polys for ring in poly for pt in ring]
lon0, lon1, lat0, lat1 = min(lons), max(lons), min(lats), max(lats)
k = math.cos(math.radians((lat0 + lat1) / 2))
scale = W / ((lon1 - lon0) * k)
H = round((lat1 - lat0) * scale, 1)

def proj(pt):
    return ((pt[0] - lon0) * k * scale, (lat1 - pt[1]) * scale)

def fmt(v):
    s = f"{v:.1f}"
    return s[:-2] if s.endswith(".0") else s

out = []
total = 0
for code, name, polys in provs:
    d = []
    cx = cy = area_sum = 0.0
    for poly in polys:
        outer = [proj(pt) for pt in poly[0]]
        a = ring_area(outer)
        # tolerance theo đơn vị đã chiếu
        tol = TOL * scale
        simp = dp(outer[:-1] if outer[0] == outer[-1] else outer, tol)
        if len(simp) < 3 or ring_area(simp) < 0.3:
            # đảo nhỏ: vẽ thành chấm tại tâm hình bao
            xs = [p[0] for p in outer]; ys = [p[1] for p in outer]
            x, y = sum(xs) / len(xs), sum(ys) / len(ys)
            d.append(f"M{fmt(x - 0.7)} {fmt(y)}l0.7 -0.7l0.7 0.7l-0.7 0.7z")
            continue
        total += len(simp)
        d.append("M" + "L".join(f"{fmt(x)} {fmt(y)}" for x, y in simp) + "Z")
        if a > area_sum:  # tâm = tâm hình bao của mảnh lớn nhất (đủ cho nhãn/chấm)
            area_sum = a
            xs = [p[0] for p in simp]; ys = [p[1] for p in simp]
            cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    out.append((code, name, "".join(d), cx, cy))

lines = [
    "// SINH TỰ ĐỘNG bởi scripts/gen-vn-map-paths.py — đừng sửa tay.",
    "// Ranh giới 34 tỉnh/thành (hệ 2 cấp từ 01/07/2025) từ thanglequoc/vietnamese-provinces-database (MIT),",
    "// đã đơn giản hoá. Gồm quần đảo Hoàng Sa (Đà Nẵng) và Trường Sa (Khánh Hoà).",
    f'export const VN_MAP_VIEWBOX = "0 0 {fmt(W)} {fmt(H)}";',
    "",
    "export interface VnMapProvince {",
    "  code: string;",
    "  name: string;",
    "  d: string;",
    "  /** Tâm hình bao của mảnh lớn nhất — để đặt nhãn / chấm. */",
    "  cx: number;",
    "  cy: number;",
    "}",
    "",
    "export const VN_MAP_PROVINCES: VnMapProvince[] = [",
]
for code, name, d, cx, cy in out:
    lines.append(f'  {{ code: {json.dumps(code)}, name: {json.dumps(name, ensure_ascii=False)}, d: {json.dumps(d)}, cx: {round(cx,1)}, cy: {round(cy,1)} }},')
lines.append("];")
open(OUT, "w").write("\n".join(lines) + "\n")
print(f"{len(out)} tỉnh, {total} điểm, viewBox 0 0 {W:g} {H}, {os.path.getsize(OUT)/1024:.0f} KB -> {OUT}")
