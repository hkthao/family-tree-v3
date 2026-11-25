/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/Toast";
import type { ShareViewPayload } from "@/lib/queries/share-view";

const fetchShareView = vi.fn();
const fetchSitePosts = vi.fn();
const fetchSitePost = vi.fn();
const fetchSiteInfo = vi.fn();
const fetchSiteHeritage = vi.fn();
const fetchSiteGraves = vi.fn();
const fetchSiteHonor = vi.fn();
const fetchSiteEvents = vi.fn();
const fetchSiteHeritageItem = vi.fn();
const fetchSiteMap = vi.fn();
const fetchSitePersonMock = vi.fn();
const fetchSiteMosaic = vi.fn();
const fetchSiteSearchIndex = vi.fn();

vi.mock("@/lib/queries/share-view", () => ({
  fetchShareView: (...a: unknown[]) => fetchShareView(...a),
  fetchPublicClanView: (...a: unknown[]) => fetchShareView(...a),
}));
vi.mock("@/lib/queries/site-parts", async (orig) => ({
  ...(await orig<typeof import("@/lib/queries/site-parts")>()),
  fetchSitePosts: (...a: unknown[]) => fetchSitePosts(...a),
  fetchSitePost: (...a: unknown[]) => fetchSitePost(...a),
  fetchSiteInfo: (...a: unknown[]) => fetchSiteInfo(...a),
  fetchSiteHeritage: (...a: unknown[]) => fetchSiteHeritage(...a),
  fetchSiteGraves: (...a: unknown[]) => fetchSiteGraves(...a),
  fetchSiteHonor: (...a: unknown[]) => fetchSiteHonor(...a),
  fetchSiteEvents: (...a: unknown[]) => fetchSiteEvents(...a),
  fetchSiteHeritageItem: (...a: unknown[]) => fetchSiteHeritageItem(...a),
  fetchSiteMap: (...a: unknown[]) => fetchSiteMap(...a),
  fetchSitePerson: (...a: unknown[]) => fetchSitePersonMock(...a),
  fetchSiteMosaic: (...a: unknown[]) => fetchSiteMosaic(...a),
  fetchSiteSearchIndex: (...a: unknown[]) => fetchSiteSearchIndex(...a),
}));
// Khối đóng góp thật gọi nhiều truy vấn riêng; ở đây chỉ kiểm cách trang dòng họ nối tham số vào.
vi.mock("@/components/community/CommunitySharePanel", () => ({
  CommunitySharePanel: (p: { mode?: string; initialPersonId?: string | null; initialQuestionId?: string | null }) => (
    <div data-testid="gop">GOP:{p.mode}:{p.initialPersonId ?? "-"}:{p.initialQuestionId ?? "-"}</div>
  ),
  CommunityStatsLine: () => <span>STATS</span>,
}));
vi.mock("@/components/SharedRestingPlaceCard", () => ({ SharedRestingPlaceCard: ({ rp }: { rp: { name: string } }) => <div data-testid="rp-card">MO:{rp.name}</div> }));
vi.mock("@/components/SharedHeritageCard", () => ({ SharedHeritageCard: ({ h }: { h: { title: string } }) => <div data-testid="her-card">DISAN:{h.title}</div> }));
vi.mock("@/pages/Share", () => ({ default: () => <div>MAN-SHARE-CU</div> }));
// Khối cây thật dựng family-chart (cần trình duyệt thật) — ở đây chỉ kiểm cách trang dòng họ nối dữ liệu vào.
vi.mock("@/components/share/ShareTree", async () => {
  const { useEffect } = await import("react");
  return {
    ShareTree: ({ data, onFocalChange, toolbarExtra }: { data: { persons: { id: string }[] }; onFocalChange?: (id: string) => void; toolbarExtra?: React.ReactNode }) => {
      useEffect(() => onFocalChange?.("b"), [onFocalChange]);
      return (
        <div data-testid="tree">
          TREE:{data.persons.length}
          {toolbarExtra}
        </div>
      );
    },
  };
});
// Phần hồ sơ người dùng khối dùng chung + truy vấn nguồn sử liệu riêng; ở đây chỉ kiểm cách trang dòng họ nối vào.
vi.mock("@/components/SharedPersonCard", () => ({
  SharedPersonCard: ({ focal, onPersonClick, extra }: { focal: { full_name: string }; onPersonClick?: (id: string) => void; extra?: React.ReactNode }) => (
    <div data-testid="person-card">
      CARD:{focal.full_name}
      <button type="button" onClick={() => onPersonClick?.("a")}>sang-nguoi-a</button>
      {extra}
    </div>
  ),
}));
vi.mock("@/components/HistoricalPersonSections", () => ({ HistoricalPersonSections: () => <div data-testid="sources">NGUON</div> }));
const clanHasSources = vi.fn();
vi.mock("@/lib/queries/historical", () => ({
  clanHasSources: (...a: unknown[]) => clanHasSources(...a),
  getHistoricalPersonExtras: async () => null,
}));
// Trình hiển thị Markdown thật kéo theo thư viện lớn; chỉ cần biết nó nhận đúng nguồn.
vi.mock("@/components/markdown/MarkdownView", () => ({ default: ({ source }: { source: string }) => <pre data-testid="md">{source}</pre> }));
const track = vi.fn();
vi.mock("@/lib/analytics", () => ({ track: (...a: unknown[]) => track(...a) }));

