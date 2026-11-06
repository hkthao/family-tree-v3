import { VN_MAP_PROJECTION } from "@/lib/vnMapPaths";

/** Kinh/vĩ độ → toạ độ trong viewBox của bản đồ. Ngoài khung bản đồ (vd toạ độ nhập sai) thì trả null. */
export function lonLatToXY(lon: number, lat: number): { x: number; y: number } | null {
  const { lon0, lat1, lon1, lat0, k, scale } = VN_MAP_PROJECTION;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (lon < lon0 || lon > lon1 || lat < lat0 || lat > lat1) return null;
  return { x: (lon - lon0) * k * scale, y: (lat1 - lat) * scale };
}
