/// <reference types="@testing-library/jest-dom" />
/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

/**
 * Cây thư mục phải sống được với BẢN GHI CŨ trong cache của người dùng.
 *
 * Cache react-query lưu ở máy người dùng và sống qua nhiều lần deploy.
 * Mỗi lần thêm field vào một shape đang nằm trong đó là một lần cả trang
 * có nguy cơ trắng xoá — đã dính đúng vết này ba lần (v4 sổ posts, v7 sổ
 * tay, v8 chính là cây thư mục thêm `spouses`). Bump buster là cách sửa
 * cho người đang dính; test này giữ đường lui cho lần sau.
 */

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, loading: false }),
}));
vi.mock("@/lib/queries/person-links", () => ({
  getInlawGhostSpouses: vi.fn(async () => []),
}));
vi.mock("@/lib/photoUpload", () => ({
  getSignedPhotoUrlMap: vi.fn(async () => new Map()),
  PHOTO_URL_STALE_MS: 1000,
}));
vi.mock("@/lib/queries/treeFolder", () => ({
  // Cố ý KHÔNG có `spouses` — đúng hình dạng bản ghi do bản cũ ghi vào cache.
  loadFolderRoots: vi.fn(async () => ({
    roots: [
      {
        id: "p1",
        name: "Nguyễn Văn Tổ",
        gender: "M",
        generation: 1,
        birthYear: 1900,
        deathYear: 1970,
        isLiving: false,
        photoPath: null,
        hasChildren: false,
      },
    ],
    orphanCount: 0,
  })),
  loadFolderNode: vi.fn(),
  loadUnlinked: vi.fn(),
}));

import { TreeFolderView } from "@/components/TreeFolderView";

describe("TreeFolderView với cache của bản cũ", () => {
  it("vẫn vẽ được người dù bản ghi thiếu field `spouses`", async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <TreeFolderView clanId="c1" source="persons" />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText("Nguyễn Văn Tổ")).toBeInTheDocument(),
    );
  });
});
