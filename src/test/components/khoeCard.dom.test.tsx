// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/Toast";

const rpc = vi.fn(() => Promise.resolve({ data: null, error: null }));
const fetchKhoe = vi.fn();
vi.mock("@/lib/supabase", () => ({ supabase: { rpc: (...a: unknown[]) => (rpc as (...x: unknown[]) => unknown)(...a) } }));
vi.mock("@/lib/queries/site-parts", async (orig) => ({
  ...(await orig<typeof import("@/lib/queries/site-parts")>()),
  fetchKhoe: (...a: unknown[]) => fetchKhoe(...a),
}));
vi.mock("@/lib/cards/publishCard", () => ({ getPublicCardUrl: (p: string) => `https://st.example/${p}` }));

import { SitePartError } from "@/lib/queries/site-parts";
import KhoeCard, { daysLeft } from "@/pages/KhoeCard";

const soon = (days: number) => new Date(Date.now() + days * 86_400_000 - 1000).toISOString();
const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/khoe/tok"]}>
          <Routes>
            <Route path="/khoe/:token/*" element={<KhoeCard />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  fetchKhoe.mockReset().mockRejectedValue(new SitePartError("x", 404));
  rpc.mockClear();
  sessionStorage.clear();
});
afterEach(cleanup);

describe("daysLeft", () => {
  it("làm tròn lên; hết hạn <= 0", () => {
    const now = Date.parse("2026-11-25T00:00:00Z");
    expect(daysLeft("2026-12-07T00:00:00Z", now)).toBe(12);
    expect(daysLeft("2026-11-25T10:00:00Z", now)).toBe(1);
    expect(daysLeft("2026-11-24T00:00:00Z", now)).toBeLessThanOrEqual(0);
  });
});

describe("trang /khoe/:token", () => {
  it("không có thiệp (hết hạn / gỡ / sai link): một thẻ chung, không nêu lý do", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Liên kết không còn hiệu lực" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Về trang chủ/ })).toHaveAttribute("href", "/");
    // vẫn trong khung trang dòng họ: có tab Thiệp
    expect(screen.getAllByRole("link", { name: "Thiệp" }).length).toBeGreaterThan(0);
  });

  it("lỗi máy chủ (không phải 404) không bị nhầm thành hết hạn", async () => {
    fetchKhoe.mockRejectedValue(new SitePartError("boom", 500));
    renderPage();
    await waitFor(() => expect(fetchKhoe).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(await screen.findByText(/Chưa tải được thiệp/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Liên kết không còn hiệu lực" })).toBeNull();
  });

  it("dòng họ công khai: có ảnh thiệp, còn N ngày, nút Xem cây gia phả", async () => {
    fetchKhoe.mockResolvedValue({ clan_id: "c1", clan_name: "Nhà Trần", public_tree: true, card: { title: "Chào đón <bé>", subtitle: "Đời 32", image_path: "c1/tok.png", expires_at: soon(12) } });
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "Chào đón <bé>" })).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://st.example/c1/tok.png");
    expect(screen.getByText("Liên kết còn 12 ngày")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Xem cây gia phả/ })).toHaveAttribute("href", "/xem/clans/c1");
    expect(screen.getAllByRole("link", { name: "Thiệp" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Tải ảnh/ })).toHaveAttribute("href", "https://st.example/c1/tok.png");
    expect(rpc).toHaveBeenCalledWith("khoe_register_view", { p_token: "tok" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("ảnh thiệp vỡ hoặc không có: hiện mẫu mặc định từ chữ của thiệp, không ảnh lỗi", async () => {
    fetchKhoe.mockResolvedValue({ clan_id: "c1", clan_name: "Nhà Trần", public_tree: false, card: { title: "Tin vui", subtitle: "Đời 32", image_path: "c1/tok.png", expires_at: soon(3) } });
    renderPage();
    fireEvent.error(await screen.findByRole("img", { name: "Tin vui" }));
    const d = await screen.findByTestId("khoe-default-card");
    expect(d).toHaveTextContent("Tin vui");
    expect(d).toHaveTextContent("Đời 32");
    expect(document.querySelector("img")).toBeNull();
  });

  it("không có thẻ mời ở cuối trang; họ công khai cây có nút Xem cây gia phả cạnh các nút chính", async () => {
    fetchKhoe.mockResolvedValue({ clan_id: "c1", clan_name: "Nhà Trần", public_tree: true, card: { title: "T", subtitle: null, image_path: "c1/t.png", expires_at: soon(3) } });
    renderPage();
    expect(await screen.findByRole("link", { name: /Xem cây gia phả/ })).toHaveAttribute("href", "/xem/clans/c1");
    expect(screen.queryByText(/đang gìn giữ gia phả của mình/)).toBeNull();
  });

  it("thiệp không còn: không đếm lượt xem", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Liên kết không còn hiệu lực" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("dòng họ không công khai cây: không có nút Xem cây gia phả, vẫn có nút tạo gia phả", async () => {
    fetchKhoe.mockResolvedValue({ clan_id: "c1", clan_name: "Nhà Trần", public_tree: false, card: { title: "Tin vui", subtitle: null, image_path: "c1/tok.png", expires_at: soon(3) } });
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "Tin vui" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Xem cây gia phả/ })).toBeNull();
    for (const l of screen.getAllByRole("link", { name: /Tạo gia phả cho họ bạn/ })) expect(l).toHaveAttribute("href", "/signup");
  });
});
