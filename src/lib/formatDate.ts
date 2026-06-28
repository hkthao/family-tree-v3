/**
 * Định dạng timestamp ISO → dd/mm/yyyy theo vi-VN.
 * Trả về null nếu thiếu / không hợp lệ — để UI ẩn hẳn dòng thay vì in
 * "Invalid Date".
 */
export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Bản đầy đủ ngày + giờ cho tooltip (title). Null nếu không hợp lệ. */
export function formatDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("vi-VN");
}

const RELATIVE = new Intl.RelativeTimeFormat("vi", { numeric: "auto" });

/** Thang đo tương đối: [đơn vị, số giây/đơn vị]. Lớn → nhỏ. */
const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/**
 * Thời gian tương đối thân thiện theo vi-VN: "2 ngày trước", "hôm qua",
 * "3 tháng trước"… Dưới 1 phút trả "vừa xong". Null nếu không hợp lệ.
 */
export function formatRelative(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return "vừa xong";
  for (const [unit, secs] of RELATIVE_UNITS) {
    if (abs >= secs) {
      return RELATIVE.format(Math.round(diffSec / secs), unit);
    }
  }
  return "vừa xong";
}
