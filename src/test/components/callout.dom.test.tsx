/// <reference types="@testing-library/jest-dom" />
/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Callout } from "@/components/ui/callout";

describe("Callout", () => {
  it("hiện tiêu đề, nội dung và nút bên phải", () => {
    render(
      <Callout
        tone="warning"
        title="Có bản nháp"
        action={<button>Khôi phục</button>}
      >
        Bạn chưa bấm Lưu.
      </Callout>,
    );
    expect(screen.getByText("Có bản nháp")).toBeInTheDocument();
    expect(screen.getByText("Bạn chưa bấm Lưu.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Khôi phục" }),
    ).toBeInTheDocument();
  });

  it("icon={false} không vẽ icon; mặc định thì có", () => {
    const { container, rerender } = render(<Callout>Ghi chú</Callout>);
    expect(container.querySelector("svg")).not.toBeNull();
    rerender(<Callout icon={false}>Ghi chú</Callout>);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("Alert dùng cùng kiểu và có role=alert", () => {
    render(
      <Alert variant="destructive">
        <AlertDescription>Lỗi gì đó</AlertDescription>
      </Alert>,
    );
    const el = screen.getByRole("alert");
    expect(el).toHaveTextContent("Lỗi gì đó");
    expect(el.className).toContain("border-destructive");
  });
});
