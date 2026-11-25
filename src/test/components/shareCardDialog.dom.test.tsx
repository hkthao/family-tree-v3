/**
 * @vitest-environment jsdom
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ToastProvider } from "@/components/Toast";

const nodeToPngBlob = vi.fn();
const nodeToJpegBlob = vi.fn();
const sharePngBlob = vi.fn();
const publishKhoeCard = vi.fn();
vi.mock("@/lib/cards/exportCard", () => ({
  imageUrlToDataUrl: async () => null,
  makeQrDataUrl: async () => "data:image/png;base64,QR",
  nodeToPngBlob: (...a: unknown[]) => nodeToPngBlob(...a),
  nodeToJpegBlob: (...a: unknown[]) => nodeToJpegBlob(...a),
  sharePngBlob: (...a: unknown[]) => sharePngBlob(...a),
  downloadBlob: vi.fn(),
}));
vi.mock("@/lib/cards/publishCard", () => ({
  makeShareToken: () => "tokenAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  publishKhoeCard: (...a: unknown[]) => publishKhoeCard(...a),
}));
vi.mock("@/lib/cards/fonts", () => ({
  CARD_FONTS: [{ id: "serif", label: "Serif", family: "serif" }],
  DEFAULT_CARD_FONT: "serif",
  ensureCardFontsLoaded: async () => {},
}));
vi.mock("@/lib/photoUpload", () => ({ getSignedPhotoUrl: async () => null }));
vi.mock("@/components/SidePanel", () => ({
  SidePanel: ({
    open,
    title,
    children,
  }: {
    open: boolean;
    title: string;
    children: React.ReactNode;
  }) =>
    open ? (
      <aside aria-label={`panel:${title}`}>
        <div className="flex">{children}</div>
      </aside>
    ) : null,
}));
const getOrCreateGeneralInviteUrl = vi.fn();
vi.mock("@/components/community/inviteLink", () => ({
  getOrCreateGeneralInviteUrl: (...a: unknown[]) =>
    getOrCreateGeneralInviteUrl(...a),
}));
vi.mock("@/components/community/InviteCardDialog", () => ({
  InviteCardBody: ({
    url,
    clanId,
    variants,
  }: {
    url: string;
    clanId: string;
    variants: string[];
  }) => (
    <div data-testid="invite-body">
      INVITE:{clanId}:{url}:{variants.join("+")}
    </div>
  ),
}));
vi.mock("@/lib/cards/registry", () => {
  const tplA = {
    id: "a",
    name: "Mẫu A",
    genre: "story",
    render: () => <div>RENDER-A</div>,
  };
  const tplB = {
    id: "b",
    name: "Mẫu B",
    genre: "story",
    render: () => <div>RENDER-B</div>,
  };
  return { CARD_TEMPLATES: [tplA, tplB], templatesByGenre: () => [tplA, tplB] };
});

import { ShareCardDialog } from "@/components/ShareCardDialog";

const props = {
  open: true,
  onClose: vi.fn(),
  clanName: "Họ Trần",
  shareUrl: "https://app.example/share/t",
  initialTitle: "Chào đón",
  initialExcerpt: "Lời nhắn",
};
const renderDlg = (
  over: Partial<React.ComponentProps<typeof ShareCardDialog>> = {},
) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ToastProvider>
        <ShareCardDialog {...props} {...over} />
      </ToastProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  for (const m of [
    nodeToPngBlob,
    nodeToJpegBlob,
    sharePngBlob,
    publishKhoeCard,
    getOrCreateGeneralInviteUrl,
  ])
    m.mockReset();
  getOrCreateGeneralInviteUrl.mockResolvedValue(
    "https://app.example/share/inv/cung-gop?tab=gop",
  );
  nodeToPngBlob.mockResolvedValue(new Blob(["x"], { type: "image/png" }));
  nodeToJpegBlob.mockResolvedValue(new Blob(["og"], { type: "image/jpeg" }));
  sharePngBlob.mockResolvedValue("shared");
  publishKhoeCard.mockResolvedValue(undefined);
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  Object.assign(globalThis, {
    requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0),
  });
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
    expect(
      screen.getByRole("button", { name: /Quay lại/ }),
    ).toBeInTheDocument();
  });

  it("bước 3 (Chia sẻ): chia sẻ xuất ảnh và gọi sharePngBlob; không khoe thì không lưu link công khai", async () => {
    renderDlg();
    fireEvent.click(screen.getByRole("button", { name: /3\s*Chia sẻ/ }));
    fireEvent.click(screen.getByRole("button", { name: "Chia sẻ" }));
    await waitFor(() => expect(sharePngBlob).toHaveBeenCalled());
    expect(publishKhoeCard).not.toHaveBeenCalled();
  });

  it("chế độ khoe: chọn hạn, cảnh báo công khai, chia sẻ lưu thiệp với đúng hạn; sao chép link khoe", async () => {
    renderDlg({
      publish: { clanId: "c1", personId: "p1", subtitle: "Đời 32" },
    });
    fireEvent.click(screen.getByRole("button", { name: /3\s*Chia sẻ/ }));
    expect(
      screen.getByText(/sẽ công khai tới khi hết hạn/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "1 tuần" }));
    fireEvent.click(screen.getByRole("button", { name: "Chia sẻ" }));
    await waitFor(() =>
      expect(publishKhoeCard).toHaveBeenCalledWith(
        expect.objectContaining({
          clanId: "c1",
          personId: "p1",
          subtitle: "Đời 32",
          ttlDays: 7,
        }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /Sao chép link/ }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringMatching(/\/khoe\/tokenA+$/),
      ),
    );
  });

  it("ảnh xem trước nằm ở khối cố định phía trên, ngoài vùng cuộn của các bước", () => {
    renderDlg();
    const preview = screen.getByTestId("card-preview");
    const steps = screen.getByRole("list", { name: "Các bước" });
    // vùng cuộn (overflow-y-auto) chứa các bước, KHÔNG chứa ảnh xem trước
    const scroller = steps.closest(".overflow-y-auto");
    expect(scroller).not.toBeNull();
    expect(scroller!.contains(preview)).toBe(false);
    // đổi sang bước 3 ảnh vẫn còn đó (không bị cuộn / bỏ đi)
    fireEvent.click(screen.getByRole("button", { name: /3\s*Chia sẻ/ }));
    expect(screen.getByTestId("card-preview")).toBeInTheDocument();
  });

  it("khoe: dựng thêm ảnh OG 1200×630 và gửi kèm khi lưu thiệp; dựng lỗi thì vẫn lưu thiệp (không ogBlob)", async () => {
    renderDlg({ publish: { clanId: "c1" } });
    fireEvent.click(screen.getByRole("button", { name: /3\s*Chia sẻ/ }));
    fireEvent.click(screen.getByRole("button", { name: "Chia sẻ" }));
    await waitFor(() => expect(publishKhoeCard).toHaveBeenCalled());
    expect(nodeToJpegBlob).toHaveBeenCalledWith(expect.anything(), 1200, 630);
    expect(
      (publishKhoeCard.mock.calls[0][0] as { ogBlob: Blob }).ogBlob.type,
    ).toBe("image/jpeg");
    publishKhoeCard.mockClear();
    nodeToJpegBlob.mockRejectedValue(new Error("render"));
    fireEvent.click(screen.getByRole("button", { name: "Chia sẻ" }));
    await waitFor(() => expect(publishKhoeCard).toHaveBeenCalled());
    expect(
      (publishKhoeCard.mock.calls[0][0] as { ogBlob: Blob | null }).ogBlob,
    ).toBeNull();
    expect(sharePngBlob).toHaveBeenCalledTimes(2);
  });

  it("không khoe thì không dựng ảnh OG", async () => {
    renderDlg();
    fireEvent.click(screen.getByRole("button", { name: /3\s*Chia sẻ/ }));
    fireEvent.click(screen.getByRole("button", { name: "Chia sẻ" }));
    await waitFor(() => expect(sharePngBlob).toHaveBeenCalled());
    expect(nodeToJpegBlob).not.toHaveBeenCalled();
  });

  it("không biết dòng họ thì không có tab Mời người thân góp; có clanId thì có, và chọn tab mới lấy link mời góp", async () => {
    renderDlg();
    expect(
      screen.queryByRole("tab", { name: "Mời người thân góp" }),
    ).toBeNull();
    cleanup();
    renderDlg({ clanId: "c1" });
    expect(getOrCreateGeneralInviteUrl).not.toHaveBeenCalled(); // chưa chọn tab thì chưa tạo link
    fireEvent.click(screen.getByRole("tab", { name: "Mời người thân góp" }));
    expect(await screen.findByTestId("invite-body")).toHaveTextContent(
      "INVITE:c1:https://app.example/share/inv/cung-gop?tab=gop:chung+camon",
    );
    expect(getOrCreateGeneralInviteUrl).toHaveBeenCalledWith("c1");
    fireEvent.click(
      screen.getByRole("tab", { name: "Thiệp khoe / giới thiệu" }),
    );
    expect(screen.getByText("Bạn muốn khoe điều gì?")).toBeInTheDocument();
  });

  it("không tạo được link mời góp: báo lỗi, không sập", async () => {
    getOrCreateGeneralInviteUrl.mockRejectedValue(new Error("boom"));
    renderDlg({ publish: { clanId: "c1" } });
    fireEvent.click(screen.getByRole("tab", { name: "Mời người thân góp" }));
    expect(
      await screen.findByText(/Không tạo được link mời góp/),
    ).toBeInTheDocument();
  });
});
