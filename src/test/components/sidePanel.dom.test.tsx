/// <reference types="@testing-library/jest-dom" />
/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialogProvider } from "@/components/ConfirmDialog";
import { FormActions } from "@/components/ui/form-actions";
import { usePanel } from "@/components/panel/usePanel";
import { SidePanel } from "@/components/SidePanel";

function renderPanel(onClose = vi.fn(), guard = true) {
  render(
    <ConfirmDialogProvider>
      <SidePanel open title="Thêm người" onClose={onClose} guard={guard}>
        <form onSubmit={(e) => e.preventDefault()}>
          <input aria-label="Họ tên" />
          <button type="submit">Lưu</button>
        </form>
      </SidePanel>
    </ConfirmDialogProvider>,
  );
  return onClose;
}

describe("SidePanel — bảo vệ dữ liệu chưa lưu", () => {
  it("chưa gõ gì: đóng ngay, không hỏi", async () => {
    const onClose = renderPanel();
    fireEvent.click(screen.getAllByLabelText("Đóng")[1]);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Bỏ thay đổi chưa lưu?")).toBeNull();
  });

  it("đã gõ: hỏi xác nhận; 'Tiếp tục nhập' giữ nguyên, 'Bỏ thay đổi' mới đóng", async () => {
    const onClose = renderPanel();
    fireEvent.input(screen.getByLabelText("Họ tên"), { target: { value: "Trần" } });
    fireEvent.click(screen.getAllByLabelText("Đóng")[1]);
    expect(await screen.findByText("Bỏ thay đổi chưa lưu?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Tiếp tục nhập"));
    await waitFor(() => expect(screen.queryByText("Bỏ thay đổi chưa lưu?")).toBeNull());
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByLabelText("Đóng")[1]);
    fireEvent.click(await screen.findByText("Bỏ thay đổi"));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("guard=false (chat): đã gõ vẫn đóng ngay, không hỏi", async () => {
    const onClose = renderPanel(vi.fn(), false);
    fireEvent.input(screen.getByLabelText("Họ tên"), { target: { value: "Trần" } });
    fireEvent.click(screen.getAllByLabelText("Đóng")[1]);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Bỏ thay đổi chưa lưu?")).toBeNull();
  });

  it("gửi form xoá cờ đã sửa (Lưu & thêm nữa không bị hỏi oan)", async () => {
    const onClose = renderPanel();
    fireEvent.input(screen.getByLabelText("Họ tên"), { target: { value: "Trần" } });
    fireEvent.submit(screen.getByLabelText("Họ tên").closest("form")!);
    fireEvent.click(screen.getAllByLabelText("Đóng")[1]);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});

function Probe() {
  const { current, params, open, close } = usePanel();
  const loc = useLocation();
  return (
    <div>
      <span data-testid="url">{loc.pathname + loc.search}</span>
      <span data-testid="cur">{current ?? "-"}</span>
      <span data-testid="pid">{params.pid ?? "-"}</span>
      <button onClick={() => open("person-edit", { pid: "abc" })}>mo</button>
      <button onClick={close}>dong</button>
    </div>
  );
}

describe("usePanel — đồng bộ URL", () => {
  it("mở ghi ?panel=&pid= và giữ tham số khác; đóng gỡ đúng các tham số panel", async () => {
    render(
      <MemoryRouter initialEntries={["/clans/1/people?q=tran"]}>
        <Probe />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("mo"));
    expect(screen.getByTestId("cur").textContent).toBe("person-edit");
    expect(screen.getByTestId("pid").textContent).toBe("abc");
    const url = screen.getByTestId("url").textContent!;
    expect(url).toContain("q=tran");
    expect(url).toContain("panel=person-edit");
    expect(url).toContain("pid=abc");

    fireEvent.click(screen.getByText("dong"));
    await waitFor(() => expect(screen.getByTestId("cur").textContent).toBe("-"));
    expect(screen.getByTestId("url").textContent).toBe("/clans/1/people?q=tran");
  });

  it("vào thẳng bằng link có ?panel= rồi đóng: gỡ tham số, giữ bộ lọc", async () => {
    render(
      <MemoryRouter initialEntries={["/clans/1/people?q=tran&panel=person-new"]}>
        <Probe />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("cur").textContent).toBe("person-new");
    fireEvent.click(screen.getByText("dong"));
    await waitFor(() => expect(screen.getByTestId("cur").textContent).toBe("-"));
    expect(screen.getByTestId("url").textContent).toBe("/clans/1/people?q=tran");
  });
});

describe("FormActions trong ngăn kéo", () => {
  it("dùng thanh dính đáy (mt-auto, sticky) thay vì xếp dọc như trên trang", () => {
    render(
      <ConfirmDialogProvider>
        <SidePanel open title="Form" onClose={() => {}}>
          <form>
            <FormActions>
              <button type="button">Hủy</button>
              <button type="submit">Lưu</button>
            </FormActions>
          </form>
        </SidePanel>
      </ConfirmDialogProvider>,
    );
    const bar = screen.getByText("Lưu").parentElement!;
    expect(bar.className).toContain("sticky");
    expect(bar.className).toContain("mt-auto");
    expect(bar.className).toContain("justify-end");
  });

  it("ngoài ngăn kéo vẫn là bố cục cũ (không sticky)", () => {
    render(
      <FormActions>
        <button type="submit">Lưu</button>
      </FormActions>,
    );
    expect(screen.getByText("Lưu").parentElement!.className).not.toContain("sticky");
  });
});
