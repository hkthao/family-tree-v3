import { useEffect, useState } from "react";

import { IconRefresh } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useClanFreshness } from "@/hooks/useClanFreshness";
import { cn } from "@/lib/utils";

interface Props {
  clanId: string;
  /** data_version from the cached clan detail query. */
  cachedVersion: number | null;
  /**
   * Drop the "Cập nhật lúc HH:MM" status text + collapse the
   * button to an icon-only h-10 square. The status moves into
   * the button's title attribute. Used inside dense toolbars
   * where the long form chews up a whole row on mobile.
   */
  compact?: boolean;
  /** Override style của nút compact (vd nhét gọn bên trong ô tìm kiếm). */
  className?: string;
}

function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function RefreshButton({ clanId, cachedVersion, compact, className }: Props) {
  const { lastSyncedAt, isChecking, refresh } = useClanFreshness(
    clanId,
    cachedVersion,
  );
  const [flash, setFlash] = useState<"fresh" | "updated" | null>(null);

  useEffect(() => {
    if (!flash) return;
    const h = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(h);
  }, [flash]);

  const status = lastSyncedAt
    ? `Cập nhật lúc ${formatTime(lastSyncedAt)}`
    : "Chưa đồng bộ";

  const flashedStatus =
    flash === "updated"
      ? "Đã có dữ liệu mới"
      : flash === "fresh"
        ? "Đã là mới nhất"
        : status;

  if (compact) {
    return (
      <Button
        variant="outline"
        size="sm"
        className={cn("h-10 w-10 p-0 shrink-0", className)}
        title={isChecking ? "Đang kiểm tra…" : flashedStatus}
        aria-label="Làm mới"
        onClick={async () => {
          const outcome = await refresh();
          setFlash(outcome);
        }}
        disabled={isChecking}
      >
        <IconRefresh className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`} />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-muted-foreground" aria-live="polite">
        {flashedStatus}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          const outcome = await refresh();
          setFlash(outcome);
        }}
        disabled={isChecking}
      >
        <IconRefresh className={`h-4 w-4 mr-1.5 ${isChecking ? "animate-spin" : ""}`} />
        {isChecking ? "Đang kiểm tra…" : "Làm mới"}
      </Button>
    </div>
  );
}
