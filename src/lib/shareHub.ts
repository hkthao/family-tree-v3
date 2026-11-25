import { shareLinkPath, type ShareLinkRef } from "@/lib/shareUrls";

/**
 * Trung tâm chia sẻ (docs/plan-trang-dong-ho.md): gom mọi thứ dòng họ đã chia sẻ ra ngoài — link cây, QR người / mộ / di sản,
 * link mời góp (bảng share_links) và thiệp khoe (bảng card_shares) — thành một danh sách thống nhất. File này thuần (không
 * chạm mạng) để test được; phần tải dữ liệu nằm ở lib/queries/share-hub.ts.
 */

export type HubKind =
  "tree" | "person" | "grave" | "heritage" | "contribute" | "card";
export const HUB_KINDS: HubKind[] = [
  "tree",
  "person",
  "grave",
  "heritage",
  "contribute",
  "card",
];

export type HubStatus = "active" | "expiring" | "expired" | "revoked";

/** Link còn dưới ngần này ngày thì báo "sắp hết hạn". */
export const EXPIRING_DAYS = 7;

export interface HubLinkRow {
  id: string;
  token: string;
  scope: string;
  root_person_id: string | null;
  root_resting_place_id: string | null;
  root_heritage_item_id: string | null;
  recipient_label: string | null;
  expires_at: string;
  is_revoked: boolean;
  created_at: string;
}
export interface HubCardRow {
  id: string;
  token: string;
  title: string;
  subtitle: string | null;
  expires_at: string;
  created_at: string;
  view_count: number;
}

export interface HubItem {
  /** `link:<id>` hoặc `card:<id>` — duy nhất trong danh sách. */
  key: string;
  source: "link" | "card";
  id: string;
  kind: HubKind;
  title: string;
  subtitle: string;
  token: string;
  /** Đường dẫn tương đối, vd /share/<token>/nguoi/<id>. */
  path: string;
  createdAt: string;
  expiresAt: string;
  revoked: boolean;
  /** null = loại này không đếm lượt xem. */
  views: number | null;
}

export const kindOfScope = (scope: string): HubKind | null => {
  switch (scope) {
    case "tree_view":
      return "tree";
    case "single_person":
      return "person";
    case "resting_place":
      return "grave";
    case "heritage_item":
      return "heritage";
    case "contribute":
      return "contribute";
    default:
      return null;
  }
};

export function daysUntil(iso: string, now = Date.now()): number {
  return Math.ceil((new Date(iso).getTime() - now) / 86_400_000);
}

export function hubStatus(
  expiresAt: string,
  revoked: boolean,
  now = Date.now(),
): HubStatus {
  if (revoked) return "revoked";
  const d = daysUntil(expiresAt, now);
  if (new Date(expiresAt).getTime() <= now) return "expired";
  return d <= EXPIRING_DAYS ? "expiring" : "active";
}

export interface HubNames {
  persons: Map<string, string>;
  places: Map<string, string>;
  heritage: Map<string, string>;
}

export function buildHubItems(
  links: HubLinkRow[],
  cards: HubCardRow[],
  names: HubNames,
  labels: {
    tree: string;
    treeSub: string;
    contributeSub: string;
    person: string;
    place: string;
    item: string;
    contribute: string;
    personSub: string;
    placeSub: string;
    heritageSub: string;
    cardSub: string;
  },
): HubItem[] {
  const items: HubItem[] = [];
  for (const l of links) {
    const kind = kindOfScope(l.scope);
    if (!kind) continue; // scope lạ: không hiện (không biết cách mở / thu hồi an toàn)
    const ref: ShareLinkRef = l;
    let title = labels.tree;
    let subtitle = labels.treeSub;
    if (kind === "person")
      ((title = names.persons.get(l.root_person_id ?? "") ?? labels.person),
        (subtitle = labels.personSub));
    if (kind === "grave")
      ((title =
        names.places.get(l.root_resting_place_id ?? "") ?? labels.place),
        (subtitle = labels.placeSub));
    if (kind === "heritage")
      ((title =
        names.heritage.get(l.root_heritage_item_id ?? "") ?? labels.item),
        (subtitle = labels.heritageSub));
    if (kind === "contribute")
      ((title = l.recipient_label?.trim() || labels.contribute),
        (subtitle = labels.contributeSub));
    items.push({
      key: `link:${l.id}`,
      source: "link",
      id: l.id,
      kind,
      title,
      subtitle,
      token: l.token,
      path: shareLinkPath(ref),
      createdAt: l.created_at,
      expiresAt: l.expires_at,
      revoked: l.is_revoked,
      views: null,
    });
  }
  for (const c of cards) {
    items.push({
      key: `card:${c.id}`,
      source: "card",
      id: c.id,
      kind: "card",
      title: c.title,
      subtitle: c.subtitle?.trim() || labels.cardSub,
      token: c.token,
      path: `/khoe/${c.token}`,
      createdAt: c.created_at,
      expiresAt: c.expires_at,
      revoked: false,
      views: c.view_count,
    });
  }
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type StatusFilter = "active" | "all" | "ended";

export interface HubFilter {
  kind: HubKind | "all";
  status: StatusFilter;
  search: string;
}

const fold = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");

/** `active` = còn dùng được (kể cả sắp hết hạn); `ended` = đã hết hạn hoặc thu hồi. */
export function filterHubItems(
  items: HubItem[],
  f: HubFilter,
  now = Date.now(),
): HubItem[] {
  const q = fold(f.search.trim());
  return items.filter((i) => {
    if (f.kind !== "all" && i.kind !== f.kind) return false;
    const st = hubStatus(i.expiresAt, i.revoked, now);
    const live = st === "active" || st === "expiring";
    if (f.status === "active" && !live) return false;
    if (f.status === "ended" && live) return false;
    if (q && !fold(`${i.title} ${i.subtitle}`).includes(q)) return false;
    return true;
  });
}

export interface HubStats {
  active: number;
  total: number;
  expiring: number;
  /** Tổng lượt xem của thiệp khoe. */
  cardViews: number;
}

export function hubStats(items: HubItem[], now = Date.now()): HubStats {
  let active = 0;
  let expiring = 0;
  let cardViews = 0;
  for (const i of items) {
    const st = hubStatus(i.expiresAt, i.revoked, now);
    if (st === "active" || st === "expiring") active++;
    if (st === "expiring") expiring++;
    cardViews += i.views ?? 0;
  }
  return { active, total: items.length, expiring, cardViews };
}

/** Hạn mới khi gia hạn thêm `days` ngày: tính từ hạn cũ nếu còn, từ bây giờ nếu đã hết. */
export function extendedExpiry(
  currentIso: string,
  days: number,
  now = Date.now(),
): string {
  const base = Math.max(new Date(currentIso).getTime(), now);
  return new Date(base + days * 86_400_000).toISOString();
}

export const hubItemUrl = (origin: string, i: Pick<HubItem, "path">): string =>
  `${origin.replace(/\/+$/, "")}${i.path}`;
