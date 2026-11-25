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
export function ForceRefreshButton() {
  const [busy, setBusy] = useState(false);
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
