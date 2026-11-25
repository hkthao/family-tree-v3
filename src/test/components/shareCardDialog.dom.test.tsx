/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/Toast";

const nodeToPngBlob = vi.fn();
const sharePngBlob = vi.fn();
const publishKhoeCard = vi.fn();
vi.mock("@/lib/cards/exportCard", () => ({
  imageUrlToDataUrl: async () => null,
  makeQrDataUrl: async () => "data:image/png;base64,QR",
  nodeToPngBlob: (...a: unknown[]) => nodeToPngBlob(...a),
  sharePngBlob: (...a: unknown[]) => sharePngBlob(...a),
  downloadBlob: vi.fn(),
}));
vi.mock("@/lib/cards/publishCard", () => ({ makeShareToken: () => "tokenAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", publishKhoeCard: (...a: unknown[]) => publishKhoeCard(...a) }));
vi.mock("@/lib/cards/fonts", () => ({ CARD_FONTS: [{ id: "serif", label: "Serif", family: "serif" }], DEFAULT_CARD_FONT: "serif", ensureCardFontsLoaded: async () => {} }));
vi.mock("@/lib/photoUpload", () => ({ getSignedPhotoUrl: async () => null }));
vi.mock("@/lib/scrollLock", () => ({ lockBodyScroll: () => () => {} }));
vi.mock("@/lib/cards/registry", () => {
  const tplA = { id: "a", name: "Mẫu A", genre: "story", render: () => <div>RENDER-A</div> };
  const tplB = { id: "b", name: "Mẫu B", genre: "story", render: () => <div>RENDER-B</div> };
  return { CARD_TEMPLATES: [tplA, tplB], templatesByGenre: () => [tplA, tplB] };
});

import { ShareCardDialog } from "@/components/ShareCardDialog";

const props = { open: true, onClose: vi.fn(), clanName: "Họ Trần", shareUrl: "https://app.example/share/t", initialTitle: "Chào đón", initialExcerpt: "Lời nhắn" };
const renderDlg = (over: Partial<React.ComponentProps<typeof ShareCardDialog>> = {}) =>
  render(
    <ToastProvider>
      <ShareCardDialog {...props} {...over} />
    </ToastProvider>,
  );

beforeEach(() => {
  for (const m of [nodeToPngBlob, sharePngBlob, publishKhoeCard]) m.mockReset();
  nodeToPngBlob.mockResolvedValue(new Blob(["x"], { type: "image/png" }));
  sharePngBlob.mockResolvedValue("shared");
  publishKhoeCard.mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  Object.assign(globalThis, { requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0) });
});
afterEach(cleanup);

describe("Hộp thoại tạo thiệp — 3 bước", () => {
  it("mở ở bước 1 (Chọn kiểu): có thể loại, mẫu, khổ thiệp; CHƯA có nút chia sẻ / ô chữ", () => {
    renderDlg();
    expect(screen.getByText("Bạn muốn khoe điều gì?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Vuông/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dọc/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mẫu A/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Chia sẻ" })).toBeNull();
    expect(screen.queryByLabelText("Tiêu đề")).toBeNull();
    expect(screen.queryByRole("button", { name: /Quay lại/ })).toBeNull();
  });

  it("bước 2 (Tuỳ chỉnh): sửa chữ, kiểu chữ; giá trị giữ nguyên khi quay lại bước 1 rồi tới lại", () => {
    renderDlg();
    fireEvent.click(screen.getByRole("button", { name: /Tiếp: Tuỳ chỉnh/ }));
    const title = screen.getByDisplayValue("Chào đón");
    fireEvent.change(title, { target: { value: "Tin vui mới" } });
    expect(screen.getByText("Kiểu chữ tiêu đề")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Quay lại/ }));
    expect(screen.getByText("Bạn muốn khoe điều gì?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Tiếp: Tuỳ chỉnh/ }));
    expect(screen.getByDisplayValue("Tin vui mới")).toBeInTheDocument();
  });

  it("bấm số bước nhảy thẳng tới bước đó; bước 3 không còn nút Tiếp", () => {
    renderDlg();
    fireEvent.click(screen.getByRole("button", { name: /3\s*Chia sẻ/ }));
    expect(screen.getByRole("button", { name: /Tải ảnh/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tiếp:/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Quay lại/ })).toBeInTheDocument();
  });

  it("bước 3 (Chia sẻ): chia sẻ xuất ảnh và gọi sharePngBlob; không khoe thì không lưu link công khai", async () => {
    renderDlg();
    fireEvent.click(screen.getByRole("button", { name: /3\s*Chia sẻ/ }));
    fireEvent.click(screen.getByRole("button", { name: "Chia sẻ" }));
    await waitFor(() => expect(sharePngBlob).toHaveBeenCalled());
    expect(publishKhoeCard).not.toHaveBeenCalled();
  });

  it("chế độ khoe: chọn hạn, cảnh báo công khai, chia sẻ lưu thiệp với đúng hạn; sao chép link khoe", async () => {
    renderDlg({ publish: { clanId: "c1", personId: "p1", subtitle: "Đời 32" } });
    fireEvent.click(screen.getByRole("button", { name: /3\s*Chia sẻ/ }));
    expect(screen.getByText(/sẽ công khai tới khi hết hạn/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "1 tuần" }));
    fireEvent.click(screen.getByRole("button", { name: "Chia sẻ" }));
    await waitFor(() => expect(publishKhoeCard).toHaveBeenCalledWith(expect.objectContaining({ clanId: "c1", personId: "p1", subtitle: "Đời 32", ttlDays: 7 })));
    fireEvent.click(screen.getByRole("button", { name: /Sao chép link/ }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringMatching(/\/khoe\/tokenA+$/)));
  });

  it("đóng bằng nút Đóng", () => {
    renderDlg();
    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    expect(props.onClose).toHaveBeenCalled();
  });
});
