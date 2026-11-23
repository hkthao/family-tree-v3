/// <reference types="@testing-library/jest-dom" />
/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialogProvider } from "@/components/ConfirmDialog";
import { FeaturesButton } from "@/components/FeaturesButton";
import { filterHubGroups, type HubGroup } from "@/hooks/useHubGroups";

const GROUPS: HubGroup[] = [
  {
    id: "clan-core",
    label: "Dòng họ",
    tiles: [
      {
        key: "/clans/c1/people",
        label: "Danh bạ",
        icon: <i />,
        to: "/clans/c1/people",
      },
      {
        key: "/clans/c1/tree",
        label: "Cây gia phả",
        icon: <i />,
        to: "/clans/c1/tree",
        badge: 3,
      },
    ],
  },
  {
    id: "global",
    label: "Chung",
    tiles: [
      {
        key: "/help",
        label: "Trợ giúp",
        hint: "Hướng dẫn",
        icon: <i />,
        to: "/help",
      },
    ],
  },
];

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/hooks/useHubGroups", async (orig) => ({
  ...(await orig<typeof import("@/hooks/useHubGroups")>()),
  useHubGroups: () => GROUPS,
}));

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname + l.search}</output>;
}

function renderAt(path: string) {
  return render(
    <ConfirmDialogProvider>
      <MemoryRouter initialEntries={[path]}>
        <FeaturesButton />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </ConfirmDialogProvider>,
  );
}

describe("filterHubGroups", () => {
  it("lọc không dấu và bỏ nhóm hết mục", () => {
    const out = filterHubGroups(GROUPS, "cay gia");
    expect(out).toHaveLength(1);
    expect(out[0].tiles.map((x) => x.label)).toEqual(["Cây gia phả"]);
    expect(filterHubGroups(GROUPS, "")).toBe(GROUPS);
  });
});

describe("FeaturesButton", () => {
  it("bấm nút mở ngăn kéo liệt kê mọi tính năng", () => {
    renderAt("/clans/c1/people");
    expect(screen.queryByText("Cây gia phả")).toBeNull();
    fireEvent.click(screen.getByLabelText("Tất cả tính năng"));
    expect(screen.getByTestId("where")).toHaveTextContent("panel=features");
    expect(screen.getByText("Danh bạ")).toBeInTheDocument();
    expect(screen.getByText("Cây gia phả")).toBeInTheDocument();
    expect(screen.getByText("Trợ giúp")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument(); // badge việc chờ
  });

  it("mục của trang đang mở được đánh dấu", () => {
    renderAt("/clans/c1/people?panel=features");
    const cur = screen.getByText("Danh bạ").closest("button");
    expect(cur).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByText("Cây gia phả").closest("button"),
    ).not.toHaveAttribute("aria-current");
  });

  it("ô lọc thu hẹp danh sách", () => {
    renderAt("/clans/c1/people?panel=features");
    fireEvent.change(screen.getByPlaceholderText("Tìm tính năng…"), {
      target: { value: "tro giup" },
    });
    expect(screen.getByText("Trợ giúp")).toBeInTheDocument();
    expect(screen.queryByText("Cây gia phả")).toBeNull();
  });

  it("chọn một mục thì chuyển trang", () => {
    renderAt("/clans/c1/people?panel=features");
    fireEvent.click(screen.getByText("Cây gia phả"));
    expect(screen.getByTestId("where")).toHaveTextContent("/clans/c1/tree");
  });
});
