import { cloneElement, useCallback, useState, type ReactElement, type ReactNode } from "react";

import {
  IconAward,
  IconBell,
  IconBook,
  IconBuildings,
  IconCalendar,
  IconCamera,
  IconGlobe,
  IconMicrophone,
  IconGrave,
  IconHome,
  IconLink,
  IconList,
  IconMail,
  IconMapPin,
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
import { adminPath, screensByArea } from "@/lib/adminScreens";
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

/*
 * THỨ TỰ VÀ TRẠNG THÁI GẬP DỰA TRÊN SỐ LIỆU THẬT, không phải cảm tính.
 * Umami, 90 ngày tính tới 30/08/2026, gộp mọi dòng họ (lượt xem trang):
 *
 *   Tổng quan 336 · Cây 243 · Danh bạ 144 (+192 trang một người)
 *   Sự kiện 66 · Hôm nay 44 · Mộ phần 40 · Cài đặt dòng họ 38
 *   Phòng ký ức 32 · Di sản 32 · Việc cần làm 28 · Bảng tin 28
 *   Thông gia 15 · Công cụ 14 · Công đức 11 · Quỹ họ 11 · Đóng góp 8
 *   Xưng hô 7 · Nhật ký 7 · Thành viên 7
 *
 *   Ngoài dòng họ: Danh sách dòng họ 193 · Thông báo 88 · Trợ giúp 36
 *   · Sổ tay 30
 *
 * Hai điều số liệu nói ngược lại linh cảm ban đầu:
 *  - **Cài đặt dòng họ đứng thứ tư** (38 lượt), trên cả Việc cần làm và
 *    Bảng tin — nên nhóm Quản trị dòng họ mở sẵn chứ không gập.
 *  - **Quỹ họ và Công đức là hai mục ít dùng nhất** (11 mỗi cái), nên
 *    Tài chính gập sẵn — dù nó dính tiền, không ai vào hằng ngày.
 *
 * Cập nhật lại khi có số liệu mới; đừng đổi thứ tự theo cảm giác.
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
  // Nhóm người dùng VỪA BẤM gập khi đang ở một trang của chính nhóm đó → nhớ trang đó. Luật 2 ("nhóm
  // chứa trang đang xem luôn mở") tạm nhường cho cú bấm này, nhưng chỉ cho tới khi chuyển trang: sang
  // trang khác trong nhóm thì nhóm tự mở lại, nên không ai bị lạc.
  const [forcedClosed, setForcedClosed] = useState<Record<string, string>>({});

  const isOpenById = useCallback(
    (section: DrawerSection) => {
      const saved = state[section.id];
      return saved === undefined ? section.defaultOpen ?? true : saved;
    },
    [state],
  );

  const isOpen = useCallback(
    (section: DrawerSection) => {
      if (section.collapsible === false) return true;
      if (sectionHasPath(section, pathname) && forcedClosed[section.id] !== pathname) return true;
      return isOpenById(section);
    },
    [isOpenById, pathname, forcedClosed],
  );

  const toggle = useCallback(
    (section: DrawerSection) => {
      const closing = isOpen(section);
      setState((prev) => {
        const next = { ...prev, [section.id]: !closing };
        try {
          localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
        } catch {
          /* hết chỗ lưu thì thôi, không đáng chặn điều hướng */
        }
        return next;
      });
      setForcedClosed((prev) => {
        const next = { ...prev };
        if (closing && sectionHasPath(section, pathname)) next[section.id] = pathname;
        else delete next[section.id];
        return next;
      });
    },
    [isOpen, pathname],
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
 * Mục quản trị trỏ tới `/admin?tab=x`, mà NavLink chỉ so sánh ĐƯỜNG DẪN
 * nên năm mục cùng `/admin` sáng hết cùng lúc — menu đỏ rực, không nói
 * được người dùng đang ở đâu.
 *
 * Nên với mục có query thì bỏ hẳn kết luận của NavLink và tự so `tab`.
 * Chỉ `||` thêm vào là không sửa được gì: NavLink vẫn nói "active" cho
 * cả năm mục. Đây đúng là lỗi đã lọt ra production một lần.
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

/**
 * Mục này có đang được chọn không.
 *
 * `navLinkActive` là kết luận của NavLink (chỉ theo đường dẫn). Mục có
 * query thì KHÔNG dùng kết luận đó nữa — xem chú thích trên.
 */
