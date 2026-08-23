import { useEffect, useState } from "react";
import { IconRefresh, IconX } from "@/components/icons";

import { Button } from "@/components/ui/button";
import { applyPendingUpdate, subscribeUpdateAvailable } from "@/lib/pwa";

/**
 * Sticky bottom-of-screen banner that shows when the service worker
 * has fetched a new build in the background. Clicking "Cập nhật"
 * activates the new SW and reloads the page; the dismiss button
 * lets the user finish what they were doing and pick up the new
 * version on next refresh.
 */
export function UpdateBanner() {
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => subscribeUpdateAvailable(setAvailable), []);

  if (!available || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-20 lg:bottom-4 z-30 mx-auto max-w-md px-4"
    >
      <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-lg">
        <p className="flex-1 text-sm">
          Đã có phiên bản mới. Cập nhật để dùng tính năng mới nhất.
        </p>
        <Button size="sm" onClick={() => applyPendingUpdate()}>
          <IconRefresh className="h-4 w-4 mr-1.5" />
          Cập nhật
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Để sau"
          onClick={() => setDismissed(true)}
        >
          <IconX className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
