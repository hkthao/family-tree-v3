/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest";

import { act, renderHook } from "@testing-library/react";

import {
  buildSections,
  isTabActive,
  useCollapsedSections,
  sectionBadge,
  sectionHasPath,
  type DrawerSection,
} from "@/lib/navModel";
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
    adminArea?: boolean;
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
    opts.adminArea ?? false,
  );

const ids = (sections: DrawerSection[]) => sections.map((s) => s.id);
const labels = (sections: DrawerSection[]) =>
  sections.flatMap((s) => s.items.map((i) => i.label));

describe("buildSections — khu quản trị", () => {
  it("vào /admin thì menu CHỈ còn việc quản trị, không lẫn menu app", () => {
    const s = build({ profile: admin, adminArea: true });
    expect(ids(s)).toEqual(["admin-back", "admin-report", "admin-settings"]);
    // Không còn Cây gia phả, Quỹ họ… lẫn vào.
    expect(labels(s)).not.toContain("Cây gia phả");
    expect(labels(s)).toContain("← Về ứng dụng");
  });

  it("người thường lỡ vào /admin thì vẫn thấy menu app, không thấy menu quản trị", () => {
    const s = build({ profile: normal, adminArea: true });
    expect(ids(s)).not.toContain("admin-report");
    expect(labels(s)).toContain("Cây gia phả");
  });

  it("ngoài khu quản trị, admin chỉ thấy MỘT mục dẫn vào — không phải cả nhóm", () => {
    const s = build({ profile: admin });
    const global = s.find((x) => x.id === "global")!;
    const adminEntries = global.items.filter((i) => i.to.startsWith("/admin"));
    expect(adminEntries).toHaveLength(1);
  });

  it("người thường không thấy lối vào quản trị", () => {
    const s = build({ profile: normal });
    expect(labels(s).some((l) => l === "Quản trị nền tảng")).toBe(false);
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
