import { useState } from "react";

import { IconRefresh } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { checkForUpdate, hasPendingUpdate } from "@/lib/pwa";

/**
 * "Kiểm tra cập nhật" — user-initiated SW update check.
 *
 * The PWA already polls sw.js every 60 minutes (see pwa.ts), but
 * after a deploy users sometimes want to grab the new build now.
 * Click → registration.update() → if a new build is available, the
 * existing UpdateBanner takes over and prompts to apply. If not,
 * we tell the user they're already on the latest.
 */
export function CheckUpdateButton({
  compact = false,
}: { compact?: boolean } = {}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await checkForUpdate();
      if (!ok) {
        toast.error("Trình duyệt không hỗ trợ kiểm tra cập nhật");
        return;
      }
      // The SW lifecycle (install → waiting → ready) takes a moment;
      // give it ~1s before we declare "already on latest." Any longer
      // and onNeedRefresh would have already fired, surfacing the
      // banner — at which point this toast becomes redundant.
      await new Promise((r) => setTimeout(r, 1200));
      if (hasPendingUpdate()) {
        toast.success("Có bản mới — bấm Cập nhật ở banner phía dưới");
      } else {
        toast.success("Đang dùng phiên bản mới nhất");
      }
    } catch (e) {
      toast.error("Không kiểm tra được", {
        description: (e as Error).message,
      });
    } finally {
      setBusy(false);
    }
  }

  if (compact) {
    // Drawer-footer variant — sits on one row with the QR / Góp ý
    // siblings, so labels stay tight ("Cập nhật" vs the full
    // "Kiểm tra cập nhật").
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        title={busy ? "Đang kiểm tra…" : "Kiểm tra cập nhật"}
        className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-md border border-input bg-background hover:bg-muted disabled:opacity-50 px-2 h-10 text-sm"
      >
        <IconRefresh
          className={`h-4 w-4 shrink-0 ${busy ? "animate-spin" : ""}`}
        />
        {busy ? "…" : "Cập nhật"}
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-full"
      onClick={onClick}
      disabled={busy}
    >
      <IconRefresh className={`h-4 w-4 mr-1.5 ${busy ? "animate-spin" : ""}`} />
      {busy ? "Đang kiểm tra…" : "Kiểm tra cập nhật"}
    </Button>
  );
}
