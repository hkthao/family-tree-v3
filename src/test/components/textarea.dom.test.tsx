/// <reference types="@testing-library/jest-dom" />
/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Textarea } from "@/components/ui/textarea";

describe("Textarea", () => {
  it("mặc định tối thiểu 3 dòng và tự giãn (không kéo tay, không thanh cuộn trong ô)", () => {
    render(<Textarea aria-label="Tiểu sử" />);
    const el = screen.getByLabelText("Tiểu sử");
    expect(el).toHaveAttribute("rows", "3");
    expect(el.className).toContain("resize-none");
    expect(el.className).toContain("overflow-hidden");
  });

  it("rows truyền vào được giữ; autoResize=false trả lại kéo tay", () => {
    render(<Textarea aria-label="Ghi chú" rows={5} autoResize={false} />);
    const el = screen.getByLabelText("Ghi chú");
    expect(el).toHaveAttribute("rows", "5");
    expect(el.className).not.toContain("resize-none");
  });

  it("gõ chữ đặt lại chiều cao theo scrollHeight và vẫn gọi onInput của cha", () => {
    const onInput = vi.fn();
    render(<Textarea aria-label="Nội dung" onInput={onInput} />);
    const el = screen.getByLabelText("Nội dung") as HTMLTextAreaElement;
    Object.defineProperty(el, "scrollHeight", { configurable: true, value: 180 });
    fireEvent.input(el, { target: { value: "dòng 1\ndòng 2\ndòng 3\ndòng 4" } });
    expect(el.style.height).toBe("180px");
    expect(onInput).toHaveBeenCalledTimes(1);
  });
});
