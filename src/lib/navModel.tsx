import { useCallback, useState, type ReactNode } from "react";

import {
  IconAward,
  IconBell,
  IconBook,
  IconBuildings,
  IconCalendar,
  IconCamera,
  IconGlobe,
  IconGrave,
  IconHome,
  IconLink,
  IconList,
  IconMail,
  IconPencil,
  IconScroll,
  IconSettings,
  IconShield,
  IconSparkles,
  IconSun,
  IconTree,
  IconUserPlus,
  IconUsers,
  IconWallet,
} from "@/components/icons";
import { isFeatureEnabled, type ClanFeatureKey } from "@/lib/clanFeatures";
import type { ClanDetail } from "@/lib/queries/clan-detail";
import type { MyProfile } from "@/lib/queries/profile";

/**
 * MÔ HÌNH MENU — tách khỏi AppDrawer để test được.
 *
 * Không phải chia file cho đẹp: AppDrawer kéo theo cả chuỗi PWA
 * (`virtual:pwa-register`) mà môi trường test không nạp nổi, nên logic
 * menu nằm chung ở đó là logic không ai kiểm được. Mà đây lại đúng là
 * thứ vỡ theo kiểu im lặng: một mục hiện nhầm cho người không có quyền,
 * một nhóm gập nuốt mất badge việc-cần-làm.
 *
 * File .tsx vì mỗi mục mang sẵn icon.
 */

/** Badge quá 99 thì hiện "99+" — số dài làm vỡ hàng menu. */
function formatBadge(n: number): string {
  return n > 99 ? "99+" : String(n);
}

// ---------------------------------------------------------------------------
// Nhóm gập được

const COLLAPSE_KEY = "drawer:sections";

/**
 * Lựa chọn đã lưu: id nhóm → đang mở hay không.
 *
 * Cố tình lưu CẢ HAI trạng thái chứ không chỉ danh sách "đang gập". Bản
 * đầu tôi lưu tập đang-gập, và nó sai ngay ở nhóm mặc định đóng: nhóm
 * đó không nằm trong tập, nên cú bấm đầu tiên lại ĐƯA NÓ VÀO tập —
 * người dùng bấm "mở" mà nhóm vẫn đóng, bấm mãi không ra.
 */
function readState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    const obj = raw ? (JSON.parse(raw) as unknown) : {};
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        k,
        v === true,
      ]),
    );
  } catch {
    return {};
  }
}

/**
 * Nhóm nào đang mở.
 *
 * Ba luật, theo đúng thứ tự ưu tiên:
 *  1. Nhóm không gập được thì luôn mở.
 *  2. **Nhóm chứa trang đang xem luôn mở** — kể cả người dùng đã gập nó.
 *     Nếu không thì bấm vào một trang rồi thấy menu không sáng chỗ nào,
 *     và người ta tưởng mình lạc.
 *  3. Còn lại: theo lựa chọn đã lưu; chưa chọn bao giờ thì theo
 *     `defaultOpen`.
 */
export function useCollapsedSections(pathname: string) {
  const [state, setState] = useState<Record<string, boolean>>(readState);

  const isOpenById = useCallback(
    (section: DrawerSection) => {
      const saved = state[section.id];
      return saved === undefined ? section.defaultOpen ?? true : saved;
    },
    [state],
  );

  const toggle = useCallback(
    (section: DrawerSection) => {
      setState((prev) => {
        const cur =
          prev[section.id] === undefined
            ? section.defaultOpen ?? true
            : prev[section.id];
        const next = { ...prev, [section.id]: !cur };
        try {
          localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
        } catch {
          /* hết chỗ lưu thì thôi, không đáng chặn điều hướng */
        }
        return next;
      });
    },
    [],
  );

  const isOpen = useCallback(
    (section: DrawerSection) => {
      if (section.collapsible === false) return true;
      if (sectionHasPath(section, pathname)) return true;
      return isOpenById(section);
    },
    [isOpenById, pathname],
  );

  return { isOpen, toggle };
}

/** Trang đang xem có nằm trong nhóm này không (bỏ qua query string). */
export function sectionHasPath(
  section: DrawerSection,
  pathname: string,
): boolean {
  return section.items.some((item) => {
    const path = item.to.split("?")[0];
    if (!path.startsWith("/")) return false;
    if (item.end) return pathname === path;
    return pathname === path || pathname.startsWith(`${path}/`);
  });
}

