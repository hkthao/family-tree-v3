import { useState } from "react";

import {
  IconRefresh,
} from "@/components/icons";
import { Button } from "@/components/ui/button";

export function RefreshIconButton({
  onClick,
  busy,
}: {
  onClick: () => void;
  busy: boolean;
}) {
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onClick}
      disabled={busy}
      aria-label="Tải lại"
      title={busy ? "Đang tải…" : "Tải lại dữ liệu mới nhất"}
      className="h-9 w-9 p-0 shrink-0"
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
        {expanded ? "Thu gọn" : "Xem thêm"}
      </button>
    </div>
  );
}

// ───────────── Health (Hệ thống) tab ─────────────────────────────────
