/// <reference types="@testing-library/jest-dom" />
/**
 * @vitest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DatePicker } from "@/components/ui/date-picker";

function Harness({ initial = "", min }: { initial?: string; min?: string }) {
  const [v, setV] = React.useState(initial);
  return (
    <>
      <DatePicker id="d" value={v} onChange={setV} min={min} />
      <output data-testid="out">{v}</output>
    </>
  );
}

describe("DatePicker", () => {
  it("gõ ngày/tháng/năm: tự chèn / và trả yyyy-mm-dd", () => {
    render(<Harness />);
    const input = document.getElementById("d") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "23112026" } });
    expect(input.value).toBe("23/11/2026");
    expect(screen.getByTestId("out")).toHaveTextContent("2026-11-23");
  });

  it("ngày không tồn tại: không nhận giá trị, báo lỗi", () => {
    render(<Harness />);
    const input = document.getElementById("d") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "31022026" } });
    expect(screen.getByTestId("out")).toHaveTextContent("");
    expect(screen.getByText(/Ngày không hợp lệ/)).toBeInTheDocument();
  });

  it("mở lịch, chọn một ngày", () => {
    render(<Harness initial="2026-11-05" />);
    fireEvent.focus(document.getElementById("d")!);
    expect(screen.getByText("CN")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "20" }));
    expect(screen.getByTestId("out")).toHaveTextContent("2026-11-20");
  });

  it("ngày ngoài min bị khoá", () => {
    render(<Harness initial="2026-11-05" min="2026-11-10" />);
    fireEvent.focus(document.getElementById("d")!);
    expect(screen.getByRole("button", { name: "9" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "11" })).toBeEnabled();
  });
});
