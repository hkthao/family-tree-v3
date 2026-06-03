import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { IconX } from "@/components/icons";

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * Called with the decoded payload as soon as a QR is recognised.
   * Caller decides what to do (navigate, fetch, etc.).
   */
  onDecode: (text: string) => void;
  title?: string;
  description?: string;
}

/**
 * Camera-based QR scanner. Lazy-imports `qr-scanner` so the lib
 * only loads when the user actually opens the scanner. Decodes
 * to a string then hands off to onDecode — keeps URL routing
 * concerns out of the lens code.
 *
 * Stops the camera + frees resources when the modal closes
 * (or the component unmounts mid-scan).
 */
export function QrScannerModal({ open, onClose, onDecode, title, description }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<{ stop: () => void; destroy: () => void } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setErr(null);

    (async () => {
      try {
        const { default: QrScanner } = await import("qr-scanner");
        if (cancelled) return;
        const video = videoRef.current;
        if (!video) return;

        const scanner = new QrScanner(
          video,
          (result) => {
            onDecode(result.data);
            scanner.stop();
          },
          {
            highlightScanRegion: true,
            highlightCodeOutline: true,
            preferredCamera: "environment",
          },
        );
        scannerRef.current = scanner;
        await scanner.start();
      } catch (e) {
        if (!cancelled) {
          setErr(
            "Không mở được camera. Cho phép quyền camera trong trình duyệt rồi thử lại.",
          );
          // Surface the underlying error to console for debug.
          // eslint-disable-next-line no-console
          console.warn("[qr-scanner]", e);
        }
      }
    })();

    return () => {
      cancelled = true;
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, [open, onDecode]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "Quét mã QR"}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-lg bg-card shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute right-3 top-3 z-10 h-9 w-9 inline-flex items-center justify-center rounded-md bg-black/40 text-white hover:bg-black/60"
        >
          <IconX className="h-5 w-5" />
        </button>

        <div className="p-4 space-y-3">
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
        </div>

        <div className="relative bg-black aspect-square">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          {err && (
            <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/70">
              <p className="text-sm text-white text-center">{err}</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
