/// <reference types="@testing-library/jest-dom" />
/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

/**
 * Trang toàn nền tảng phải nằm trong khung chung.
 *
 * Quên bọc khung là trang vẽ đè lên chỗ của menu trái — nhìn ra y như "mất
 * menu", và người dùng báo đúng bằng câu đó. Lỗi này không lộ ở máy dev
 * (màn hẹp thì menu vốn đã ẩn), chỉ lộ trên màn rộng.
 */

const auth = { user: { id: "u1" } as { id: string } | null };
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: auth.user, loading: false }),
}));
vi.mock("@/components/AppHeader", () => ({
  AppHeader: () => <header data-testid="app-header" />,
}));
vi.mock("@/lib/queries/podcast", () => ({
  listPodcastPage: vi.fn(async () => ({ rows: [], total: 0 })),
  PODCAST_PAGE_SIZE: 10,
  facebookEmbedUrl: () => "",
  formatDuration: () => null,
}));

import Podcast from "@/pages/Podcast";

const renderPage = () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Podcast />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("trang Podcast dùng khung chung", () => {
  it("người đã đăng nhập: có header và chừa chỗ cho menu trái", async () => {
    auth.user = { id: "u1" };
    const { container } = renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("app-header")).toBeInTheDocument(),
    );
    // `lg:pl-72` chính là chỗ chừa cho menu. Thiếu nó là trang đè lên menu.
    expect(container.querySelector(".lg\\:pl-72")).not.toBeNull();
  });

  it("khách chưa đăng nhập: không menu, có nút Đăng nhập", async () => {
    auth.user = null;
    const { container } = renderPage();
    await waitFor(() =>
      expect(screen.getByText("Đăng nhập")).toBeInTheDocument(),
    );
    expect(container.querySelector(".lg\\:pl-72")).toBeNull();
  });
});
