/**
 * Đánh dấu "Mới" cho tính năng vừa ra, để người dùng cũ tự phát hiện mà không cần popup/tour.
 *
 * Mỗi mục có `since`; chỉ hiện trong NEW_WINDOW_DAYS ngày kể từ đó và chỉ tới khi người dùng đã MỞ trang đó
 * (xem rồi là coi như biết). Trạng thái "đã xem" lưu ở localStorage của thiết bị — giống tuỳ chỉnh trang chủ.
 * Ra tính năng mới: thêm một dòng vào NEW_FEATURES (phần đường dẫn sau `/clans/:id/`), xoá dòng cũ khi hết hạn.
 */
export interface NewFeature {
  /** Đoạn đường dẫn sau `/clans/:clanId/`, vd "mosaics". */
  path: string;
  /** Ngày phát hành, YYYY-MM-DD. */
  since: string;
}

export const NEW_FEATURES: NewFeature[] = [
  { path: "chia-se", since: "2026-11-25" },
  { path: "dong-gop", since: "2026-11-21" },
  { path: "ket-noi-ai", since: "2026-11-16" },
  { path: "relations", since: "2026-11-12" },
  { path: "mosaics", since: "2026-11-11" },
  { path: "map", since: "2026-11-06" },
];

export const NEW_WINDOW_DAYS = 30;
const KEY = "family-tree:new-seen";

let seen: Set<string> | null = null;
const listeners = new Set<() => void>();
let snapshot = "";

function load(): Set<string> {
  if (seen) return seen;
  try {
    const raw = localStorage.getItem(KEY);
    seen = new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    seen = new Set();
  }
  snapshot = [...seen].sort().join(",");
  return seen;
}

/** Đoạn đầu của đường dẫn trang con, vd "/clans/abc/mosaics/xyz" → "mosaics". */
export function featurePathOf(pathname: string): string | null {
  const m = pathname.match(/^\/clans\/[^/]+\/([^/?#]+)/);
  return m ? m[1] : null;
}

export function isNewFeaturePath(
  path: string | null,
  now: Date = new Date(),
  seenSet: ReadonlySet<string> = load(),
): boolean {
  if (!path || seenSet.has(path)) return false;
  const f = NEW_FEATURES.find((x) => x.path === path);
  if (!f) return false;
  const age =
    (now.getTime() - new Date(f.since + "T00:00:00").getTime()) / 86_400_000;
  return age >= 0 && age <= NEW_WINDOW_DAYS;
}

export function markNewSeen(path: string | null): void {
  if (!path || !NEW_FEATURES.some((x) => x.path === path)) return;
  const s = load();
  if (s.has(path)) return;
  s.add(path);
  snapshot = [...s].sort().join(",");
  try {
    localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    /* lưu không được thì thôi — chỉ mất trạng thái "đã xem" */
  }
  listeners.forEach((l) => l());
}

export function subscribeNewSeen(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function getNewSeenSnapshot(): string {
  load();
  return snapshot;
}

/** Cho test. */
export function __resetNewSeen(): void {
  seen = null;
  snapshot = "";
  listeners.clear();
}

// ── "Có gì mới": tin cập nhật công khai mới hơn lần người dùng mở /changelog ──
const CHANGELOG_KEY = "family-tree:changelog-seen";

export function getChangelogSeen(): string {
  try {
    return localStorage.getItem(CHANGELOG_KEY) ?? "";
  } catch {
    return "";
  }
}

/** So sánh ISO string; chưa từng mở lần nào (rỗng) thì coi như có tin mới nếu có tin. */
export function hasUnreadChangelog(
  latestPublishedAt: string | null | undefined,
  seenAt: string,
): boolean {
  if (!latestPublishedAt) return false;
  return !seenAt || latestPublishedAt > seenAt;
}

export function markChangelogSeen(
  latestPublishedAt: string | null | undefined,
): void {
  if (!latestPublishedAt) return;
  try {
    localStorage.setItem(CHANGELOG_KEY, latestPublishedAt);
  } catch {
    /* bỏ qua */
  }
  listeners.forEach((l) => l());
}