/** Tổng badge của một nhóm, để hiện ra ngoài khi nhóm đang gập. */
export function sectionBadge(section: DrawerSection): number | undefined {
  let total = 0;
  for (const item of section.items) {
    const b = item.badge;
    if (typeof b === "number") total += b;
    // Badge dạng chuỗi ("99+") thì không cộng được, coi như có việc.
    else if (typeof b === "string") total += 1;
  }
  return total > 0 ? total : undefined;
}

/**
 * Mục quản trị trỏ tới `/admin?tab=x`, mà NavLink chỉ so sánh đường dẫn
 * nên bốn mục cùng `/admin` sẽ sáng cùng lúc. So thêm query để đúng một
 * mục sáng.
 */
export function isTabActive(
  to: string,
  location: { pathname: string; search: string },
): boolean {
  const [path, query] = to.split("?");
  if (!query || path !== location.pathname) return false;
  const want = new URLSearchParams(query).get("tab");
  return !!want && new URLSearchParams(location.search).get("tab") === want;
}

// ---------------------------------------------------------------------------

export interface DrawerItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
  /** Optional pill rendered after the label — e.g. pending count. */
  badge?: string | number;
  /**
   * Mục MỞ HỘP THOẠI thay vì điều hướng (hiện chỉ có Góp ý). Vẫn để
   * `to` làm khoá React, nhưng render ra nút chứ không phải link.
   */
  kind?: "feedback";
}

export interface DrawerSection {
  /** Khoá bền để nhớ trạng thái gập. KHÔNG dùng label — label đổi theo
   *  tên dòng họ, mà người dùng thì không mong trạng thái gập reset khi
   *  họ đổi tên dòng họ. */
  id: string;
  label: string;
  items: DrawerItem[];
  /**
   * Gập được hay không. Nhóm lõi (mục hay dùng nhất) KHÔNG gập được:
   * gập nó đi rồi quên mở lại là mất luôn đường vào Cây và Danh bạ.
   */
  collapsible?: boolean;
  /** Mặc định mở khi người dùng chưa từng đụng vào. */
  defaultOpen?: boolean;
}

/**
 * Compute the visible item set for the current viewer + clan context.
 * Centralised so we have a single place to change when a new clan page
 * lands. Permission helpers mirror useClanContext — platform admin
 * counts as clan admin everywhere.
 */
