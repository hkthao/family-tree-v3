/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { KhoeOgImage, OG_H, OG_W } from "@/components/cards/KhoeOgImage";

afterEach(cleanup);

describe("KhoeOgImage (mẫu T6, 1200×630)", () => {
  it("đúng kích thước OG; hiện tên họ, tiêu đề, phụ đề; thiệp được thu nhỏ vừa khung giữ tỉ lệ", () => {
    const { container } = render(<KhoeOgImage card={<div data-testid="c">THIEP</div>} cardW={1080} cardH={1920} clanName="Nhà Trần" title="Chào đón" subtitle="Đời 32" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe(`${OG_W}px`);
    expect(root.style.height).toBe(`${OG_H}px`);
    expect(screen.getByText("Nhà Trần")).toBeInTheDocument();
    expect(screen.getByText("Chào đón")).toBeInTheDocument();
    expect(screen.getByText("Đời 32")).toBeInTheDocument();
    // khổ dọc 1080×1920 vào khung 480×500: scale = 500/1920
    const inner = screen.getByTestId("c").parentElement as HTMLElement;
    expect(inner.style.transform).toBe(`scale(${500 / 1920})`);
  });

  it("khổ vuông vừa khung 480 rộng; không có phụ đề thì không vẽ dòng phụ", () => {
    render(<KhoeOgImage card={<div data-testid="c" />} cardW={1080} cardH={1080} clanName="H" title="T" />);
    expect((screen.getByTestId("c").parentElement as HTMLElement).style.transform).toBe(`scale(${480 / 1080})`);
  });
});
