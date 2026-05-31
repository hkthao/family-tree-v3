import { useEffect, useState } from "react";

import { IconRefresh } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useClanFreshness } from "@/hooks/useClanFreshness";

interface Props {
  clanId: string;
  /** data_version from the cached clan detail query. */
  cachedVersion: number | null;
}

function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function RefreshButton({ clanId, cachedVersion }: Props) {
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

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-muted-foreground" aria-live="polite">
        {flash === "updated"
          ? "Đã có dữ liệu mới"
          : flash === "fresh"
            ? "Đã là mới nhất"
            : status}
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
