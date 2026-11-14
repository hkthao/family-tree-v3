import { t } from "@lingui/core/macro";
// Mascot tip catalogue. Static — bumping the list ships in a new
// build, no admin UI. Each tip's `when()` predicate decides
// eligibility; the runtime in `useMascotTip` then layers seen-ids,
// global cooldown, and mute on top before actually popping.
//
// Anti-banner-blindness rules live in the runtime, not here — tips
// just declare their preconditions. See plan.md §31.

export interface TipContext {
  /** From useLocation().pathname. */
  route: string;
  /** Build-time `__APP_VERSION__`. */
  appVersion: string;
  /** Whatever was in localStorage last app load — empty on first visit. */
  lastSeenVersion: string;
  /**
   * Coarse "user is inside a clan" check derived from `route` —
   * matches `/clans/<uuid>/...`. Capturing the id here lets tips
   * point their action button at the right place.
   */
  clanId: string | null;
  /** ms since the user's first session started. Drives "after N min". */
  sessionAgeMs: number;
  /** How many tips this user has already dismissed. Drives `mute-mascot`. */
  seenCount: number;
}

export interface TipAction {
  label: string;
  /** Absolute path. Optional — tip can be informational only. */
  to: string;
}

export interface Tip {
  /** Stable id, lives in localStorage seenIds. NEVER rename — that
   *  would re-show the tip to users who've already dismissed it. */
  id: string;
  title: string;
  body: string;
  when: (ctx: TipContext) => boolean;
  action?: (ctx: TipContext) => TipAction | undefined;
  /** Higher = pops first when multiple are eligible. Default 0. */
  priority?: number;
}

const CLAN_ROUTE_RE = /^\/clans\/([0-9a-f-]{36})/i;

function isOnClanRoute(route: string): boolean {
  return CLAN_ROUTE_RE.test(route);
}

/** Gọi lúc dùng (không phải lúc nạp module) để chữ theo ngôn ngữ đang chọn. */
export const getTipCatalogue = (): Tip[] => [
  {
    id: "welcome-new-user",
    title: t`Bạn đã tạo dòng họ chưa?`,
    body: t`Bắt đầu bằng cách tạo gia phả của bạn — chỉ vài bước.`,
    when: (c) => c.route === "/clans" || c.route === "/clans/",
    action: () => ({ label: t`Tạo dòng họ`, to: "/clans/new" }),
    priority: 10,
  },
  {
    id: "tree-add-root",
    title: t`Bắt đầu từ Thuỷ tổ`,
    body: t`Trên cây gia phả, người đầu tiên cần thêm là Thuỷ tổ (đời 1).`,
    when: (c) => c.route.endsWith("/tree"),
    action: (c) =>
      c.clanId
        ? { label: t`Thêm người`, to: `/clans/${c.clanId}/people/new` }
        : undefined,
  },
  {
    id: "try-can-chi",
    title: t`Không nhớ năm dương?`,
    body: t`Khi nhập ngày sinh / mất, có thể bấm 'Nhập theo can-chi' để gõ 'Bính Thìn' — app sẽ tự đổi sang năm dương.`,
    when: (c) => /\/people\/.+\/edit$/.test(c.route) || /\/people\/new$/.test(c.route),
  },
  {
    id: "try-quick-add",
    title: t`Thêm con / vợ-chồng nhanh`,
    body: t`Trên cây, bấm dấu + ở góc card — sheet thêm người mở ngay không phải rời cây.`,
    when: (c) => c.route.endsWith("/tree"),
  },
  {
    id: "try-lunar",
    title: t`Có ngày âm?`,
    body: t`Tombstone ghi ngày âm — bấm 'Nhập theo lịch Âm' khi sửa người.`,
    when: (c) => /\/people\/.+\/edit$/.test(c.route),
  },
  {
    id: "try-share-tree",
    title: t`Chia sẻ cây với họ hàng`,
    body: t`Trên trang cây, bấm 'Chia sẻ' để tạo link người trong họ xem được.`,
    when: (c) => c.route.endsWith("/tree"),
  },
  {
    id: "try-todo",
    title: t`Có việc cần làm`,
    body: t`Trang 'Việc cần làm' tự dò chỗ thiếu năm sinh / cha mẹ — cả họ cùng bổ sung dần.`,
    when: (c) => isOnClanRoute(c.route),
    action: (c) =>
      c.clanId ? { label: t`Xem việc`, to: `/clans/${c.clanId}/todo` } : undefined,
  },
  {
    id: "try-import",
    title: t`Có sẵn file Excel?`,
    body: t`Nếu đã có danh sách trong Excel, có thể nhập hàng loạt thay vì gõ từng người.`,
    when: (c) => isOnClanRoute(c.route),
    action: (c) =>
      c.clanId
        ? { label: t`Nhập Excel`, to: `/clans/${c.clanId}/import` }
        : undefined,
  },
  {
    id: "feedback-button",
    title: t`Gặp lỗi? Nói cho biết.`,
    body: t`Bấm nút 'Góp ý' ở góc dưới phải — chúng tôi đọc hết, kể cả 1 dòng.`,
    when: (c) => c.sessionAgeMs > 5 * 60_000, // sau 5 phút dùng
  },
  {
    id: "app-updated",
    title: t`App vừa cập nhật`,
    body: t`Phiên bản mới đã sẵn sàng. Tải lại trang để áp dụng.`,
    when: (c) =>
      !!c.lastSeenVersion &&
      c.lastSeenVersion !== "" &&
      c.lastSeenVersion !== c.appVersion,
    priority: 20, // ưu tiên update notification
  },
  {
    id: "mute-mascot",
    title: t`Không muốn xem gợi ý?`,
    body: t`Bạn có thể tắt linh vật ở /account — chúng tôi sẽ ngừng nhắc.`,
    when: (c) => c.seenCount >= 5,
    action: () => ({ label: t`Cài đặt`, to: "/account" }),
    priority: -10, // pop sau cùng, chỉ khi đã đủ tip khác
  },
];
