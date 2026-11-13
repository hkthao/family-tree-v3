import { useState } from "react";

import {
  IconRefresh,
} from "@/components/icons";
import { Button } from "@/components/ui/button";

import { t } from "@lingui/core/macro";
export function RefreshIconButton({
  onClick,
  busy,
  compact = false,
}: {
  onClick: () => void;
  busy: boolean;
  /** Dạng nhỏ không viền để nhét vào ô tìm kiếm (rightSlot), như Danh bạ. */
  compact?: boolean;
}) {
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onClick}
      disabled={busy}
      aria-label={t`Tải lại`}
      title={busy ? t`Đang tải…` : t`Tải lại dữ liệu mới nhất`}
      className={compact ? "h-8 w-8 shrink-0 border-0 bg-transparent p-0 hover:bg-muted" : "h-9 w-9 p-0 shrink-0"}
    >
      <IconRefresh className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
    </Button>
  );
}

export function CollapsibleHint({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <p
        className={`text-sm text-muted-foreground ${
          expanded ? "" : "line-clamp-1 sm:line-clamp-none"
        }`}
      >
        {children}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="mt-1 text-xs text-primary hover:underline sm:hidden"
      >
        {expanded ? t`Thu gọn` : t`Xem thêm`}
      </button>
    </div>
  );
}

// ───────────── Health (Hệ thống) tab ─────────────────────────────────
