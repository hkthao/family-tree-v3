import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { IconX } from "@/components/icons";

export interface LightboxImage {
  src: string;
  caption?: string | null;
}

const MIN = 1;
const MAX = 5;

/**
 * Modal xem ảnh phóng to: zoom bằng nút +/−, lăn chuột, double-click, và
 * chụm 2 ngón (mobile). Kéo để di chuyển khi đã phóng to. Mũi tên qua/lại
 * khi có nhiều ảnh. ESC / bấm nền để đóng.
 */
export function ImageLightbox({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: LightboxImage[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  const cur = images[index];
  const many = images.length > 1;

  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };
  const go = (next: number) => {
    if (next < 0 || next >= images.length) return;
    reset();
    onIndexChange(next);
  };
  const zoomTo = (s: number) => setScale(Math.min(MAX, Math.max(MIN, s)));

  // Reset zoom khi đổi ảnh từ ngoài.
  useEffect(reset, [index]);

  // ESC + qua/lại bằng phím; khoá cuộn nền.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(index - 1);
      else if (e.key === "ArrowRight") go(index + 1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, images.length]);

  if (!cur) return null;

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoomTo(scale + (e.deltaY < 0 ? 0.3 : -0.3));
  };

  const onPointerDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.MouseEvent) => {
    if (!drag.current) return;
    setOffset({
      x: drag.current.ox + (e.clientX - drag.current.x),
      y: drag.current.oy + (e.clientY - drag.current.y),
    });
  };
  const endDrag = () => (drag.current = null);

  // Pinch-zoom 2 ngón (mobile).
  const dist = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) pinch.current = { dist: dist(e.touches), scale };
    else if (e.touches.length === 1 && scale > 1)
      drag.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        ox: offset.x,
        oy: offset.y,
      };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinch.current) {
      zoomTo((dist(e.touches) / pinch.current.dist) * pinch.current.scale);
    } else if (e.touches.length === 1 && drag.current) {
      setOffset({
        x: drag.current.ox + (e.touches[0].clientX - drag.current.x),
        y: drag.current.oy + (e.touches[0].clientY - drag.current.y),
      });
    }
  };
  const onTouchEnd = () => {
    pinch.current = null;
    drag.current = null;
  };

  const btn =
    "h-10 w-10 inline-flex items-center justify-center rounded-full bg-white/15 text-white text-xl hover:bg-white/25 backdrop-blur";

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/90"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      {/* Thanh công cụ */}
      <div
        className="flex items-center justify-between gap-2 p-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm opacity-80">
          {many ? `${index + 1}/${images.length}` : ""}
        </span>
        <div className="flex items-center gap-2">
          <button className={btn} aria-label="Thu nhỏ" onClick={() => zoomTo(scale - 0.5)}>
            −
          </button>
          <button className={btn} aria-label="Phóng to" onClick={() => zoomTo(scale + 0.5)}>
            ＋
          </button>
          <button
            className={`${btn} text-sm`}
            aria-label="Cỡ gốc"
            onClick={reset}
          >
            1:1
          </button>
          <button className={btn} aria-label="Đóng" onClick={onClose}>
            <IconX className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Vùng ảnh */}
      <div
        className="relative flex-1 overflow-hidden flex items-center justify-center select-none"
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel}
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onDoubleClick={() => (scale > 1 ? reset() : zoomTo(2.5))}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ cursor: scale > 1 ? "grab" : "default" }}
      >
        <img
          src={cur.src}
          alt={cur.caption ?? ""}
          referrerPolicy="no-referrer"
          draggable={false}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transition: drag.current || pinch.current ? "none" : "transform 0.12s",
          }}
        />

        {many && (
          <>
            <button
              className={`${btn} absolute left-3 top-1/2 -translate-y-1/2`}
              aria-label="Ảnh trước"
              onClick={(e) => {
                e.stopPropagation();
                go(index - 1);
              }}
            >
              ‹
            </button>
            <button
              className={`${btn} absolute right-3 top-1/2 -translate-y-1/2`}
              aria-label="Ảnh sau"
              onClick={(e) => {
                e.stopPropagation();
                go(index + 1);
              }}
            >
              ›
            </button>
          </>
        )}
      </div>

      {cur.caption && (
        <p
          className="p-3 text-center text-sm text-white/80"
          onClick={(e) => e.stopPropagation()}
        >
          {cur.caption}
        </p>
      )}
    </div>,
    document.body,
  );
}
