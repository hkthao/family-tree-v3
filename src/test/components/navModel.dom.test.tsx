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

describe("buildSections — nhóm Quản trị hệ thống", () => {
  it("nhóm Chung không còn mục quản trị nào", () => {
    const global = build({ profile: admin }).find((x) => x.id === "global")!;
    expect(global.items.filter((i) => i.to.startsWith("/admin"))).toHaveLength(0);
  });

  it("admin thấy MỘT nhóm quản trị hệ thống chứa tổng quan và TỪNG màn quản trị", () => {
    const group = build({ profile: admin }).find((x) => x.id === "platform-admin")!;
    expect(group).toBeDefined();
    const tos = group.items.map((i) => i.to);
    expect(tos[0]).toBe("/admin");
    for (const sc of ADMIN_SCREENS) expect(tos).toContain(adminPath(sc.slug));
    expect(tos).toHaveLength(ADMIN_SCREENS.length + 1);
  });

  it("nhóm quản trị nằm DƯỚI CÙNG, kể cả khi đang ở trong một dòng họ", () => {
    for (const withClan of [undefined, { clan: clan }]) {
      const all = ids(build({ profile: admin, ...(withClan ?? {}) }));
      expect(all[all.length - 1]).toBe("platform-admin");
    }
  });

  it("nhóm quản trị gập được và mặc định gập", () => {
    const group = build({ profile: admin }).find((x) => x.id === "platform-admin")!;
    expect(group.collapsible).not.toBe(false);
    expect(group.defaultOpen).toBe(false);
  });

  it("nhóm Chung gập được và mặc định mở", () => {
    const global = build().find((x) => x.id === "global")!;
    expect(global.collapsible).not.toBe(false);
    expect(global.defaultOpen).toBe(true);
  });

  it("người thường không thấy nhóm quản trị", () => {
    expect(ids(build({ profile: normal }))).not.toContain("platform-admin");
    const all = build({ profile: normal }).flatMap((x) => x.items.map((i) => i.to));
    expect(all.some((t) => t.startsWith("/admin"))).toBe(false);
  });
});

describe("buildSections — nhóm của dòng họ", () => {
  it("nhóm lõi của dòng họ gập được, mặc định mở", () => {
    const core = build().find((s) => s.id === "clan-core")!;
    expect(core.collapsible).not.toBe(false);
    expect(core.defaultOpen).toBe(true);
    expect(core.items.map((i) => i.label)).toEqual([
      "Tổng quan",
      "Cây gia phả",
      "Danh bạ",
      "Sự kiện",
      "Hôm nay",
    ]);
  });

  it("menu của dòng họ gộp còn đúng HAI nhóm: Cộng đồng & Di sản, Công cụ & Quản trị", () => {
    const s = build();
    const ids_ = ids(s);
    expect(ids_).toContain("clan-community");
    expect(ids_).toContain("clan-work");
    // Các nhóm cũ không còn tồn tại.
    for (const old of ["clan-culture", "clan-money", "clan-admin"]) expect(ids_).not.toContain(old);

    const community = s.find((x) => x.id === "clan-community")!;
    expect(community.items.map((i) => i.label)).toEqual([
      "Bảng tin",
      "Bản đồ",
      "Phòng ký ức",
      "Di sản dòng họ",
      "Mộ phần & tro cốt",
      "Quỹ họ",
      "Bảng vàng công đức",
    ]);
    const work = s.find((x) => x.id === "clan-work")!;
    expect(work.items.map((i) => i.label)).toEqual([
      "Việc cần làm",
      "Công cụ",
      "Thành viên",
      "Liên kết dòng họ",
      "Cài đặt dòng họ",
    ]);
  });

  it("không còn mục Đóng góp trong menu", () => {
    const all = build({ contrib: 3 }).flatMap((x) => x.items.map((i) => i.label));
    expect(all).not.toContain("Đóng góp");
  });

  it("badge việc cần làm và liên kết chờ nằm trong nhóm Công cụ & Quản trị", () => {
    const work = build({ todo: 3, inlaw: 2 }).find((s) => s.id === "clan-work")!;
    const byLabel = (l: string) => work.items.find((i) => i.label === l)!;
    expect(byLabel("Việc cần làm").badge).toBeTruthy();
    expect(byLabel("Liên kết dòng họ").badge).toBe(2);
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

  it("hai nhóm của dòng họ đều mở sẵn", () => {
    const s = build();
    const open = (id: string) => s.find((x) => x.id === id)!.defaultOpen;
    expect(open("clan-community")).toBe(true);
    expect(open("clan-work")).toBe(true);
  });

  it("Góp ý là một mục trong menu, không còn là nút lẫn ở chân drawer", () => {
    const global = build().find((s) => s.id === "global")!;
    const fb = global.items.find((i) => i.kind === "feedback");
    expect(fb?.label).toMatch(/Góp ý/);
  });

  it("người chỉ xem không thấy các mục quản trị dòng họ", () => {
    const viewer = { ...clan, myRole: "viewer" } as unknown as ClanDetail;
    const work = build({ clan: viewer }).find((x) => x.id === "clan-work")!;
    const labels = work.items.map((i) => i.label);
    for (const adminOnly of ["Thành viên", "Liên kết dòng họ", "Cài đặt dòng họ"]) {
      expect(labels).not.toContain(adminOnly);
    }
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

  it("đang xem trang trong nhóm thì nhóm tự mở, kể cả khi lần trước đã gập", () => {
    // Gập từ trước (đã lưu), rồi VÀO một trang của nhóm đó → nhóm mở để menu còn sáng chỗ đang xem.
    localStorage.setItem("drawer:sections", JSON.stringify({ "clan-money": false }));
    const { result } = renderHook(() => useCollapsedSections("/clans/c1/fund"));
    expect(result.current.isOpen(closed)).toBe(true);
  });

  it("bấm gập nhóm chứa trang đang xem thì gập THẬT (không bị luật tự mở nuốt mất)", () => {
    const core: DrawerSection = {
      id: "clan-core",
      label: "Họ Hồ",
      defaultOpen: true,
      items: [
        { to: "/clans/c1", label: "Tổng quan", icon: null, end: true },
        { to: "/clans/c1/tree", label: "Cây gia phả", icon: null },
      ],
    };
    const { result } = renderHook(() => useCollapsedSections("/clans/c1"));
    expect(result.current.isOpen(core)).toBe(true);
    act(() => result.current.toggle(core));
    expect(result.current.isOpen(core)).toBe(false);
    act(() => result.current.toggle(core));
    expect(result.current.isOpen(core)).toBe(true);
  });

  it("đã gập thủ công mà chuyển sang trang khác trong nhóm thì nhóm tự mở lại", () => {
    const core: DrawerSection = {
      id: "clan-core",
      label: "Họ Hồ",
      defaultOpen: true,
      items: [
        { to: "/clans/c1", label: "Tổng quan", icon: null, end: true },
        { to: "/clans/c1/tree", label: "Cây gia phả", icon: null },
      ],
    };
    const { result, rerender } = renderHook(({ p }) => useCollapsedSections(p), {
      initialProps: { p: "/clans/c1" },
    });
    act(() => result.current.toggle(core));
    expect(result.current.isOpen(core)).toBe(false);
    rerender({ p: "/clans/c1/tree" });
    expect(result.current.isOpen(core)).toBe(true);
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
