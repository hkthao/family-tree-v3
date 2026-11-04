/// <reference types="@testing-library/jest-dom" />
/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { FabGroup } from "@/components/FabGroup";

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("FabGroup", () => {
  it("nhiều hành động: bấm nút chính sổ ra, Esc thu lại", () => {
    wrap(
      <FabGroup
        actions={[
          { label: "Thêm người", icon: <i />, to: "/a" },
          { label: "Nhập Excel", icon: <i />, to: "/b" },
        ]}
      />,
    );
    expect(screen.queryByText("Nhập Excel")).toBeNull();
    fireEvent.click(screen.getByLabelText("Thêm"));
    expect(screen.getByText("Thêm người")).toBeInTheDocument();
    expect(screen.getByText("Nhập Excel")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("Nhập Excel")).toBeNull();
  });

  it("chọn một hành động thì thu lại", () => {
    wrap(
      <FabGroup
        actions={[
          { label: "Thêm người", icon: <i />, to: "/a" },
          { label: "Sinh bằng AI", icon: <i />, to: "/b" },
        ]}
      />,
    );
    fireEvent.click(screen.getByLabelText("Thêm"));
    fireEvent.click(screen.getByText("Sinh bằng AI"));
    expect(screen.queryByText("Sinh bằng AI")).toBeNull();
  });

  it("một hành động duy nhất: nút nổi thường, không có menu", () => {
    wrap(<FabGroup actions={[{ label: "Quản lý cơ sở", icon: <i />, to: "/c" }]} />);
    expect(screen.getByLabelText("Quản lý cơ sở")).toBeInTheDocument();
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
