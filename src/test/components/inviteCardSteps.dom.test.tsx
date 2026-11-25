/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/Toast";

const nodeToPngBlob = vi.fn();
const sharePngBlob = vi.fn();
vi.mock("@/lib/cards/exportCard", () => ({
  imageUrlToDataUrl: async () => null,
  makeQrDataUrl: async () => "data:image/png;base64,QR",
  nodeToPngBlob: (...a: unknown[]) => nodeToPngBlob(...a),
  sharePngBlob: (...a: unknown[]) => sharePngBlob(...a),
  downloadBlob: vi.fn(),
}));
vi.mock("@/lib/cards/fonts", () => ({ ensureCardFontsLoaded: async () => {} }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/queries/community", () => ({ getCommunitySummary: async () => ({ visits_total: 0 }), listClanMemories: async () => [] }));
vi.mock("@/components/SidePanel", () => ({ SidePanel: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <aside>{children}</aside> : null) }));

import { InviteCardBody } from "@/components/community/InviteCardDialog";

const renderBody = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>
        <InviteCardBody open clanId="c1" clanName="Họ Trần" url="https://app.example/share/t/cung-gop?tab=gop" variants={["chung", "camon"]} />
      </ToastProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  // jsdom không có ResizeObserver (khung ảnh dùng để co theo bề rộng).
  Object.assign(globalThis, { ResizeObserver: class { observe() {} unobserve() {} disconnect() {} } });
  nodeToPngBlob.mockReset().mockResolvedValue(new Blob(["x"]));
  sharePngBlob.mockReset().mockResolvedValue("shared");
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(cleanup);

/** Thiệp mời góp có CÙNG ba bước như thiệp khoe: ① Chọn kiểu → ② Tuỳ chỉnh → ③ Chia sẻ. */
describe("Thiệp mời góp — 3 bước", () => {
  it("bước 1: khổ ảnh + người đọc; chưa có xưng hô / link / nút chia sẻ", () => {
    renderBody();
    expect(screen.getByRole("list", { name: "Các bước" })).toBeInTheDocument();
    expect(screen.getByLabelText("Khổ ảnh")).toBeInTheDocument();
    expect(screen.getByLabelText("Người đọc")).toBeInTheDocument();
    expect(screen.queryByLabelText("Xưng hô")).toBeNull();
    expect(screen.queryByLabelText("Link nằm ở đâu")).toBeNull();
    expect(screen.queryByRole("button", { name: /Tải ảnh/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Quay lại/ })).toBeNull();
  });

  it("bước 2: xưng hô, mẫu chữ, hiện hướng dẫn, sửa chữ trên ảnh", () => {
    renderBody();
    fireEvent.click(screen.getByRole("button", { name: /Tiếp: Tuỳ chỉnh/ }));
    expect(screen.getByLabelText("Xưng hô")).toBeInTheDocument();
    expect(screen.getByLabelText("Mẫu chữ trên ảnh")).toBeInTheDocument();
    expect(screen.getByText("Sửa chữ trên ảnh")).toBeInTheDocument();
    expect(screen.queryByLabelText("Khổ ảnh")).toBeNull();
  });

  it("bước 3: chỗ đặt link, tin nhắn đăng kèm, sao chép tin / tải ảnh / chia sẻ; bước 3 không còn nút Tiếp", async () => {
    renderBody();
    fireEvent.click(screen.getByRole("button", { name: /3\s*Chia sẻ/ }));
    expect(screen.getByLabelText("Link nằm ở đâu")).toBeInTheDocument();
    expect(screen.getByLabelText(/Tin nhắn đăng kèm/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tiếp:/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Sao chép tin nhắn|Chép tin/ }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.any(String)));
    fireEvent.click(screen.getByRole("button", { name: "Chia sẻ" }));
    await waitFor(() => expect(sharePngBlob).toHaveBeenCalled());
  });

  it("giá trị đã chọn giữ nguyên khi đổi bước", () => {
    renderBody();
    fireEvent.change(screen.getByLabelText("Khổ ảnh"), { target: { value: "vertical" } });
    fireEvent.click(screen.getByRole("button", { name: /Tiếp: Tuỳ chỉnh/ }));
    fireEvent.click(screen.getByRole("button", { name: /Quay lại/ }));
    expect(screen.getByLabelText("Khổ ảnh")).toHaveValue("vertical");
  });
});
