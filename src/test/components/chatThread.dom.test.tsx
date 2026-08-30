/// <reference types="@testing-library/jest-dom" />
/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ChatThread } from "@/components/ai/ChatThread";

/**
 * Màn hình chào và đường lui khi hết lượt — hai chỗ quyết định người
 * dùng có biết mình làm được gì hay không.
 */

// jsdom chưa có Element.scrollTo — ChatThread gọi nó để giữ đáy.
beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
});

const wrap = (ui: React.ReactNode) => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
};

const base = {
  turns: [],
  pending: false,
  error: null,
  fontSize: 18,
  clanName: "Nguyễn",
};

describe("ChatThread", () => {
  it("người sửa được gia phả mới thấy mách chuyện thêm người bằng lời", () => {
    wrap(<ChatThread {...base} canAddPeople />);
    expect(screen.getByText(/Muốn thêm người thì cứ kể/)).toBeInTheDocument();
  });

  it("người chỉ xem thì KHÔNG được mách — kể xong mới biết không có quyền là hụt hẫng vô ích", () => {
    wrap(<ChatThread {...base} canAddPeople={false} />);
    expect(screen.queryByText(/Muốn thêm người thì cứ kể/)).not.toBeInTheDocument();
  });

  it("luôn nói rõ câu hỏi được gửi ra ngoài, kèm gì và không kèm gì", () => {
    wrap(<ChatThread {...base} />);
    expect(screen.getByText(/được gửi tới/)).toBeInTheDocument();
    expect(screen.getByText(/Ảnh, tiểu sử và ghi chú riêng thì không gửi đi/)).toBeInTheDocument();
  });

  it("hết lượt thì hiện thẳng nút đường lui miễn phí", () => {
    wrap(
      <ChatThread
        {...base}
        turns={[{ role: "assistant", content: "Bạn đã dùng hết lượt…" }]}
        quotaFallbackHref="/clans/abc/ai-generate"
      />,
    );
    const link = screen.getByRole("link", { name: /Nhờ AI lập gia phả/ });
    expect(link).toHaveAttribute("href", "/clans/abc/ai-generate");
  });

  it("còn lượt thì không có nút đó", () => {
    wrap(<ChatThread {...base} />);
    expect(screen.queryByRole("link", { name: /Nhờ AI lập gia phả/ })).not.toBeInTheDocument();
  });
});