import ClanSiteRoot from "@/pages/site/ClanSiteRoot";

const payload = (over: Partial<ShareViewPayload> = {}): ShareViewPayload =>
  ({
    clan_id: "c1",
    clan_name: "Nhà Trần",
    root_person_id: null,
    scope: "tree_view",
    generation_offset: 0,
    persons: [
      { id: "a", full_name: "Trần Kinh", is_root: true, is_living: false, generation: 1 },
      { id: "b", full_name: "Trần Hấp", is_root: false, is_living: false, generation: 2 },
    ],
    families: [],
    site_sections: ["board", "heritage", "graves"],
    community: { can_contribute: true, recipient_label: null, stats: null, memories: [] },
    ...over,
  }) as unknown as ShareViewPayload;

const POSTS = {
  items: [
    { id: "p1", type: "notice", title: "Họp họ cuối năm", excerpt: "Mời cả nhà", cover: null, pinned: true, created_at: "2026-11-20T00:00:00Z", read_minutes: 1 },
    { id: "p2", type: "news", title: "Tin thứ hai", excerpt: "Nội dung hai", cover: "https://a.vn/c.jpg", pinned: false, created_at: "2026-11-19T00:00:00Z", read_minutes: 2 },
  ],
  page: 1,
  per: 9,
  total: 2,
};