export function buildSections(
  clanId: string | undefined,
  clan: ClanDetail | null,
  profile: MyProfile | null,
  pendingContribCount: number,
  pendingInlawCount: number,
  todoCount: number,
  aiEnabled: boolean,
  /** Đang ở khu quản trị nền tảng — menu đổi hẳn nội dung. */
  isAdminArea = false,
): DrawerSection[] {
  const sections: DrawerSection[] = [];

  // Single icon size used across the drawer — matches typical sidebar
  // density and lets the lucide-style strokes stay legible at small
  // text-sm row heights.
  const ic = "h-5 w-5";

  // ─── Khu quản trị nền tảng: MENU RIÊNG, không trộn với app ────────
  //
  // Vào /admin là menu chỉ còn việc quản trị. Trước đây khu này chen
  // vào giữa menu thường nên hai thứ khác hẳn nhịp dùng nằm cạnh nhau,
  // và menu dài ra với người vốn không phải admin thì chẳng thấy gì.
  //
  // Mỗi mục trỏ thẳng vào một tab của trang Quản trị (URL có ?tab=) nên
  // chia sẻ được và nút Back hoạt động đúng.
  if (isAdminArea && profile?.is_platform_admin) {
    sections.push({
      id: "admin-back",
      label: "Quản trị nền tảng",
      collapsible: false,
      items: [
        {
          to: "/clans",
          label: "← Về ứng dụng",
          icon: <IconBuildings className={ic} />,
          end: true,
        },
      ],
    });
    sections.push({
      id: "admin-report",
      label: "Báo cáo & theo dõi",
      collapsible: false,
      items: [
        {
          to: "/admin?tab=health",
          label: "Hệ thống",
          icon: <IconShield className={ic} />,
        },
        {
          to: "/admin?tab=users",
          label: "Người dùng",
          icon: <IconUsers className={ic} />,
        },
        {
          to: "/admin?tab=clans",
          label: "Dòng họ",
          icon: <IconBuildings className={ic} />,
        },
        {
          to: "/admin?tab=feedback",
          label: "Góp ý của người dùng",
          icon: <IconMail className={ic} />,
        },
        {
          to: "/admin?tab=ai_usage",
          label: "Trợ lý AI",
          icon: <IconSparkles className={ic} />,
        },
      ],
    });
    sections.push({
      id: "admin-settings",
      label: "Cài đặt & nội dung",
      collapsible: false,
      items: [
        {
          to: "/admin/cai-dat?tab=config",
          label: "Cấu hình nền tảng",
          icon: <IconSettings className={ic} />,
        },
        {
          to: "/admin/cai-dat?tab=ai",
          label: "Cấu hình trợ lý AI",
          icon: <IconSparkles className={ic} />,
        },
        {
          to: "/admin/cai-dat?tab=announcements",
          label: "Thông báo",
          icon: <IconBell className={ic} />,
        },
        {
          to: "/admin/cai-dat?tab=giapha",
          label: "Nhập gia phả",
          icon: <IconScroll className={ic} />,
        },
      ],
    });
    return sections;
  }

  // ─── Nhóm Chung ──────────────────────────────────────────────────
  const global: DrawerItem[] = [
    {
      to: "/clans",
      label: profile?.is_platform_admin ? "Tất cả dòng họ" : "Dòng họ của tôi",
      icon: <IconBuildings className={ic} />,
      end: true,
    },
    {
      to: "/so-tay",
      label: "Sổ tay Văn hoá",
      icon: <IconGlobe className={ic} />,
    },
    {
      to: "/docs",
      label: "Trợ giúp",
      icon: <IconBook className={ic} />,
    },
    // Góp ý về hẳn menu: trước đây nó là một nút nhỏ lẫn trong hàng
    // tiện ích ở chân drawer, cạnh QR và Cập nhật — chỗ người dùng chỉ
    // nhìn khi đã đi tìm. Muốn nghe góp ý thì phải để chỗ dễ thấy.
    {
      to: "#feedback",
      label: "Góp ý / báo lỗi",
      icon: <IconMail className={ic} />,
      kind: "feedback",
    },
  ];
  if (profile?.is_platform_admin) {
    // MỘT mục dẫn sang khu riêng, không phải cả một nhóm nằm chình ình
    // giữa menu thường.
    global.push({
      to: "/admin",
      label: "Quản trị nền tảng",
      icon: <IconShield className={ic} />,
      end: true,
    });
  }
  sections.push({
    id: "global",
    label: "Chung",
    items: global,
    collapsible: false,
  });

  if (clanId && clan) {
    const isAdmin = clan.isPlatformAdmin || clan.myRole === "admin";
    const canEdit =
      clan.isPlatformAdmin ||
      clan.myRole === "admin" ||
      clan.myRole === "editor";
    const isMember = clan.myRole !== null || clan.isPlatformAdmin;
    const canTree = isMember || clan.public_show_tree;
    const canEvents = isMember || clan.public_show_events;
    const canGraves = isMember || clan.public_show_graves;
    const canHeritage = isMember || clan.public_show_heritage;
    const feat = (k: ClanFeatureKey) =>
      isFeatureEnabled(clan.disabled_features, k);

    // ─── Nhóm lõi: đúng những mục vào hằng ngày ────────────────────
    // Cùng bộ với thanh tab dưới trên điện thoại, và cùng THỨ TỰ — hai
    // thanh điều hướng nói khác nhau thì người dùng phải học hai lần.
    // KHÔNG gập được: gập rồi quên mở là mất đường vào Cây và Danh bạ.
    const topItems: DrawerItem[] = [
      {
        to: `/clans/${clanId}`,
        label: "Tổng quan",
        icon: <IconHome className={ic} />,
        end: true,
      },
    ];
    if (canTree) {
      topItems.push(
        {
          to: `/clans/${clanId}/tree`,
          label: "Cây gia phả",
          icon: <IconTree className={ic} />,
        },
        {
          to: `/clans/${clanId}/people`,
          label: "Danh bạ",
          icon: <IconUsers className={ic} />,
        },
      );
    }
    if (canEvents) {
      topItems.push({
        to: `/clans/${clanId}/events`,
        label: "Sự kiện",
        icon: <IconCalendar className={ic} />,
      });
    }
    if (canTree) {
      topItems.push({
        to: `/clans/${clanId}/today`,
        label: "Hôm nay",
        icon: <IconSun className={ic} />,
      });
    }
    // Trợ lý đứng trong nhóm lõi: nó là lối vào chính cho người lớn
    // tuổi — hỏi bằng lời thay vì tự đi tìm trong menu.
    if (isMember && aiEnabled && feat("ai_assistant")) {
      topItems.push({
        to: `/clans/${clanId}/tro-ly`,
        label: "Trợ lý dòng họ",
        icon: <IconSparkles className={ic} />,
      });
    }
    sections.push({
      id: "clan-core",
      label: clan.name,
      items: topItems,
      collapsible: false,
    });

    // ─── Cộng đồng ─────────────────────────────────────────────────
    const communityItems: DrawerItem[] = [];
    if (isMember && feat("board")) {
      communityItems.push({
        to: `/clans/${clanId}/board`,
        label: "Bảng tin",
        icon: <IconSparkles className={ic} />,
      });
    }
    if (isMember && feat("memory_room")) {
      communityItems.push({
        to: `/clans/${clanId}/memory-room`,
        label: "Phòng ký ức",
        icon: <IconCamera className={ic} />,
      });
    }
    if (communityItems.length) {
      sections.push({
        id: "clan-community",
        label: "Cộng đồng",
        items: communityItems,
        defaultOpen: true,
      });
    }

    // ─── Văn hoá & Di sản ──────────────────────────────────────────
    // Tách khỏi Tài chính: hai nhóm này trước đây nằm chung "Di sản &
    // Tưởng niệm", nên Quỹ họ — thứ dính tiền và cần tìm nhanh — bị
    // chôn dưới mấy mục đọc-chơi.
    const cultureItems: DrawerItem[] = [];
    if (canHeritage && feat("heritage")) {
      cultureItems.push({
        to: `/clans/${clanId}/heritage`,
        label: "Di sản dòng họ",
        icon: <IconScroll className={ic} />,
      });
    }
    if (canGraves && feat("graves")) {
      cultureItems.push({
        to: `/clans/${clanId}/graves`,
        label: "Mộ phần & tro cốt",
        icon: <IconGrave className={ic} />,
      });
    }
    if (cultureItems.length) {
      sections.push({
        id: "clan-culture",
        label: "Văn hoá & Tưởng niệm",
        items: cultureItems,
        defaultOpen: false,
      });
    }

    // ─── Tài chính ─────────────────────────────────────────────────
    const moneyItems: DrawerItem[] = [];
    if (isMember && feat("fund")) {
      moneyItems.push({
        to: `/clans/${clanId}/fund`,
        label: "Quỹ họ",
        icon: <IconWallet className={ic} />,
      });
    }
    if (isMember && feat("honor")) {
      moneyItems.push({
        to: `/clans/${clanId}/honor`,
        label: "Bảng vàng công đức",
        icon: <IconAward className={ic} />,
      });
    }
    if (moneyItems.length) {
      sections.push({
        id: "clan-money",
        label: "Tài chính",
        items: moneyItems,
        defaultOpen: false,
      });
    }

    // ─── Cập nhật & Công cụ ───────────────────────────────────────
    // Mặc định MỞ khi có việc đang chờ: badge mà nằm trong nhóm gập thì
    // người ta không thấy, và "có việc cần làm" là thứ phải thấy.
    if (isMember) {
      const workItems: DrawerItem[] = [
        {
          to: `/clans/${clanId}/todo`,
          label: "Việc cần làm",
          icon: <IconList className={ic} />,
          badge: todoCount > 0 ? formatBadge(todoCount) : undefined,
        },
      ];
      if (canEdit) {
        workItems.push({
          to: `/clans/${clanId}/contributions`,
          label: "Đóng góp",
          icon: <IconPencil className={ic} />,
          badge: pendingContribCount > 0 ? pendingContribCount : undefined,
        });
      }
      workItems.push({
        to: `/clans/${clanId}/tools`,
        label: "Công cụ",
        icon: <IconSettings className={ic} />,
      });
      sections.push({
        id: "clan-work",
        label: "Cập nhật & Công cụ",
        items: workItems,
        defaultOpen: todoCount > 0 || pendingContribCount > 0,
      });
    }

    // ─── Quản trị dòng họ ─────────────────────────────────────────
    if (isAdmin) {
      const adminItems: DrawerItem[] = [
        {
          to: `/clans/${clanId}/members`,
          label: "Thành viên",
          icon: <IconUserPlus className={ic} />,
        },
      ];
      if (feat("inlaws")) {
        adminItems.push({
          to: `/clans/${clanId}/inlaws`,
          label: "Liên kết thông gia",
          icon: <IconLink className={ic} />,
          badge: pendingInlawCount > 0 ? pendingInlawCount : undefined,
        });
      }
      adminItems.push({
        to: `/clans/${clanId}/settings`,
        label: "Cài đặt dòng họ",
        icon: <IconSettings className={ic} />,
      });
      sections.push({
        id: "clan-admin",
        label: "Quản trị dòng họ",
        items: adminItems,
        defaultOpen: pendingInlawCount > 0,
      });
    }
  }

  return sections;
}
