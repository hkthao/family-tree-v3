import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { IconDownload, IconX } from "@/components/icons";
import { Button } from "@/components/ui/button";

interface Props {
  url: string;
  title?: string;
  description?: string;
  open: boolean;
  onClose: () => void;
  /**
   * When true, render a centered spinner in place of the QR
   * canvas. Use this while the caller is still resolving the
   * URL (eg waiting for an edge function to mint a magic link).
   */
  loading?: boolean;
  /**
   * Optional secondary download action — surfaces a "Tải PDF
   * danh thiếp" button below the PNG. Caller owns the side
   * effect (mints the share link, renders the PDF, triggers the
   * browser download). The modal just shows a pending spinner
   * while the returned promise is in flight.
   */
  onDownloadPdf?: () => Promise<void>;
}

/**
 * Modal that renders a QR code for the given URL. Used by share
 * links + the drawer "share this app" affordance so a phone next
 * to the screen can scan and jump straight to the URL without
 * typing.
 *
 * QR rendering is dynamic-imported so the qrcode dependency
 * (~30 KB) only loads when someone actually opens the modal.
 * Output is a PNG data URL drawn onto the canvas and also
 * stamped onto an <a download> link for "Lưu ảnh QR".
 */
export function QrCodeModal({
  url,
  title,
  description,
  open,
  onClose,
  loading,
  onDownloadPdf,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    if (!open || loading || !url) return;
    let cancelled = false;
    setErr(null);
    setDataUrl(null);
    (async () => {
      try {
        const QR = (await import("qrcode")).default;
        const cv = canvasRef.current;
        if (!cv) return;
        // Margin 1 = 1 quiet-zone module each side. 320 px renders
        // crisp at retina; phones with auto-focus pick it up at >2 cm.
        await QR.toCanvas(cv, url, {
          width: 320,
          margin: 1,
          color: { dark: "#1F1A17", light: "#FFFFFF" },
          errorCorrectionLevel: "M",
        });
        if (cancelled) return;
        setDataUrl(cv.toDataURL("image/png"));
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, url, loading]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  // Render into <body> via portal so the dialog escapes any
  // ancestor with `transform` / `filter` applied (the drawer uses
  // translate-x for slide-in, which would otherwise pin our
  // `position: fixed` to the drawer instead of the viewport).
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "Mã QR"}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-lg bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute right-3 top-3 h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
        >
          <IconX className="h-5 w-5" />
        </button>

        <div className="space-y-3">
          {title && (
            <h2 className="clan-name text-lg font-semibold text-primary text-center">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-sm text-muted-foreground text-center">
              {description}
            </p>
          )}

          <div className="flex justify-center items-center bg-white rounded-md p-3 min-h-[344px]">
            {loading || !url ? (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <div
                  className="h-10 w-10 rounded-full border-4 border-muted border-t-primary animate-spin"
                  aria-hidden="true"
                />
                <p className="text-sm">Đang tạo mã QR…</p>
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                width={320}
                height={320}
                aria-label="Mã QR"
              />
            )}
          </div>

          {url && !loading && (
            <p
              className="text-xs text-muted-foreground text-center break-all font-mono"
              aria-hidden="true"
            >
              {url}
            </p>
          )}

          {err && (
            <p className="text-sm text-destructive text-center">{err}</p>
          )}

          {dataUrl && (
            <div className="flex justify-center gap-2 flex-wrap">
              <Button asChild variant="outline" size="sm">
                <a href={dataUrl} download="qr-gia-pha.png">
                  <IconDownload className="h-4 w-4 mr-1.5" />
                  Lưu ảnh QR
                </a>
              </Button>
              {onDownloadPdf && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pdfBusy}
                  onClick={async () => {
                    setPdfBusy(true);
                    try {
                      await onDownloadPdf();
                    } finally {
                      setPdfBusy(false);
                    }
                  }}
                >
                  <IconDownload className="h-4 w-4 mr-1.5" />
                  {pdfBusy ? "Đang tạo PDF…" : "Tải PDF danh thiếp"}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
