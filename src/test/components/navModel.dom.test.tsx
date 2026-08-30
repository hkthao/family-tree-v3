/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest";

import { act, renderHook } from "@testing-library/react";

import {
  buildSections,
  isItemActive,
  isTabActive,
  useCollapsedSections,
  sectionBadge,
  sectionHasPath,
  type DrawerSection,
} from "@/lib/navModel";
import { ADMIN_SCREENS, adminPath, pathForLegacyTab } from "@/lib/adminScreens";
import type { ClanDetail } from "@/lib/queries/clan-detail";
import type { MyProfile } from "@/lib/queries/profile";

/**
 * Menu là thứ người dùng gặp mọi lúc, và nó vỡ theo kiểu im lặng: một
 * mục hiện nhầm cho người không có quyền, một nhóm gập nuốt mất badge,
 * hay khu quản trị lẫn vào menu thường. Mấy ca dưới đây canh đúng những
 * kiểu đó.
 */

const clan = {
  id: "c1",
  name: "Họ Nguyễn",
  myRole: "admin",
  isPlatformAdmin: false,
  disabled_features: [],
  public_show_tree: true,
  public_show_events: true,
  public_show_graves: true,
  public_show_heritage: true,
} as unknown as ClanDetail;

const admin = { is_platform_admin: true } as unknown as MyProfile;
const normal = { is_platform_admin: false } as unknown as MyProfile;

const build = (
  opts: {
    clan?: ClanDetail | null;
    profile?: MyProfile | null;
    todo?: number;
    contrib?: number;
    inlaw?: number;
  } = {},
) =>
  buildSections(
    opts.clan === null ? undefined : "c1",
    opts.clan === undefined ? clan : opts.clan,
    opts.profile ?? normal,
    opts.contrib ?? 0,
    opts.inlaw ?? 0,
    opts.todo ?? 0,
    true,
  );

const ids = (sections: DrawerSection[]) => sections.map((s) => s.id);

describe("buildSections — lối vào khu quản trị", () => {
  it("admin chỉ thấy MỘT mục dẫn vào khu quản trị", () => {
    // Chín mục quản trị nằm ở LƯỚI trong /admin. Đổ chúng vào menu trái
    // nữa là hai bản sao của cùng một danh sách, và người dùng phải đoán
    // xem cái nào mới là chỗ đi.
    const global = build({ profile: admin }).find((x) => x.id === "global")!;
    const entries = global.items.filter((i) => i.to.startsWith("/admin"));
    expect(entries).toHaveLength(1);
    expect(entries[0].to).toBe("/admin");
  });

  it("menu KHÔNG liệt kê từng màn quản trị", () => {
    const tos = build({ profile: admin }).flatMap((x) =>
      x.items.map((i) => i.to),
    );
    for (const sc of ADMIN_SCREENS) {
      expect(tos).not.toContain(adminPath(sc.slug));
    }
  });

  it("người thường không thấy lối vào quản trị", () => {
    const all = build({ profile: normal }).flatMap((x) =>
      x.items.map((i) => i.label),
    );
    expect(all).not.toContain("Quản trị nền tảng");
  });
});

describe("buildSections — nhóm của dòng họ", () => {
  it("nhóm lõi KHÔNG gập được — gập rồi quên mở là mất đường vào Cây", () => {
    const core = build().find((s) => s.id === "clan-core")!;
    expect(core.collapsible).toBe(false);
    expect(core.items.map((i) => i.label)).toEqual([
      "Tổng quan",
      "Cây gia phả",
      "Danh bạ",
      "Sự kiện",
      "Hôm nay",
      "Trợ lý dòng họ",
    ]);
  });

  it("tách Tài chính khỏi Văn hoá — Quỹ họ không bị chôn dưới mục đọc-chơi", () => {
    const s = build();
    expect(ids(s)).toContain("clan-money");
    expect(ids(s)).toContain("clan-culture");
    const money = s.find((x) => x.id === "clan-money")!;
    expect(money.items.map((i) => i.label)).toEqual([
      "Quỹ họ",
      "Bảng vàng công đức",
    ]);
  });

  it("có việc đang chờ thì nhóm đó mặc định MỞ — badge giấu trong nhóm gập là badge vô dụng", () => {
    const quiet = build().find((s) => s.id === "clan-work")!;
    expect(quiet.defaultOpen).toBe(false);
    const busy = build({ todo: 3 }).find((s) => s.id === "clan-work")!;
    expect(busy.defaultOpen).toBe(true);
  });

  it("nhóm Chung xếp theo lượt dùng thật (Umami 90 ngày)", () => {
    // Danh sách dòng họ 193 · Thông báo 88 · Trợ giúp 36 · Sổ tay 30.
    const global = build().find((s) => s.id === "global")!;
    expect(global.items.slice(0, 4).map((i) => i.label)).toEqual([
      "Dòng họ của tôi",
      "Thông báo",
      "Trợ giúp",
      "Sổ tay Văn hoá",
    ]);
  });

  it("nhóm hay dùng mở sẵn, nhóm ít dùng gập sẵn", () => {
    const s = build();
    const open = (id: string) => s.find((x) => x.id === id)!.defaultOpen;
    // Mộ phần 40 + Di sản 32 so với Quỹ 11 + Công đức 11.
    expect(open("clan-culture")).toBe(true);
    expect(open("clan-money")).toBe(false);
    // Cài đặt dòng họ 38 lượt — mục thứ tư trong một dòng họ.
    expect(open("clan-admin")).toBe(true);
  });

  it("Góp ý là một mục trong menu, không còn là nút lẫn ở chân drawer", () => {
    const global = build().find((s) => s.id === "global")!;
    const fb = global.items.find((i) => i.kind === "feedback");
    expect(fb?.label).toMatch(/Góp ý/);
  });

  it("người chỉ xem không thấy nhóm quản trị dòng họ", () => {
    const viewer = { ...clan, myRole: "viewer" } as unknown as ClanDetail;
    expect(ids(build({ clan: viewer }))).not.toContain("clan-admin");
  });

  it("không ở trong dòng họ nào thì chỉ có nhóm Chung", () => {
    expect(ids(build({ clan: null }))).toEqual(["global"]);
  });
});

