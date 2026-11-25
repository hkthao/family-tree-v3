/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import ShortShareRedirect from "@/pages/ShortShareRedirect";

describe("/s/:token (địa chỉ ngắn của link cây)", () => {
  it("chuyển sang /share/:token, giữ query và hash", async () => {
    render(
      <MemoryRouter initialEntries={["/s/abc123?site=1#x"]}>
        <Routes>
          <Route path="/s/:token" element={<ShortShareRedirect />} />
          <Route path="/share/:token" element={<div>trang dòng họ</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("trang dòng họ")).toBeTruthy();
  });
});
