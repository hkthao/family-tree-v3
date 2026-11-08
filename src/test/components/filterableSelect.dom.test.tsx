/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { FilterableSelect } from "@/components/FilterableSelect";

const OPTIONS = [
  { value: "01", label: "Hà Nội" },
  { value: "02", label: "Hồ Chí Minh" },
  { value: "03", label: "Đà Nẵng" },
];

function Harness() {
  const [v, setV] = useState("");
  return (
    <>
      <FilterableSelect
        id="p"
        value={v}
        onChange={setV}
        options={OPTIONS}
        emptyLabel="Chưa chọn"
        filterLabel="Lọc tỉnh"
      />
      <output data-testid="val">{v}</output>
    </>
  );
}

describe("FilterableSelect", () => {
  it("mở danh sách, gõ không dấu để lọc, Enter chọn kết quả đầu", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("combobox"));
    const input = screen.getByLabelText("Lọc tỉnh");
    fireEvent.change(input, { target: { value: "da nang" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByTestId("val").textContent).toBe("03");
    expect(screen.getByRole("combobox").textContent).toBe("Đà Nẵng");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("mở ra là con trỏ nằm sẵn trong ô tìm", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("combobox"));
    expect(document.activeElement).toBe(screen.getByLabelText("Lọc tỉnh"));
  });

  it("bấm một mục để chọn; Esc đóng không đổi giá trị", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText("Hồ Chí Minh"));
    expect(screen.getByTestId("val").textContent).toBe("02");
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.keyDown(screen.getByLabelText("Lọc tỉnh"), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByTestId("val").textContent).toBe("02");
  });
});