describe("sectionHasPath", () => {
  const section: DrawerSection = {
    id: "s",
    label: "S",
    items: [
      { to: "/clans/c1/fund", label: "Quỹ", icon: null },
      { to: "/clans/c1", label: "Tổng quan", icon: null, end: true },
    ],
  };

  it("mở nhóm chứa trang đang xem, kể cả trang con", () => {
    expect(sectionHasPath(section, "/clans/c1/fund")).toBe(true);
    expect(sectionHasPath(section, "/clans/c1/fund/123")).toBe(true);
  });

  it("mục `end` chỉ khớp đúng đường dẫn đó", () => {
    expect(sectionHasPath(section, "/clans/c1")).toBe(true);
    // "/clans/c1/people" KHÔNG được kéo nhóm này mở ra vì mục Tổng quan.
    const onlyEnd: DrawerSection = { ...section, items: [section.items[1]] };
    expect(sectionHasPath(onlyEnd, "/clans/c1/people")).toBe(false);
  });

  it("bỏ qua query string của mục quản trị", () => {
    const tabs: DrawerSection = {
      id: "t",
      label: "T",
      items: [{ to: "/admin?tab=users", label: "Người dùng", icon: null }],
    };
    expect(sectionHasPath(tabs, "/admin")).toBe(true);
  });
});

describe("sectionBadge", () => {
  it("cộng badge của các mục để hiện ra ngoài khi nhóm đang gập", () => {
    expect(
      sectionBadge({
        id: "x",
        label: "X",
        items: [
          { to: "/a", label: "A", icon: null, badge: 2 },
          { to: "/b", label: "B", icon: null, badge: 3 },
          { to: "/c", label: "C", icon: null },
        ],
      }),
    ).toBe(5);
  });

  it("không có việc gì thì không hiện badge rỗng", () => {
    expect(
      sectionBadge({ id: "x", label: "X", items: [{ to: "/a", label: "A", icon: null }] }),
    ).toBeUndefined();
  });
});

describe("isItemActive", () => {
  const loc = (pathname: string, search: string) => ({ pathname, search });

  it("chỉ MỘT mục quản trị sáng, dù NavLink bảo mục nào cũng active", () => {
    // Lỗi đã lọt ra production: năm mục cùng trỏ /admin nên NavLink nói
    // "active" cho cả năm, menu đỏ rực. Kết luận của NavLink (tham số
    // cuối) phải bị BỎ QUA với mục có query.
    const here = loc("/admin", "?tab=users");
    expect(isItemActive("/admin?tab=users", here, true)).toBe(true);
    expect(isItemActive("/admin?tab=clans", here, true)).toBe(false);
    expect(isItemActive("/admin?tab=health", here, true)).toBe(false);
  });

  it("mục không có query thì tin NavLink", () => {
    const here = loc("/clans/c1/tree", "");
    expect(isItemActive("/clans/c1/tree", here, true)).toBe(true);
    expect(isItemActive("/clans/c1/people", here, false)).toBe(false);
  });

  it("khu quản trị không có ?tab thì không mục nào sáng nhầm", () => {
    const bare = loc("/admin", "");
    expect(isItemActive("/admin?tab=users", bare, true)).toBe(false);
  });
});

