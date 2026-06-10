import { useState } from "react";

import { IconQrCode } from "@/components/icons";
import { QrCodeModal } from "@/components/QrCodeModal";

/**
 * Drawer-footer button: opens a QR for the app root URL so the
 * user can hand their screen to a relative and have them scan it
 * with their phone camera. Friendlier than typing the URL.
 */
export function ShareAppQrButton() {
  const [open, setOpen] = useState(false);
  const url = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Chia sẻ app qua mã QR"
        aria-label="Chia sẻ qua mã QR"
        className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-md border border-input bg-background hover:bg-muted px-2 h-10 text-sm whitespace-nowrap"
      >
        <IconQrCode className="h-4 w-4 shrink-0" />
        <span className="sr-only">Chia sẻ QR</span>
      </button>
      <QrCodeModal
        open={open}
        onClose={() => setOpen(false)}
        url={url}
        title="Mở Gia phả trên điện thoại"
        description="Mở camera điện thoại, hướng vào mã QR để mở app."
      />
    </>
  );
}