export function isItemActive(
  to: string,
  location: { pathname: string; search: string },
  navLinkActive: boolean,
): boolean {
  return to.includes("?") ? isTabActive(to, location) : navLinkActive;
}

// ---------------------------------------------------------------------------

export interface DrawerItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
  /** Optional pill rendered after the label — e.g. pending count. */
  badge?: string | number;
  /** Bấm thường mở ngăn kéo (?panel=…) thay vì chuyển trang; `to` là link dự phòng. */
  panel?: "chat";
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
  /** Còn nhận để giữ chữ ký hàm; mục "Đóng góp" đã bỏ khỏi menu. */
  _pendingContribCount: number,
  pendingInlawCount: number,
  todoCount: number,
  _aiEnabled: boolean,
): DrawerSection[] {
  const sections: DrawerSection[] = [];

  // Single icon size used across the drawer — matches typical sidebar
  // density and lets the lucide-style strokes stay legible at small
  // text-sm row heights.
  const ic = "h-5 w-5";

  // ─── Nhóm Chung ──────────────────────────────────────────────────
  const global: DrawerItem[] = [
    {
      to: "/clans",
      label: profile?.is_platform_admin ? "Tất cả dòng họ" : "Dòng họ của tôi",
      icon: <IconBuildings className={ic} />,
      end: true,
    },
    // Thông báo: 88 lượt xem — dùng nhiều hơn Trợ giúp và Sổ tay cộng
    // lại, mà trước nay chỉ vào được qua cái chuông ở header.
    {
      to: "/announcements",
      label: "Thông báo",
      icon: <IconBell className={ic} />,
    },
    {
      to: "/docs",
      label: "Trợ giúp",
      icon: <IconBook className={ic} />,
    },
    {
      to: "/so-tay",
      label: "Sổ tay Văn hoá",
      icon: <IconGlobe className={ic} />,
    },
    {
      to: "/podcast",
      label: "Podcast",
      icon: <IconMicrophone className={ic} />,
    },
    // Góp ý về hẳn menu: trước đây nó là một nút nhỏ lẫn trong hàng
    // tiện ích ở chân drawer, cạnh QR và Cập nhật — chỗ người dùng chỉ
    // nhìn khi đã đi tìm. Muốn nghe góp ý thì phải để chỗ dễ thấy.
    {
      to: "/gop-y",
      label: "Góp ý / báo lỗi",
      icon: <IconMail className={ic} />,
    },
  ];
  sections.push({
    id: "global",
    label: "Chung",
    items: global,
    // Gập được (mặc định mở): nhóm dùng chung không phải thứ người ta cần hằng ngày bằng nhóm lõi
    // của dòng họ, nên cho thu gọn để menu ngắn lại. Nhóm lõi của dòng họ (Cây, Danh bạ) vẫn không gập được.
    defaultOpen: true,
  });

  if (clanId && clan) {
    const isAdmin = clan.isPlatformAdmin || clan.myRole === "admin";
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
    sections.push({
      id: "clan-core",
      label: clan.name,
      items: topItems,
      // Gập được (mặc định mở). Vẫn an toàn: nhóm chứa trang đang xem luôn tự mở (xem
      // useCollapsedSections), nên gập rồi bấm vào Cây / Danh bạ thì nhóm mở lại, không ai lạc.
      defaultOpen: true,
    });

    // ─── Hai nhóm gộp của dòng họ ──────────────────────────────────
    // Trước đây năm nhóm (Cộng đồng, Văn hoá & Tưởng niệm, Tài chính, Cập nhật & Công cụ, Quản trị
    // dòng họ) làm menu dài và rời rạc; gộp thành hai nhóm theo việc người ta đến để làm:
    //   1. "Cộng đồng & Di sản": nội dung của dòng họ (tin, bản đồ, ký ức, di sản, mộ phần, quỹ).
    //   2. "Công cụ & Quản trị": việc cần làm, công cụ và quản lý dòng họ (thành viên, liên kết, cài đặt).
    const communityItems: DrawerItem[] = [];
    if (isMember && feat("board")) {
      communityItems.push({
        to: `/clans/${clanId}/board`,
        label: "Bảng tin",
        icon: <IconSparkles className={ic} />,
      });
    }
    if (isMember) {
      communityItems.push({
        to: `/clans/${clanId}/map`,
        label: "Bản đồ",
        icon: <IconMapPin className={ic} />,
      });
    }
    if (isMember && feat("memory_room")) {
      communityItems.push({
        to: `/clans/${clanId}/memory-room`,
        label: "Phòng ký ức",
        icon: <IconCamera className={ic} />,
      });
    }
    if (canHeritage && feat("heritage")) {
      communityItems.push({
        to: `/clans/${clanId}/heritage`,
        label: "Di sản dòng họ",
        icon: <IconScroll className={ic} />,
      });
    }
    if (canGraves && feat("graves")) {
      communityItems.push({
        to: `/clans/${clanId}/graves`,
        label: "Mộ phần & tro cốt",
        icon: <IconGrave className={ic} />,
      });
    }
    if (isMember && feat("fund")) {
      communityItems.push({
        to: `/clans/${clanId}/fund`,
        label: "Quỹ họ",
        icon: <IconWallet className={ic} />,
      });
    }
    if (isMember && feat("honor")) {
      communityItems.push({
        to: `/clans/${clanId}/honor`,
        label: "Bảng vàng công đức",
        icon: <IconAward className={ic} />,
      });
    }
    if (communityItems.length) {
      sections.push({
        id: "clan-community",
        label: "Cộng đồng & Di sản",
        items: communityItems,
        defaultOpen: true,
      });
    }

    const workItems: DrawerItem[] = [];
    if (isMember) {
      workItems.push({
        to: `/clans/${clanId}/todo`,
        label: "Việc cần làm",
        icon: <IconList className={ic} />,
        badge: todoCount > 0 ? formatBadge(todoCount) : undefined,
      });
      // Tạm ẩn "Canvas phả đồ" tới khi bảng tree_canvases có trên prod.
      workItems.push({
        to: `/clans/${clanId}/tools`,
        label: "Công cụ",
        icon: <IconSettings className={ic} />,
      });
    }
    if (isAdmin) {
      workItems.push({
        to: `/clans/${clanId}/members`,
        label: "Thành viên",
        icon: <IconUserPlus className={ic} />,
      });
      if (feat("inlaws")) {
        workItems.push({
          to: `/clans/${clanId}/inlaws`,
          label: "Liên kết dòng họ",
          icon: <IconLink className={ic} />,
          badge: pendingInlawCount > 0 ? pendingInlawCount : undefined,
        });
      }
      workItems.push({
        to: `/clans/${clanId}/settings`,
        label: "Cài đặt dòng họ",
        icon: <IconSettings className={ic} />,
      });
    }
    if (workItems.length) {
      sections.push({
        id: "clan-work",
        label: "Công cụ & Quản trị",
        items: workItems,
        // Có việc / liên kết đang chờ thì badge phải thấy; còn không, Cài đặt dòng họ vẫn là mục hay
        // tìm (xem nhiều thứ tư trong một dòng họ) — nên mặc định mở.
        defaultOpen: true,
      });
    }
  }

  // ─── Quản trị hệ thống (chỉ platform admin) ──────────────────────
  // Gom MỌI chức năng của admin hệ thống vào MỘT nhóm riêng, đặt DƯỚI CÙNG menu: tách khỏi nhóm
  // "Chung" (dành cho mọi người) để không lẫn vào việc hằng ngày. Gập được và mặc định gập; khi
  // đang ở một trang quản trị thì nhóm tự mở (xem useCollapsedSections).
  if (profile?.is_platform_admin) {
    const adminGroup: DrawerItem[] = [
      {
        to: "/admin",
        label: "Tổng quan quản trị",
        icon: <IconShield className={ic} />,
        end: true,
      },
      ...(["report", "settings"] as const).flatMap((area) =>
        screensByArea(area).map((sc) => ({
          to: adminPath(sc.slug),
          label: sc.label,
          // Icon của lưới quản trị cỡ h-6; menu dùng h-5 như mọi mục khác.
          icon: cloneElement(sc.icon as ReactElement<{ className?: string }>, { className: ic }),
        })),
      ),
    ];
    sections.push({
      id: "platform-admin",
      label: "Quản trị hệ thống",
      items: adminGroup,
      defaultOpen: false,
    });
  }

  return sections;
}
