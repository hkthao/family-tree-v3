/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfirmDialogProvider } from "@/components/ConfirmDialog";
import { ToastProvider } from "@/components/Toast";

const clanCtx = { clan: { id: "c1", name: "Nhà Trần", myRole: "admin", isPlatformAdmin: false } };
vi.mock("@/hooks/useClanContext", async (orig) => ({ ...(await orig<typeof import("@/hooks/useClanContext")>()), useClanContext: () => clanCtx }));
vi.mock("@/components/SidePanel", () => ({
  SidePanel: ({ open, title, children }: { open: boolean; title: string; children: React.ReactNode }) => (open ? <aside aria-label={`panel:${title}`}>{children}</aside> : null),
}));
vi.mock("@/lib/cards/exportCard", () => ({ makeQrDataUrl: async () => "data:image/png;base64,QR" }));

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
const data = {
  links: [
    { id: "l1", token: "tokTree", scope: "tree_view", root_person_id: null, root_resting_place_id: null, root_heritage_item_id: null, recipient_label: null, expires_at: day(60), is_revoked: false, created_at: "2026-11-01T00:00:00Z" },
    { id: "l2", token: "tokPerson", scope: "single_person", root_person_id: "p1", root_resting_place_id: null, root_heritage_item_id: null, recipient_label: null, expires_at: day(3), is_revoked: false, created_at: "2026-11-02T00:00:00Z" },
    { id: "l3", token: "tokOld", scope: "tree_view", root_person_id: null, root_resting_place_id: null, root_heritage_item_id: null, recipient_label: null, expires_at: day(60), is_revoked: true, created_at: "2026-10-01T00:00:00Z" },
  ],
  cards: [{ id: "c1", token: "cardTok", title: "Chào đón thành viên mới", subtitle: null, expires_at: day(12), created_at: "2026-11-20T00:00:00Z", view_count: 128 }],
  names: { persons: new Map([["p1", "Trần Quốc Tuấn"]]), places: new Map(), heritage: new Map() },
};
const loadShareHub = vi.fn();
const extendShareLinkExpiry = vi.fn();
const endCardNow = vi.fn();
vi.mock("@/lib/queries/share-hub", () => ({
  loadShareHub: (...a: unknown[]) => loadShareHub(...a),
  extendShareLinkExpiry: (...a: unknown[]) => extendShareLinkExpiry(...a),
  extendCardExpiry: vi.fn(),
  endCardNow: (...a: unknown[]) => endCardNow(...a),
}));
const createShareLink = vi.fn();
const revokeShareLink = vi.fn();
const deleteShareLink = vi.fn();
vi.mock("@/lib/queries/share-links", () => ({
  createShareLink: (...a: unknown[]) => createShareLink(...a),
  revokeShareLink: (...a: unknown[]) => revokeShareLink(...a),
  deleteShareLink: (...a: unknown[]) => deleteShareLink(...a),
}));
vi.mock("@/lib/queries/community", () => ({ createContributeLink: vi.fn() }));
vi.mock("@/lib/queries/heritage", () => ({ listHeritageItems: async () => [] }));
vi.mock("@/lib/queries/restingPlaces", () => ({ listRestingPlaces: async () => [] }));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import ShareHub from "@/pages/clan/ShareHub";

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>
        <ConfirmDialogProvider>
          <MemoryRouter initialEntries={["/clans/c1/chia-se"]}>
            <Routes>
              <Route path="/clans/c1/chia-se" element={<ShareHub />} />
              <Route path="/clans/c1" element={<div>TONG-QUAN</div>} />
            </Routes>
          </MemoryRouter>
        </ConfirmDialogProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  clanCtx.clan.myRole = "admin";
  for (const m of [loadShareHub, extendShareLinkExpiry, endCardNow, createShareLink, revokeShareLink, deleteShareLink]) m.mockReset();
  loadShareHub.mockResolvedValue(data);
  for (const m of [extendShareLinkExpiry, endCardNow, createShareLink, revokeShareLink, deleteShareLink]) m.mockResolvedValue({ id: "new" });
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(cleanup);

