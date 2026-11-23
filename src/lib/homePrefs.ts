/**
 * Tuỳ chọn TRANG CHỦ của từng người dùng (lưu trên máy, localStorage): ghim ô "Thao tác nhanh", ẩn thẻ không cần,
 * và đếm số lần bấm từng ô để tự xếp những ô mình hay dùng lên trước.
 *
 * Vì sao localStorage: tuỳ chọn là chuyện giao diện của MỘT thiết bị, không cần migration; sau này muốn đồng bộ theo
 * tài khoản chỉ cần đổi hai hàm đọc/ghi ở đây. Hỏng/đầy bộ nhớ thì app vẫn chạy với mặc định.
 */

const KEY = "family-tree:home-prefs-v1";

export interface HomePrefs {
  /** Khoá các ô người dùng GHIM, theo thứ tự. `null` = chưa tuỳ chỉnh → dùng thứ tự mặc định + tự học theo lượt bấm. */
  pins: string[] | null;
  /** Khoá các thẻ ở trang chủ bị ẩn. */
  hidden: string[];
  /** Số lần bấm từng ô Thao tác nhanh (tự học). */
  counts: Record<string, number>;
}

export const EMPTY_PREFS: HomePrefs = { pins: null, hidden: [], counts: {} };

/** Các thẻ của trang chủ mà người dùng được phép ẩn/hiện (khoá bền, KHÔNG đổi). */
export const HOME_CARD_KEYS = [
  "today",
  "community",
  "nextstep",
  "stats",
  "map",
  "timeline",
  "quick",
  "profile",
  "photos",
  "completion",
  "podcast",
  "activity",
] as const;
export type HomeCardKey = (typeof HOME_CARD_KEYS)[number];

export function readHomePrefs(): HomePrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_PREFS;
    const o = JSON.parse(raw) as Partial<HomePrefs>;
    return {
      pins: Array.isArray(o.pins) ? o.pins.filter((x) => typeof x === "string") : null,
      hidden: Array.isArray(o.hidden) ? o.hidden.filter((x) => typeof x === "string") : [],
      counts:
        o.counts && typeof o.counts === "object" && !Array.isArray(o.counts)
          ? Object.fromEntries(
              Object.entries(o.counts).filter(([, v]) => typeof v === "number"),
            )
          : {},
    };
  } catch {
    return EMPTY_PREFS;
  }
}

export function writeHomePrefs(p: HomePrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode / hết chỗ — tuỳ chọn chỉ có tác dụng trong phiên này */
  }
}

export interface QuickOrderable {
  key: string;
  /** Ô thuộc nhóm lõi: luôn đứng đầu khi chưa ghim. */
  core?: boolean;
}

/**
 * Chọn và xếp các ô Thao tác nhanh, tối đa `max` ô.
 *  - Đã ghim: đúng các ô đã ghim theo thứ tự ghim (ô nào người đó không còn quyền/tính năng đã tắt thì bỏ), KHÔNG
 *    tự thêm ô khác — người dùng đã chọn thì tôn trọng lựa chọn đó.
 *  - Chưa ghim: ô lõi trước (giữ thứ tự khai báo), rồi tới các ô còn lại xếp theo SỐ LẦN BẤM giảm dần
 *    (bằng nhau thì giữ thứ tự ưu tiên mặc định) — app tự học mình hay dùng gì.
 */
export function orderQuick<T extends QuickOrderable>(
  available: T[],
  prefs: Pick<HomePrefs, "pins" | "counts">,
  max: number,
): T[] {
  if (prefs.pins) {
    const byKey = new Map(available.map((a) => [a.key, a]));
    const out: T[] = [];
    for (const k of prefs.pins) {
      const item = byKey.get(k);
      if (item && !out.includes(item)) out.push(item);
    }
    return out.slice(0, max);
  }
  const core = available.filter((a) => a.core);
  const rest = available
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => !a.core)
    .sort(
      (x, y) =>
        (prefs.counts[y.a.key] ?? 0) - (prefs.counts[x.a.key] ?? 0) || x.i - y.i,
    )
    .map(({ a }) => a);
  return [...core, ...rest].slice(0, max);
}
