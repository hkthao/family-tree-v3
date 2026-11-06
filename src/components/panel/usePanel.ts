import { useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

/**
 * Ngăn kéo điều khiển bằng URL: `?panel=<id>&pid=<personId>&prel=<child|spouse|parent>&pfrom=<personId>`.
 * Mở = đẩy 1 history entry (Back của trình duyệt / điện thoại đóng panel,
 * tải lại trang khôi phục panel, link gửi người khác mở đúng panel). Tham số
 * mang tiền tố riêng để không đụng bộ lọc của trang (q, chi, đời…).
 */
export type PanelId = "person-view" | "person-new" | "person-edit" | "person-add" | "notifications"
  | "chat"
  | "grave-view"
  | "grave-new"
  | "grave-edit"
  | "heritage-view"
  | "heritage-new"
  | "heritage-edit"
  | "board-new"
  | "board-edit"
  | "clan-new"
  | "inlaw-new"
  | "custom-new"
  | "custom-edit"
  | "custom-import";

export interface PanelParams {
  /** Id bản ghi đang thao tác: người (sửa / thêm quan hệ), mộ phần, di sản, bài đăng. */
  pid?: string;
  /** Quan hệ mở thẳng (bỏ qua bước chọn). */
  prel?: "child" | "spouse" | "parent";
  /** Sao chép từ người này. */
  pfrom?: string;
}

const KEYS = ["panel", "pid", "prel", "pfrom"] as const;
/** Dấu trong history.state: panel này do app mở (đóng bằng Back được). */
const STATE_FLAG = "panelOpened";

export function usePanel() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const open = useCallback(
    (id: PanelId, p: PanelParams = {}) => {
      const next = new URLSearchParams(params);
      for (const k of KEYS) next.delete(k);
      next.set("panel", id);
      for (const [k, v] of Object.entries(p)) if (v) next.set(k, v);
      navigate({ pathname: location.pathname, search: `?${next}` }, { state: { [STATE_FLAG]: true } });
    },
    [params, location.pathname, navigate],
  );

  const close = useCallback(() => {
    const st = location.state as Record<string, unknown> | null;
    if (st?.[STATE_FLAG]) {
      navigate(-1);
      return;
    }
    // Vào thẳng bằng link có ?panel= → gỡ tham số, không thêm history.
    const next = new URLSearchParams(params);
    for (const k of KEYS) next.delete(k);
    setParams(next, { replace: true });
  }, [location.state, params, navigate, setParams]);

  const current = params.get("panel") as PanelId | null;
  return {
    current,
    params: {
      pid: params.get("pid") ?? undefined,
      prel: (params.get("prel") as PanelParams["prel"]) ?? undefined,
      pfrom: params.get("pfrom") ?? undefined,
    } satisfies PanelParams,
    open,
    close,
  };
}
