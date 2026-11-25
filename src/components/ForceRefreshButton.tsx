import { useState } from "react";

import { IconRefresh } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { forceRefreshAll } from "@/lib/queryClient";

import { t } from "@lingui/core/macro";

/**
 * "Tải lại toàn bộ dữ liệu" — bỏ hết cache trên máy rồi tải lại trang (không đăng xuất).
 * Dùng khi dữ liệu vừa được thêm từ nơi khác (MCP, người khác nhập) mà app chưa hiện: cache giữ tới 24 giờ
 * và nút "Làm mới" theo data_version không phủ hết các loại dữ liệu.
 */
export function ForceRefreshButton({
  compact = false,
}: { compact?: boolean } = {}) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await forceRefreshAll();
    } catch {
      setBusy(false);
    }
  };
  if (compact) {
    // Cùng kiểu và chiều cao (h-10) với ô QR cạnh nó trong chân menu.
    return (
      <button
        type="button"
        onClick={run}
        disabled={busy}
        title={t`Tải lại toàn bộ dữ liệu`}
        aria-label={t`Tải lại toàn bộ dữ liệu`}
        className="flex-[2] min-w-0 inline-flex items-center justify-center gap-1.5 rounded-md border border-input bg-background hover:bg-muted disabled:opacity-50 px-2 h-10 text-sm whitespace-nowrap"
      >
        <IconRefresh
          className={`h-4 w-4 shrink-0 ${busy ? "animate-spin" : ""}`}
        />
        <span className="truncate">
          {busy ? t`Đang tải lại…` : t`Tải lại dữ liệu`}
        </span>
      </button>
    );
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-full"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await forceRefreshAll();
        } catch {
          setBusy(false);
        }
      }}
    >
      <IconRefresh className={`mr-1.5 h-4 w-4 ${busy ? "animate-spin" : ""}`} />
      {busy ? t`Đang tải lại…` : t`Tải lại toàn bộ dữ liệu`}
    </Button>
  );
}