describe("Trung tâm chia sẻ", () => {
  it("chỉ admin: người không phải admin bị chuyển về tổng quan và KHÔNG gọi tải dữ liệu", async () => {
    clanCtx.clan.myRole = "editor";
    renderPage();
    expect(await screen.findByText("TONG-QUAN")).toBeInTheDocument();
    expect(loadShareHub).not.toHaveBeenCalled();
  });

  it("liệt kê link đang dùng (mặc định) kèm thiệp khoe có lượt xem; link đã thu hồi bị ẩn; thống kê đúng", async () => {
    renderPage();
    expect(await screen.findByText("Trần Quốc Tuấn")).toBeInTheDocument();
    expect(screen.getByText("Chào đón thành viên mới")).toBeInTheDocument();
    expect(screen.getAllByText("128")).toHaveLength(2); // ô thống kê + dòng thiệp
    expect(screen.getByText(/Sắp hết hạn \(3 ngày\)/)).toBeInTheDocument();
    expect(screen.queryAllByText("Đã thu hồi")).toHaveLength(0);
    expect(screen.getByText(/trên 4 link đã tạo/)).toBeInTheDocument();
  });

  it("lọc theo loại và theo trạng thái 'hết hạn / thu hồi'", async () => {
    renderPage();
    await screen.findByText("Trần Quốc Tuấn");
    fireEvent.click(screen.getByRole("tab", { name: "QR người" }));
    expect(screen.queryByText("Chào đón thành viên mới")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Tất cả" }));
    fireEvent.change(screen.getByLabelText("Trạng thái"), { target: { value: "ended" } });
    expect(await screen.findByText("Đã thu hồi")).toBeInTheDocument();
    expect(screen.queryByText("Trần Quốc Tuấn")).toBeNull();
  });

  it("sao chép dùng địa chỉ dẫn vào đúng mục menu (QR người → /nguoi/<id>)", async () => {
    renderPage();
    await screen.findByText("Trần Quốc Tuấn");
    const row = screen.getByText("Trần Quốc Tuấn").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "Sao chép liên kết" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${window.location.origin}/share/tokPerson/nguoi/p1`));
  });

  it("ngăn kéo chi tiết: QR, đường dẫn; gia hạn gọi đúng link với số ngày", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Mở chi tiết Trần Quốc Tuấn/ }));
    const panel = await screen.findByRole("complementary", { name: "panel:Trần Quốc Tuấn" });
    expect(await within(panel).findByAltText("Mã QR")).toHaveAttribute("src", "data:image/png;base64,QR");
    expect(within(panel).getByText(`${window.location.origin}/share/tokPerson/nguoi/p1`)).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "+3 tháng" }));
    await waitFor(() => expect(extendShareLinkExpiry).toHaveBeenCalledWith("l2", data.links[1].expires_at, 90));
  });

  it("thu hồi link cần xác nhận; thiệp khoe thì 'Gỡ thiệp' kết thúc ngay (không xoá hẳn)", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Mở chi tiết Trần Quốc Tuấn/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Thu hồi" }));
    // nút trong hộp xác nhận cùng nhãn "Thu hồi": nút thứ hai
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Thu hồi" })).toHaveLength(2));
    fireEvent.click(screen.getAllByRole("button", { name: "Thu hồi" })[1]);
    await waitFor(() => expect(revokeShareLink).toHaveBeenCalledWith("l2"));
    cleanup();
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Mở chi tiết Chào đón/ }));
    const panel = await screen.findByRole("complementary", { name: /panel:Chào đón/ });
    expect(within(panel).queryByRole("button", { name: "Xoá hẳn" })).toBeNull();
    expect(within(panel).getByRole("button", { name: "Gỡ thiệp" })).toBeInTheDocument();
  });

  it("tạo link cây: gọi createShareLink đúng scope / hạn", async () => {
    renderPage();
    await screen.findByText("Trần Quốc Tuấn");
    fireEvent.click(screen.getByRole("button", { name: "Tạo liên kết mới" }));
    const panel = await screen.findByRole("complementary", { name: "panel:Tạo liên kết mới" });
    fireEvent.click(within(panel).getByRole("button", { name: "1 năm" }));
    fireEvent.click(within(panel).getByRole("button", { name: "Tạo liên kết" }));
    await waitFor(() => expect(createShareLink).toHaveBeenCalledWith({ clan_id: "c1", ttlDays: 365, scope: "tree_view" }));
  });

  it("tạo QR người: chưa chọn người thì nút tạo bị khoá", async () => {
    renderPage();
    await screen.findByText("Trần Quốc Tuấn");
    fireEvent.click(screen.getByRole("button", { name: "Tạo liên kết mới" }));
    const panel = await screen.findByRole("complementary", { name: "panel:Tạo liên kết mới" });
    fireEvent.click(within(panel).getByRole("button", { name: "QR người" }));
    expect(within(panel).getByRole("button", { name: "Tạo liên kết" })).toBeDisabled();
  });
});