describe("isTabActive", () => {
  const loc = (pathname: string, search: string) => ({ pathname, search });

  it("đúng MỘT tab quản trị sáng, không phải cả bốn", () => {
    expect(isTabActive("/admin?tab=users", loc("/admin", "?tab=users"))).toBe(true);
    expect(isTabActive("/admin?tab=clans", loc("/admin", "?tab=users"))).toBe(false);
  });

  it("mục không có query thì để NavLink tự lo", () => {
    expect(isTabActive("/clans", loc("/clans", ""))).toBe(false);
  });
});


describe("useCollapsedSections", () => {
  const closed: DrawerSection = {
    id: "clan-money",
    label: "Tài chính",
    defaultOpen: false,
    items: [{ to: "/clans/c1/fund", label: "Quỹ họ", icon: null }],
  };
  const open: DrawerSection = {
    id: "clan-community",
    label: "Cộng đồng",
    defaultOpen: true,
    items: [{ to: "/clans/c1/board", label: "Bảng tin", icon: null }],
  };

  beforeEach(() => localStorage.clear());

  it("nhóm mặc định đóng thì cú bấm ĐẦU TIÊN phải mở nó ra", () => {
    // Ca này từng sai thật: bản đầu lưu 'tập đang gập', nhóm mặc định
    // đóng không nằm trong tập nên bấm lại đưa nó vào tập — người dùng
    // bấm mãi mà nhóm vẫn đóng.
    const { result } = renderHook(() => useCollapsedSections("/clans/c1"));
    expect(result.current.isOpen(closed)).toBe(false);
    act(() => result.current.toggle(closed));
    expect(result.current.isOpen(closed)).toBe(true);
    act(() => result.current.toggle(closed));
    expect(result.current.isOpen(closed)).toBe(false);
  });

  it("nhóm mặc định mở thì bấm một cái là đóng", () => {
    const { result } = renderHook(() => useCollapsedSections("/clans/c1"));
    expect(result.current.isOpen(open)).toBe(true);
    act(() => result.current.toggle(open));
    expect(result.current.isOpen(open)).toBe(false);
  });

  it("nhớ lựa chọn qua lần mở app sau", () => {
    const first = renderHook(() => useCollapsedSections("/clans/c1"));
    act(() => first.result.current.toggle(closed));
    first.unmount();

    const second = renderHook(() => useCollapsedSections("/clans/c1"));
    expect(second.result.current.isOpen(closed)).toBe(true);
  });

  it("đang xem trang trong nhóm thì nhóm mở, kể cả người dùng đã gập", () => {
    const { result } = renderHook(() =>
      useCollapsedSections("/clans/c1/fund"),
    );
    act(() => result.current.toggle(closed)); // mở
    act(() => result.current.toggle(closed)); // gập lại
    expect(result.current.isOpen(closed)).toBe(true);
  });

  it("nhóm không gập được thì luôn mở", () => {
    const { result } = renderHook(() => useCollapsedSections("/x"));
    const core: DrawerSection = {
      id: "clan-core",
      label: "Họ",
      collapsible: false,
      items: [{ to: "/clans/c1", label: "Tổng quan", icon: null }],
    };
    act(() => result.current.toggle(core));
    expect(result.current.isOpen(core)).toBe(true);
  });

  it("localStorage rác không làm sập menu", () => {
    localStorage.setItem("drawer:sections", "{{hỏng");
    const { result } = renderHook(() => useCollapsedSections("/x"));
    expect(result.current.isOpen(open)).toBe(true);
  });
});


describe("pathForLegacyTab", () => {
  /**
   * Link `/admin?tab=users` đã nằm trong bookmark và trong tin nhắn
   * ("xem giúp anh cái này"). Bỏ thẳng là người ta bấm vào gặp trang
   * trống mà không hiểu vì sao.
   */
  it("đổi tab cũ sang đường dẫn mới", () => {
    expect(pathForLegacyTab("users")).toBe("/admin/nguoi-dung");
    expect(pathForLegacyTab("ai")).toBe("/admin/cau-hinh-ai");
    expect(pathForLegacyTab("ai_usage")).toBe("/admin/tro-ly-ai");
  });

  it("mọi màn đều có lối về từ tab cũ — không bỏ sót màn nào", () => {
    for (const s of ADMIN_SCREENS) {
      expect(pathForLegacyTab(s.legacyTab)).toBe(adminPath(s.slug));
    }
  });

  it("tab lạ hoặc thiếu tab thì trả null để nơi gọi tự quyết", () => {
    expect(pathForLegacyTab("khong-co")).toBeNull();
    expect(pathForLegacyTab(null)).toBeNull();
  });

  it("slug không trùng nhau", () => {
    const slugs = ADMIN_SCREENS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
