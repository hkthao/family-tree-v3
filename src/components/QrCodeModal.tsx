import { useEffect, useRef, useState } from "react";

import { IconDownload } from "@/components/icons";
import { SidePanel } from "@/components/SidePanel";
import { Button } from "@/components/ui/button";
import { PanelActionBar } from "@/components/ui/form-actions";

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
 * Ngăn kéo hiển thị mã QR cho một URL. Used by share
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

  if (!open) return null;

  // Ngăn kéo bên phải (SidePanel, portal ra <body>) thay cho hộp thoại giữa màn
  // hình; Esc / nền mờ / X do SidePanel lo. Giữ tên QrCodeModal để các nơi gọi
  // (chi tiết người, mộ phần, di sản, link chia sẻ, QR ứng dụng) không phải đổi.
  return (
    <SidePanel
      open
      title={title ?? "Mã QR"}
      subtitle={description}
      onClose={onClose}
      guard={false}
    >
      <div className="flex flex-1 flex-col space-y-3">
        <div className="flex min-h-[344px] items-center justify-center rounded-md bg-white p-3">
          {loading || !url ? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div
                className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary"
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
            className="break-all text-center font-mono text-xs text-muted-foreground"
            aria-hidden="true"
          >
            {url}
          </p>
        )}

        {err && <p className="text-center text-sm text-destructive">{err}</p>}

        {dataUrl && (
          <PanelActionBar>
            {onDownloadPdf && (
              <Button
                type="button"
                variant="outline"
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
                <IconDownload className="mr-1.5 h-4 w-4" />
                {pdfBusy ? "Đang tạo PDF…" : "Tải PDF danh thiếp"}
              </Button>
            )}
            <Button asChild>
              <a href={dataUrl} download="qr-gia-pha.png">
                <IconDownload className="mr-1.5 h-4 w-4" />
                Lưu ảnh QR
              </a>
            </Button>
          </PanelActionBar>
        )}
      </div>
    </SidePanel>
  );
}
