/// <reference types="@testing-library/jest-dom" />
/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ClanContextProvider, useClanContext } from "@/hooks/useClanContext";
import type { ClanDetail } from "@/lib/queries/clan-detail";

const clan = { id: "c1", name: "Họ Trần" } as ClanDetail;

function Probe() {
  return <span>{useClanContext().clan.name}</span>;
}

describe("useClanContext", () => {
  it("lấy từ <Outlet context> như trước", () => {
    render(
      <MemoryRouter initialEntries={["/x"]}>
        <Routes>
          <Route element={<Outlet context={{ clan }} />}>
            <Route path="/x" element={<Probe />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Họ Trần")).toBeInTheDocument();
  });

  it("lấy từ ClanContextProvider khi nằm NGOÀI Outlet (ngăn kéo) — từng ném TypeError", () => {
    render(
      <MemoryRouter>
        <ClanContextProvider value={{ clan }}>
          <Probe />
        </ClanContextProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("Họ Trần")).toBeInTheDocument();
  });
});