function renderAt(url: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/share/:token/*" element={<ClanSiteRoot />} />
            <Route path="/xem/clans/:clanId/*" element={<ClanSiteRoot />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  fetchShareView.mockReset().mockResolvedValue(payload());
  fetchSitePosts.mockReset().mockResolvedValue(POSTS);
  fetchSitePost.mockReset();
  const empty = { items: [], page: 1, per: 4, total: 0 };
  fetchSiteInfo.mockReset().mockResolvedValue({ description: null, origin_place: null, ancestral_hall: null, ancestor_anniversary: null, chief_name: null });
  fetchSiteHeritage.mockReset().mockResolvedValue(empty);
  fetchSiteGraves.mockReset().mockResolvedValue(empty);
  fetchSiteHonor.mockReset().mockResolvedValue(empty);
  fetchSiteEvents.mockReset().mockResolvedValue({ items: [] });
  fetchSiteHeritageItem.mockReset();
  fetchSiteMap.mockReset().mockResolvedValue({ people: {}, graves: {}, province_names: {} });
  fetchSiteMosaic.mockReset().mockResolvedValue(null);
  fetchSitePersonMock.mockReset().mockResolvedValue({ living: false, id: 'b', profile: true, milestones: [], posts: [], heritage: [], graves: [] });
  clanHasSources.mockReset().mockResolvedValue(true);
  track.mockReset();
  fetchSiteSearchIndex.mockReset().mockResolvedValue({ items: [] });
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});
afterEach(cleanup);

describe("ClanSiteRoot — cổng bật/tắt", () => {
  it("mặc định TẮT: vẫn là màn Share cũ, không gọi tải dữ liệu của trang mới", async () => {
    renderAt("/share/tok");
    expect(await screen.findByText("MAN-SHARE-CU")).toBeInTheDocument();
    expect(fetchSitePosts).not.toHaveBeenCalled();
  });

  it("?site=1 bật giao diện website và nhớ trong phiên", async () => {
    renderAt("/share/tok?site=1");
    expect(await screen.findAllByText("Nhà Trần")).not.toHaveLength(0);
    expect(screen.queryByText("MAN-SHARE-CU")).toBeNull();
    expect(sessionStorage.getItem("family-tree:clan-site")).toBe("1");
  });

  it("link mời góp (scope contribute) cũng vào website", async () => {
    fetchShareView.mockResolvedValue(payload({ scope: "contribute" }));
    renderAt("/share/tok?site=1");
    expect(await screen.findAllByText("Nhà Trần")).not.toHaveLength(0);
    expect(screen.queryByText("MAN-SHARE-CU")).toBeNull();
  });

  it("scope lạ (không phải cây / mời góp / QR tập trung) dùng màn Share cũ", async () => {
    fetchShareView.mockResolvedValue(payload({ scope: "khac_la" as never }));
    renderAt("/share/tok?site=1");
    expect(await screen.findByText("MAN-SHARE-CU")).toBeInTheDocument();
  });
});

describe("khung website", () => {
  it("menu dựng theo khoá bật: có Bảng tin + nhóm Di sản, không có Sự kiện", async () => {
    renderAt("/share/tok?site=1");
    await screen.findAllByText("Nhà Trần");
    const nav = screen.getAllByRole("navigation", { name: "Menu dòng họ" })[0];
    expect(nav).toHaveTextContent("Trang chủ");
    expect(nav).toHaveTextContent("Bảng tin");
    expect(nav).toHaveTextContent("Cây gia phả");
    expect(nav).toHaveTextContent("Di sản");
    expect(nav).toHaveTextContent("Cùng góp");
    expect(nav).not.toHaveTextContent("Sự kiện");
  });

  it("khoá board tắt: không có Bảng tin trong menu và vào thẳng /bang-tin bị đưa về trang chủ", async () => {
    fetchShareView.mockResolvedValue(payload({ site_sections: [] }));
    renderAt("/share/tok/bang-tin?site=1");
    await screen.findAllByText("Nhà Trần");
    const nav = screen.getAllByRole("navigation", { name: "Menu dòng họ" })[0];
    expect(nav).not.toHaveTextContent("Bảng tin");
    expect(fetchSitePosts).not.toHaveBeenCalled();
  });

  it("link công khai (không token) không có Cùng góp", async () => {
    renderAt("/xem/clans/c1?site=1");
    await screen.findAllByText("Nhà Trần");
    const nav = screen.getAllByRole("navigation", { name: "Menu dòng họ" })[0];
    expect(nav).not.toHaveTextContent("Cùng góp");
  });

  it("trang chủ: số người, số đời, thuỷ tổ", async () => {
    renderAt("/share/tok?site=1");
    expect(await screen.findByText("thuỷ tổ")).toBeInTheDocument();
    expect(screen.getByText("Trần Kinh")).toBeInTheDocument();
    expect(screen.getByText("người")).toBeInTheDocument();
  });
});

describe("trang Cây", () => {
  it("dùng khối cây dùng chung với dữ liệu của link, trong khung trang dòng họ", async () => {
    renderAt("/share/tok/cay?site=1");
    expect(await screen.findByTestId("tree")).toHaveTextContent("TREE:2");
    expect(screen.getAllByRole("navigation", { name: "Menu dòng họ" })[0]).toHaveTextContent("Cây gia phả");
  });
});

describe("trang chủ có nội dung", () => {
  it("giới thiệu: mô tả + quê gốc / từ đường chỉ khi mục info bật", async () => {
    fetchShareView.mockResolvedValue(payload({ site_sections: ["info"] }));
    fetchSiteInfo.mockResolvedValue({ description: "Dòng họ lập nghiệp ở Tức Mặc.", origin_place: "Tức Mặc, Thiên Trường", ancestral_hall: "Đền Thiên Trường", ancestor_anniversary: null, chief_name: null });
    renderAt("/share/tok?site=1");
    expect(await screen.findByText("Dòng họ lập nghiệp ở Tức Mặc.")).toBeInTheDocument();
    expect(screen.getByText("Tức Mặc, Thiên Trường")).toBeInTheDocument();
    expect(screen.getByText("Từ đường:")).toBeInTheDocument();
    expect(screen.queryByText("Giỗ tổ:")).toBeNull();
  });

  it("không bật mục nào: không gọi các phần, nhưng vẫn có giỗ sắp tới tính từ cây", async () => {
    fetchShareView.mockResolvedValue(
      payload({
        site_sections: [],
        persons: [
          { id: "a", full_name: "Trần Kinh", is_root: true, is_living: false, generation: 1, death_anniv_lunar_month: 8, death_anniv_lunar_day: 20 },
        ] as unknown as ShareViewPayload["persons"],
      }),
    );
    renderAt("/share/tok?site=1");
    expect(await screen.findByText("Sắp tới trong họ")).toBeInTheDocument();
    expect(fetchSiteInfo).not.toHaveBeenCalled();
    expect(fetchSiteHeritage).not.toHaveBeenCalled();
    expect(fetchSiteGraves).not.toHaveBeenCalled();
  });

  it("bản đồ: top tỉnh theo số người; không có dữ liệu thì không hiện khối", async () => {
    fetchShareView.mockResolvedValue(payload({ site_sections: ["map"] }));
    renderAt("/share/tok?site=1");
    await screen.findByText("thuỷ tổ");
    expect(screen.queryByText("Bản đồ dòng họ")).toBeNull();
    cleanup();
    fetchSiteMap.mockResolvedValue({ people: { "37": 5, "01": 2 }, graves: { "33": 4 }, province_names: { "37": "Ninh Bình", "01": "Hà Nội", "33": "Hưng Yên" } });
    renderAt("/share/tok?site=1");
    expect(await screen.findByText("Bản đồ dòng họ")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toContain("Ninh Bình");
    expect(items[0]).toContain("5 người");
    expect(items[1]).toContain("Hà Nội");
    expect(screen.getByText(/ở 1 tỉnh/)).toBeInTheDocument();
  });

  it("di sản, mộ phần, bảng vàng: hiện khối khi mục bật và có dữ liệu", async () => {
    fetchShareView.mockResolvedValue(payload({ site_sections: ["heritage", "graves", "honor"] }));
    fetchSiteHeritage.mockResolvedValue({ items: [{ id: "h1", category: "artifact", title: "Hịch tướng sĩ", summary: null, location_name: null, built_year: null, photo_url: null }], page: 1, per: 4, total: 1 });
    fetchSiteGraves.mockResolvedValue({ items: [{ id: "g1", kind: "grave", name: "Thọ Lăng", location_name: "hương Tinh Cương", status: "existing", built_year: null, occupants: ["Trần Thừa"] }], page: 1, per: 4, total: 1 });
    fetchSiteHonor.mockResolvedValue({ items: [{ id: "o1", honoree_name: "Nguyễn Văn A", category: "donation_money", amount: 5000000, note: null, occurred_on: null }], page: 1, per: 4, total: 1 });
    renderAt("/share/tok?site=1");
    expect(await screen.findByText("Hịch tướng sĩ")).toBeInTheDocument();
    expect(await screen.findByText("Thọ Lăng")).toBeInTheDocument();
    expect(screen.getByText("Trần Thừa")).toBeInTheDocument();
    expect(await screen.findByText("Nguyễn Văn A")).toBeInTheDocument();
    expect(screen.getByText(/5\.000\.000/)).toBeInTheDocument();
  });
});

describe("Bảng tin và trang đọc bài", () => {
  it("liệt kê bài, bài đầu hiện lớn, mỗi bài trỏ tới /bang-tin/:id", async () => {
    renderAt("/share/tok/bang-tin?site=1");
    const link = await screen.findByRole("link", { name: /Họp họ cuối năm/ });
    expect(link).toHaveAttribute("href", "/share/tok/bang-tin/p1");
    expect(screen.getByRole("link", { name: /Tin thứ hai/ })).toHaveAttribute("href", "/share/tok/bang-tin/p2");
    expect(fetchSitePosts).toHaveBeenCalledWith({ token: "tok" }, expect.objectContaining({ page: 1, per: 9 }));
  });

  it("lọc theo loại bài gọi lại với type tương ứng và về trang 1", async () => {
    renderAt("/share/tok/bang-tin?site=1&type=notice&page=3");
    await waitFor(() => expect(fetchSitePosts).toHaveBeenCalled());
    expect(fetchSitePosts).toHaveBeenCalledWith({ token: "tok" }, { page: 3, per: 9, type: "notice" });
  });

  it("đọc bài: tiêu đề, markdown đã chuẩn hoá xuống dòng, bài trước/sau", async () => {
    fetchSitePost.mockResolvedValue({
      id: "p1",
      type: "notice",
      title: "Họp họ cuối năm",
      body: "Dòng một\nDòng hai",
      pinned: false,
      created_at: "2026-11-20T00:00:00Z",
      updated_at: "2026-11-20T00:00:00Z",
      read_minutes: 1,
      prev: { id: "p0", title: "Bài cũ hơn" },
      next: { id: "p2", title: "Tin thứ hai" },
    });
    renderAt("/share/tok/bang-tin/p1?site=1");
    expect(await screen.findByRole("heading", { level: 1, name: "Họp họ cuối năm" })).toBeInTheDocument();
    expect((await screen.findByTestId("md")).textContent).toBe("Dòng một  \nDòng hai");
    expect(screen.getByRole("link", { name: /Bài cũ hơn/ })).toHaveAttribute("href", "/share/tok/bang-tin/p0");
    expect(fetchSitePost).toHaveBeenCalledWith({ token: "tok" }, "p1");
  });

  it("bài không còn: báo rõ và có nút về Bảng tin", async () => {
    const { SitePartError } = await import("@/lib/queries/site-parts");
    fetchSitePost.mockRejectedValue(new SitePartError("x", 404));
    renderAt("/share/tok/bang-tin/zz?site=1");
    expect(await screen.findByText("Bài viết này không còn.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Về Bảng tin/ })).toHaveAttribute("href", "/share/tok/bang-tin");
  });
});

describe("các trang danh sách", () => {
  const page = (items: unknown[], total = items.length) => ({ items, page: 1, per: 12, total });

  it("Sự kiện & giỗ: dựng danh sách từ giỗ trong cây + sự kiện chung (chỉ xem, không link vào app)", async () => {
    fetchShareView.mockResolvedValue(
      payload({
        site_sections: ["events"],
        persons: [{ id: "a", full_name: "Trần Thừa", is_root: true, is_living: false, generation: 4, death_anniv_lunar_month: 1, death_anniv_lunar_day: 18 }] as unknown as ShareViewPayload["persons"],
      }),
    );
    fetchSiteEvents.mockResolvedValue({
      items: [{ id: "e1", title: "Họp họ cuối năm", event_type: "reunion", date_solar: null, lunar_month: 12, lunar_day: 20, lunar_is_leap: false, is_yearly: true, related_person_id: null, notes: null }],
    });
    renderAt("/share/tok/su-kien?site=1");
    fireEvent.click(await screen.findByRole("button", { name: /Danh sách/ }));
    expect(await screen.findByText("Họp họ cuối năm")).toBeInTheDocument();
    expect(screen.getByText(/Giỗ Trần Thừa|Trần Thừa/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Trần Thừa/ })).toBeNull();
  });

  it("Di sản: thẻ trỏ tới trang chi tiết; chọn loại gọi lại với category", async () => {
    fetchSiteHeritage.mockResolvedValue(page([{ id: "h1", category: "place", title: "Đền Thiên Trường", summary: "Nơi thờ", location_name: null, built_year: null, photo_url: null }]));
    renderAt("/share/tok/di-san?site=1");
    const card = await screen.findByRole("link", { name: /Đền Thiên Trường/ });
    expect(card).toHaveAttribute("href", "/share/tok/di-san/h1");
    fireEvent.click(screen.getByRole("tab", { name: "Tục lệ / gia phong" }));
    await waitFor(() => expect(fetchSiteHeritage).toHaveBeenLastCalledWith({ token: "tok" }, { page: 1, per: 12, category: "custom" }));
  });

  it("Di sản: giá trị lọc lạ trên URL bị bỏ, không gửi lên máy chủ", async () => {
    fetchSiteHeritage.mockResolvedValue(page([]));
    renderAt("/share/tok/di-san?site=1&category=drop-table");
    await waitFor(() => expect(fetchSiteHeritage).toHaveBeenCalled());
    expect(fetchSiteHeritage).toHaveBeenLastCalledWith({ token: "tok" }, { page: 1, per: 12, category: undefined });
    expect(await screen.findByText("Chưa có mục di sản nào.")).toBeInTheDocument();
  });

  it("chi tiết di sản: nội dung, người liên quan; không có toạ độ / địa chỉ trên trang", async () => {
    fetchSiteHeritageItem.mockResolvedValue({
      id: "h1", category: "place", title: "Đền Thiên Trường", summary: "Nơi thờ các vua Trần", body: "Đoạn một.\n\nĐoạn hai.",
      location_name: "Phường Lộc Vượng", built_year: 1262, photo_urls: [], audios: [], videos: [],
      people: [{ full_name: "Trần Thái Tông", gender: "M", role_note: "Vua đầu triều Trần" }],
    });
    renderAt("/share/tok/di-san/h1?site=1");
    expect(await screen.findByRole("heading", { level: 1, name: "Đền Thiên Trường" })).toBeInTheDocument();
    expect(screen.getByText("Trần Thái Tông")).toBeInTheDocument();
    expect(screen.getByText("Phường Lộc Vượng")).toBeInTheDocument();
    expect(screen.queryByText(/Chỉ đường/)).toBeNull();
  });

  it("Mộ phần: người an nghỉ + ghi chú không công khai toạ độ, không có nút Chỉ đường", async () => {
    fetchSiteGraves.mockResolvedValue(page([{ id: "g1", kind: "grave", name: "Thọ Lăng", location_name: "hương Tinh Cương", status: "existing", built_year: null, occupants: ["Trần Thừa"] }]));
    renderAt("/share/tok/mo-phan?site=1");
    expect(await screen.findByText("Thọ Lăng")).toBeInTheDocument();
    expect(screen.getByText("Trần Thừa")).toBeInTheDocument();
    expect(screen.getByText(/toạ độ không công khai/)).toBeInTheDocument();
    expect(screen.queryByText(/Chỉ đường/)).toBeNull();
  });

  it("Bảng vàng: tên, loại, số tiền định dạng VND; chỉ hiện số tiền khi có", async () => {
    fetchShareView.mockResolvedValue(payload({ site_sections: ["honor"] }));
    fetchSiteHonor.mockResolvedValue(
      page([
        { id: "o1", honoree_name: "Trần Văn B", category: "donation_money", amount: 20000000, note: "Tu bổ Từ đường", occurred_on: "2026-11-01" },
        { id: "o2", honoree_name: "Trần Minh E", category: "academic", amount: null, note: null, occurred_on: null },
      ]),
    );
    renderAt("/share/tok/bang-vang?site=1");
    expect(await screen.findByText("Trần Văn B")).toBeInTheDocument();
    expect(screen.getByText(/20\.000\.000/)).toBeInTheDocument();
    expect(screen.getAllByText(/đ$/)).toHaveLength(1);
  });

  it("phân trang theo tổng số: trang 2 gọi lại với page=2", async () => {
    fetchSiteGraves.mockResolvedValue(page([{ id: "g1", kind: "grave", name: "Lăng A", location_name: null, status: "existing", built_year: null, occupants: [] }], 30));
    renderAt("/share/tok/mo-phan?site=1");
    await screen.findByText("Lăng A");
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    await waitFor(() => expect(fetchSiteGraves).toHaveBeenLastCalledWith({ token: "tok" }, expect.objectContaining({ page: 2 })));
  });

  it("mục tắt trong share_sections: vào thẳng đường dẫn bị đưa về trang chủ, không gọi máy chủ", async () => {
    fetchShareView.mockResolvedValue(payload({ site_sections: ["board"] }));
    renderAt("/share/tok/mo-phan?site=1");
    expect(await screen.findByText("thuỷ tổ")).toBeInTheDocument();
    expect(fetchSiteGraves).not.toHaveBeenCalled();
  });
});

describe("ảnh ghép ở trang chủ", () => {
  it("hiện khi có mảnh ảnh; đếm số người góp; không hiện khi chưa có", async () => {
    fetchShareView.mockResolvedValue(payload({ site_sections: ["mosaic"] }));
    renderAt("/share/tok?site=1");
    await screen.findByText("thuỷ tổ");
    expect(screen.queryByText("Ảnh của họ")).toBeNull();
    cleanup();
    fetchSiteMosaic.mockResolvedValue({ title: "Ảnh của họ", description: "Mỗi người một mảnh", cols: 2, slots: 4, tiles: [{ position: 0, caption: "Ông", photo_url: "https://a.vn/1.jpg" }] });
    renderAt("/share/tok?site=1");
    expect(await screen.findByText("Ảnh của họ")).toBeInTheDocument();
    expect(screen.getByText("Mỗi người một mảnh")).toBeInTheDocument();
    expect(screen.getByText("1 người đã góp mảnh ảnh")).toBeInTheDocument();
    expect(screen.getByAltText("Ông")).toHaveAttribute("src", "https://a.vn/1.jpg");
  });
});

describe("Cùng góp", () => {
  const withQuestions = () =>
    payload({ community: { can_contribute: true, recipient_label: null, stats: null, memories: [], questions: [{ id: "q1" }] } as unknown as ShareViewPayload["community"] });

  it("trang Cùng góp dùng khối đóng góp; có câu hỏi thì có tab Hỏi & trả lời", async () => {
    fetchShareView.mockResolvedValue(withQuestions());
    renderAt("/share/tok/cung-gop?site=1");
    expect(await screen.findByTestId("gop")).toHaveTextContent("GOP:gop:-:-");
    fireEvent.click(screen.getByRole("tab", { name: "Hỏi & trả lời" }));
    await waitFor(() => expect(screen.getByTestId("gop")).toHaveTextContent("GOP:hoi"));
  });

  it("link mời cũ ?tab=gop&p=… và ?q=… được chuyển thẳng tới Cùng góp, giữ nguyên tham số", async () => {
    fetchShareView.mockResolvedValue(withQuestions());
    renderAt("/share/tok?site=1&tab=gop&p=abc");
    expect(await screen.findByTestId("gop")).toHaveTextContent("GOP:gop:abc:-");
    cleanup();
    renderAt("/share/tok?site=1&q=q1");
    expect(await screen.findByTestId("gop")).toHaveTextContent("GOP:hoi:-:q1");
  });

  it("link không cho đóng góp: vào /cung-gop bị đưa về trang chủ, menu không có Cùng góp", async () => {
    fetchShareView.mockResolvedValue(payload({ community: { can_contribute: false, recipient_label: null, stats: null, memories: [] } as unknown as ShareViewPayload["community"] }));
    renderAt("/share/tok/cung-gop?site=1");
    expect(await screen.findByText("thuỷ tổ")).toBeInTheDocument();
    expect(screen.queryByTestId("gop")).toBeNull();
  });
});

describe("tìm kiếm toàn trang (Ctrl/⌘ + K)", () => {
  const openPalette = () => fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
  const typeQuery = (text: string) => fireEvent.change(screen.getByLabelText("Từ khoá tìm kiếm"), { target: { value: text } });

  it("mở bằng nút kính lúp hoặc Ctrl/⌘ + K, đóng bằng Esc", async () => {
    renderAt("/share/tok?site=1");
    await screen.findByText("thuỷ tổ");
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByLabelText("Từ khoá tìm kiếm"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "K", ctrlKey: true });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    openPalette();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("dưới 2 ký tự chỉ hiện hướng dẫn; gõ không dấu ra kết quả chia nhóm", async () => {
    fetchSiteSearchIndex.mockResolvedValue({
      items: [
        { kind: "post", id: "p1", title: "Họp họ cuối năm" },
        { kind: "heritage", id: "h1", title: "Hịch tướng sĩ" },
        { kind: "grave", id: "g1", title: "Thọ Lăng", sub: "Trần Thừa" },
      ],
    });
    renderAt("/share/tok?site=1");
    await screen.findByText("thuỷ tổ");
    openPalette();
    typeQuery("t");
    expect(screen.getByText(/Gõ ít nhất 2 ký tự/)).toBeInTheDocument();
    typeQuery("hop ho");
    expect(await screen.findByRole("option", { name: /Họp họ cuối năm/ })).toBeInTheDocument();
    expect(screen.getByText("Bài viết")).toBeInTheDocument();
    typeQuery("tho lang");
    expect(await screen.findByRole("option", { name: /Thọ Lăng/ })).toBeInTheDocument();
    expect(screen.getByText("Mộ phần")).toBeInTheDocument();
    typeQuery("tran");
    expect(await screen.findByRole("option", { name: /Trần Hấp/ })).toBeInTheDocument();
    expect(screen.getByText("Người")).toBeInTheDocument();
  });

  it("↑ ↓ + Enter mở kết quả; chọn người đưa tới trang Cây với ?p=<id>", async () => {
    renderAt("/share/tok?site=1");
    await screen.findByText("thuỷ tổ");
    openPalette();
    typeQuery("tran");
    const input = screen.getByLabelText("Từ khoá tìm kiếm");
    await screen.findByRole("option", { name: /Trần Kinh/ });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByTestId("tree")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("không có kết quả thì báo rõ; không gọi chỉ mục khi không có mục nào cần tìm", async () => {
    fetchShareView.mockResolvedValue(payload({ site_sections: [] }));
    renderAt("/share/tok?site=1");
    await screen.findByText("thuỷ tổ");
    openPalette();
    typeQuery("zzzz");
    expect(await screen.findByText(/Không có kết quả cho "zzzz"/)).toBeInTheDocument();
    expect(fetchSiteSearchIndex).not.toHaveBeenCalled();
  });
});

describe("hồ sơ người + đo lượt xem", () => {
  it("cây có nút Xem hồ sơ của người đang chọn, dẫn tới /nguoi/:id", async () => {
    renderAt("/share/tok/cay?site=1");
    const link = await screen.findByRole("link", { name: /Xem hồ sơ|Hồ sơ/ });
    expect(link).toHaveAttribute("href", "/share/tok/nguoi/b");
  });

  const extras = (over: Record<string, unknown> = {}) => ({
    living: false, id: "b", profile: true, bio: "Tổ tiên của họ Trần.\n\nTheo: Đại Việt sử ký toàn thư.", courtesy_name: "Tự X", posthumous_name: null, nickname: null,
    birth_place: "Tức Mặc", burial_place: null, birth_lunar: { year: null, month: null, day: null }, death_lunar: { year: null, month: null, day: null },
    milestones: [{ year: 1228, era: null, title: "Sinh ra", body: null }], posts: [{ id: "p1", type: "news", title: "Bài liên quan", created_at: "2026-11-20T00:00:00Z" }],
    heritage: [{ id: "h1", category: "artifact", title: "Hịch tướng sĩ", role_note: "Tác giả" }], graves: [{ id: "g1", kind: "grave", name: "Thọ Lăng", location_name: "hương Tinh Cương", status: "existing" }],
    ...over,
  });

  it("hồ sơ đầy đủ: tiểu sử, dấu mốc, thông tin cơ bản, bài viết + di sản liên quan, nơi an nghỉ", async () => {
    fetchSitePersonMock.mockResolvedValue(extras());
    renderAt("/xem/clans/c1/nguoi/b?site=1");
    expect(await screen.findByRole("heading", { level: 1, name: "Trần Hấp" })).toBeInTheDocument();
    expect(await screen.findByText(/Tổ tiên của họ Trần/)).toBeInTheDocument();
    expect(screen.getByText("Dấu mốc cuộc đời")).toBeInTheDocument();
    expect(screen.getByText("Sinh ra")).toBeInTheDocument();
    expect(screen.getByText("Tên tự")).toBeInTheDocument();
    expect(screen.getByText("Tức Mặc")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Bài liên quan/ })).toHaveAttribute("href", "/xem/clans/c1/bang-tin/p1");
    expect(screen.getByRole("link", { name: /Hịch tướng sĩ/ })).toHaveAttribute("href", "/xem/clans/c1/di-san/h1");
    expect(screen.getByRole("link", { name: /Thọ Lăng/ })).toHaveAttribute("href", "/xem/clans/c1/mo-phan");
    expect(fetchSitePersonMock).toHaveBeenCalledWith({ clanId: "c1" }, "b");
  });

  it("link chưa cho xem tiểu sử (profile=false): hiện ghi chú, không có tiểu sử / dấu mốc", async () => {
    fetchSitePersonMock.mockResolvedValue({ living: false, id: "b", profile: false, milestones: [], posts: [], heritage: [], graves: [] });
    renderAt("/share/tok/nguoi/b?site=1");
    expect(await screen.findByText(/chưa mở phần tiểu sử chi tiết/)).toBeInTheDocument();
    expect(screen.queryByText("Tiểu sử")).toBeNull();
    expect(screen.queryByText("Dấu mốc cuộc đời")).toBeNull();
  });

  it("người còn sống: chỉ tên + đời + ghi chú riêng tư", async () => {
    fetchShareView.mockResolvedValue(
      payload({ persons: [{ id: "z", full_name: "Người Sống", is_root: false, is_living: true, generation: 3, gender: "M", photo_url: null }] as unknown as ShareViewPayload["persons"] }),
    );
    renderAt("/share/tok/nguoi/z?site=1");
    expect(await screen.findByRole("heading", { level: 1, name: "Người Sống" })).toBeInTheDocument();
    expect(screen.getByText(/được ẩn để bảo vệ quyền riêng tư/)).toBeInTheDocument();
    expect(screen.queryByText("Tiểu sử")).toBeNull();
  });

  it("id lạ báo không tìm thấy", async () => {
    renderAt("/share/tok/nguoi/khong-co?site=1");
    expect(await screen.findByText("Không tìm thấy người này trong cây.")).toBeInTheDocument();
  });

  describe("link tập trung (QR người / mộ / di sản) trong khung trang dòng họ", () => {
    const only = (name: string) => {
      const nav = screen.getAllByRole("navigation", { name: "Menu dòng họ" })[0];
      expect(nav.querySelectorAll("a")).toHaveLength(1);
      expect(nav.querySelector("a")).toHaveTextContent(name);
    };

    it("QR người: chuyển về /nguoi/<id>, menu chỉ có một mục Hồ sơ, không tìm kiếm", async () => {
      fetchShareView.mockResolvedValue(payload({ scope: "single_person", root_person_id: "b" }));
      renderAt("/share/tok?site=1");
      expect(await screen.findByTestId("person-card")).toHaveTextContent("CARD:Trần Hấp");
      only("Hồ sơ");
      expect(screen.queryByRole("button", { name: /Tìm/ })).toBeNull();
    });

    it("QR mộ: thẻ mộ trong khung, menu chỉ có Mộ phần & tro cốt", async () => {
      fetchShareView.mockResolvedValue(payload({ scope: "resting_place", resting_place: { id: "g1", name: "Thọ Lăng" } } as unknown as Partial<ShareViewPayload>));
      renderAt("/share/tok/mo-phan/g1?site=1");
      expect(await screen.findByTestId("rp-card")).toHaveTextContent("MO:Thọ Lăng");
      only("Mộ phần & tro cốt");
    });

    it("QR di sản: thẻ di sản trong khung; đường dẫn lạ được đưa về địa chỉ chuẩn; không có link Cùng góp ở chân trang", async () => {
      fetchShareView.mockResolvedValue(payload({ scope: "heritage_item", heritage_item: { id: "h1", title: "Hịch" } } as unknown as Partial<ShareViewPayload>));
      renderAt("/share/tok/khac?site=1");
      expect(await screen.findByTestId("her-card")).toHaveTextContent("DISAN:Hịch");
      only("Di sản & tư liệu");
      expect(screen.queryByRole("link", { name: "Cùng đóng góp" })).toBeNull();
    });
  });

  it("đo lượt xem: link chia sẻ → share_viewed (kèm scope); trang công khai → public_clan_viewed; bấm CTA → share_cta_click", async () => {
    renderAt("/share/tok?site=1");
    await screen.findByText("thuỷ tổ");
    await waitFor(() => expect(track).toHaveBeenCalledWith("share_viewed", { scope: "tree_view" }));
    fireEvent.click(screen.getByRole("link", { name: /Tạo gia phả cho họ bạn/ }));
    expect(track).toHaveBeenCalledWith("share_cta_click", { mode: "token" });
    cleanup();
    track.mockReset();
    renderAt("/xem/clans/c1?site=1");
    await screen.findByText("thuỷ tổ");
    await waitFor(() => expect(track).toHaveBeenCalledWith("public_clan_viewed"));
  });
});
