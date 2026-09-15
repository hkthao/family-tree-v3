/// <reference types="@testing-library/jest-dom" />
/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

/**
 * Mỗi lúc chỉ MỘT tập được phát.
 *
 * Để mỗi thẻ tự giữ trạng thái thì bấm ba tập là ba trình phát cùng chạy,
 * ba luồng tiếng chồng lên nhau — và ba iframe Facebook cùng nằm trên
 * trang, tức ba lần mã theo dõi của Meta được nạp trong khi người dùng chỉ
 * định nghe một tập.
 */

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" }, loading: false }),
}));
vi.mock("@/components/AppHeader", () => ({ AppHeader: () => <header /> }));

const EPISODE_ONE = {
  ...{
    id: "e1",
    fb_video_id: "1",
    title: "Tập một",
    description: null,
    permalink_url: "https://www.facebook.com/reel/1/",
    thumbnail_url: null,
    duration_seconds: 600,
    published_at: "2026-09-01T00:00:00+0000",
    is_visible: true,
    title_edited: false,
    synced_at: "2026-09-01T00:00:00+0000",
  },
};

const EPISODES = [
  EPISODE_ONE,
  {
    ...EPISODE_ONE,
    id: "e2",
    fb_video_id: "2",
    title: "Tập hai",
    permalink_url: "https://www.facebook.com/reel/2/",
  },
];

vi.mock("@/lib/queries/podcast", () => ({
  listPodcastPage: vi.fn(async () => ({ rows: EPISODES, total: 2 })),
  PODCAST_PAGE_SIZE: 10,
  facebookEmbedUrl: (u: string) =>
    `https://www.facebook.com/plugins/video.php?href=${u}`,
  formatDuration: () => "10:00",
}));

import Podcast from "@/pages/Podcast";

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Podcast />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("trình phát podcast", () => {
  it("mở tập nào cũng chỉ MỘT khung phát trên trang", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Tập một")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Tập một"));
    await waitFor(() =>
      expect(document.querySelectorAll("iframe")).toHaveLength(1),
    );

    // Sang tập sau ngay trong trình xem — vẫn đúng một khung.
    fireEvent.click(screen.getByRole("button", { name: /Tập sau/ }));
    await waitFor(() => {
      const frames = document.querySelectorAll("iframe");
      expect(frames).toHaveLength(1);
      expect(frames[0].getAttribute("src")).toContain("/reel/2/");
    });
  });

  it("chưa bấm thì KHÔNG có iframe nào — không gọi Facebook khi chưa ai bảo", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Tập một")).toBeInTheDocument());
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
  });

  it("hai nút Thích/Bình luận trỏ đúng bài gốc trên Facebook", async () => {
    // Chúng không giả vờ đã thích — bấm là mở bài gốc, nơi người dùng
    // chắc chắn thích và bình luận được kể cả khi nút trong khung nhúng
    // không bấm nổi (chưa đăng nhập Facebook trên trình duyệt đó).
    renderPage();
    await waitFor(() => expect(screen.getByText("Tập một")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Tập một"));
    await waitFor(() =>
      expect(screen.getByText("Thích bài gốc")).toBeInTheDocument(),
    );
    for (const label of ["Thích bài gốc", "Bình luận"]) {
      const link = screen.getByText(label).closest("a");
      expect(link?.getAttribute("href")).toBe(
        "https://www.facebook.com/reel/1/",
      );
      expect(link?.getAttribute("target")).toBe("_blank");
    }
  });

  it("đóng trình xem thì iframe biến mất và nền hết bị khoá cuộn", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Tập một")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Tập một"));
    await waitFor(() =>
      expect(document.querySelectorAll("iframe")).toHaveLength(1),
    );
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    await waitFor(() =>
      expect(document.querySelectorAll("iframe")).toHaveLength(0),
    );
    // Quên mở khoá là cả trang đứng im, người dùng tưởng app treo.
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("phím Esc đóng trình xem", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Tập một")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Tập một"));
    await waitFor(() =>
      expect(document.querySelectorAll("iframe")).toHaveLength(1),
    );
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() =>
      expect(document.querySelectorAll("iframe")).toHaveLength(0),
    );
  });
});
