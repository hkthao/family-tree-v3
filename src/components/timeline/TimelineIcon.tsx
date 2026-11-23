import type { TimelineIconKey } from "@/lib/timeline/eras";

import { t } from "@lingui/core/macro";

/**
 * Bộ minh hoạ dòng thời gian — MỘT phong cách duy nhất (nét 1.6px, bo tròn, 24×24) cho mọi mốc và thẻ
 * bối cảnh, để poster nhìn đồng bộ. Thêm hình mới: thêm khoá vào `TimelineIconKey` rồi thêm nét vào đây.
 */
const PATHS: Record<TimelineIconKey, string[]> = {
  tree: [
    "M12 21v-6",
    "M12 15c-4 0-7-2.6-7-6.2a7 7 0 0 1 14 0C19 12.4 16 15 12 15z",
    "M12 18l3-3",
    "M12 16l-3-3",
  ],
  cradle: [
    "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z",
    "M9 10.5h.01",
    "M15 10.5h.01",
    "M9.2 14.2c1.6 1.4 4 1.4 5.6 0",
    "M12 4c1 1.2 2 1.4 3 1",
  ],
  family: [
    "M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
    "M17 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
    "M12 12.5a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z",
    "M3 19c0-3 1.8-5 4-5s4 2 4 5",
    "M13 19c0-3 1.8-5 4-5s4 2 4 5",
    "M9 20c0-2.2 1.3-3.8 3-3.8s3 1.6 3 3.8",
  ],
  candle: [
    "M12 3c1.6 2 1.6 3.6 0 5-1.6-1.4-1.6-3 0-5z",
    "M9 10h6v10H9z",
    "M7 20h10",
  ],
  citadel: [
    "M4 20V10l8-5 8 5v10",
    "M9 20v-5a3 3 0 0 1 6 0v5",
    "M3 20h18",
    "M12 5V3",
  ],
  scroll: [
    "M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 0 2 2H9a2 2 0 0 1-2-2V4z",
    "M7 4a2 2 0 0 0-2 2v1h2",
    "M10 9h6",
    "M10 13h6",
  ],
  sword: ["M20 4L9 15", "M7 13l4 4", "M8 16l-4 4", "M20 4l-4 .5L19.5 8z"],
  boat: ["M3 15h18l-2 5H5z", "M12 15V4", "M12 5l6 8h-6", "M12 7L7 13h5"],
  banner: ["M6 21V4", "M6 5h12l-2 4 2 4H6"],
  book: ["M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z", "M8 7h7"],
  rice: [
    "M12 21V9",
    "M12 9c-3 0-4-2-4-4 3 0 4 2 4 4z",
    "M12 9c3 0 4-2 4-4-3 0-4 2-4 4z",
    "M12 14c-3 0-4-2-4-4",
    "M12 14c3 0 4-2 4-4",
  ],
  bicycle: [
    "M6 20.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
    "M18 20.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
    "M6 17l4-8h5l3 8",
    "M10 9l3 8",
    "M9 7h3",
  ],
  radio: [
    "M5 8h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z",
    "M15 14a3 3 0 1 0 0 .01",
    "M7 12h3",
    "M7 15h3",
    "M7 8l9-5",
  ],
  phone: [
    "M9 2h6a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z",
    "M11 18h2",
  ],
  ring: [
    "M12 20a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
    "M9 7l3-4 3 4-3 3z",
  ],
};

/** Nét vẽ của từng icon (24×24) — TimelineScene dùng lại để vẽ biểu tượng lớn trong cảnh minh hoạ. */
export const TIMELINE_ICON_PATHS = PATHS;

export const TIMELINE_ICON_KEYS = Object.keys(PATHS) as TimelineIconKey[];

/** Tên gọi ngắn của từng hình (hiện dưới hình khi chọn — người lớn tuổi nhìn chữ dễ hơn nhìn nét). */
export function timelineIconLabel(k: TimelineIconKey): string {
  switch (k) {
    case "tree":
      return t`Cây`;
    case "cradle":
      return t`Em bé`;
    case "family":
      return t`Gia đình`;
    case "candle":
      return t`Tưởng nhớ`;
    case "citadel":
      return t`Thành`;
    case "scroll":
      return t`Văn thư`;
    case "sword":
      return t`Chiến trận`;
    case "boat":
      return t`Thuyền`;
    case "banner":
      return t`Cờ`;
    case "book":
      return t`Sách`;
    case "rice":
      return t`Lúa`;
    case "bicycle":
      return t`Xe đạp`;
    case "radio":
      return t`Radio`;
    case "phone":
      return t`Điện thoại`;
    case "ring":
      return t`Hôn lễ`;
  }
}

export function TimelineIcon({
  name,
  className,
}: {
  name: TimelineIconKey;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
