/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { useClientPaging, useUrlFilter } from "@/hooks/useClientPaging";

const wrap = (initial: string) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>;
  };

function useBoth() {
  const [loai, setLoai] = useUrlFilter<string>("loai", "");
  const paging = useClientPaging(Array.from({ length: 100 }, (_, i) => i), 10);
  const loc = useLocation();
  return { loai, setLoai, paging, search: loc.search };
}

describe("useUrlFilter", () => {
  it("đọc giá trị từ URL (Back khôi phục đúng bộ lọc + trang)", () => {
    const { result } = renderHook(useBoth, { wrapper: wrap("/x?loai=donation&trang=3") });
    expect(result.current.loai).toBe("donation");
    expect(result.current.paging.page).toBe(3);
  });

  it("đổi bộ lọc thì về trang đầu trong MỘT lần ghi URL", () => {
    const { result } = renderHook(useBoth, { wrapper: wrap("/x?trang=4") });
    act(() => result.current.setLoai("fund"));
    expect(result.current.loai).toBe("fund");
    expect(result.current.paging.page).toBe(1);
    expect(result.current.search).toBe("?loai=fund");
  });

  it("giá trị mặc định thì bỏ khỏi URL", () => {
    const { result } = renderHook(useBoth, { wrapper: wrap("/x?loai=fund") });
    act(() => result.current.setLoai(""));
    expect(result.current.search).toBe("");
  });
});
