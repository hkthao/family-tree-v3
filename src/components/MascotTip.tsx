import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { IconX } from "@/components/icons";
import { useMascotTip } from "@/hooks/useMascotTip";
import type { Tip, TipContext } from "@/lib/tipCatalogue";
import { cn } from "@/lib/utils";

const AUTO_HIDE_MS = 5000;

/**
 * Routes mà linh vật KHÔNG xuất hiện — các trang công khai / pre-auth
 * hoặc share-view chỉ-đọc.
 */
const HIDE_ON_ROUTES = ["/login", "/signup", "/lien-he", "/changelog"];

function isHiddenRoute(pathname: string): boolean {
  return (
    HIDE_ON_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith("/share/") ||
    pathname.startsWith("/inlaws/confirm/")
  );
}

// ─── Draggable position state ────────────────────────────────────────
//
// Like iOS AssistiveTouch: button có thể kéo bất kỳ đâu, thả ra tự
// snap sang mép trái hoặc phải gần nhất, giữ y position.
//
// Persist sang localStorage để position còn nguyên qua reload.

const STORAGE_KEY = "mascot:position";
const BUTTON_SIZE = 48; // h-12 w-12
const EDGE_MARGIN = 12; // 0.75rem
const DRAG_THRESHOLD = 5; // px movement = drag, không phải click

interface MascotPosition {
  side: "left" | "right";
  top: number; // px from top of viewport
}

function defaultPosition(): MascotPosition {
  // Đáy phải, trên bottom-tab-bar (mobile) / 16px lề (desktop).
  if (typeof window === "undefined") return { side: "right", top: 600 };
  const isMobile = window.innerWidth < 1024;
  const bottomOffset = isMobile ? 80 : 16;
  return {
    side: "right",
    top: window.innerHeight - BUTTON_SIZE - bottomOffset,
  };
}

function loadPosition(): MascotPosition {
  if (typeof window === "undefined") return defaultPosition();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPosition();
    const parsed = JSON.parse(raw) as MascotPosition;
    // Clamp y vào viewport hiện tại (resize / xoay màn hình).
    const maxTop = window.innerHeight - BUTTON_SIZE - EDGE_MARGIN;
    return {
      side: parsed.side === "left" ? "left" : "right",
      top: Math.max(EDGE_MARGIN, Math.min(parsed.top, maxTop)),
    };
  } catch {
    return defaultPosition();
  }
}

function savePosition(pos: MascotPosition): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // localStorage có thể disabled — không sao, mất state khi reload.
  }
}

export function MascotTip() {
  const { tip, cycle, muted } = useMascotTip();
  const { pathname } = useLocation();
  const [showBubble, setShowBubble] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  // Position state.
  const [position, setPosition] = useState<MascotPosition>(loadPosition);
  // Khi đang drag, render style trực tiếp qua dragPos (không snap).
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  // Track xem có phải drag thực sự không (> threshold) để phân biệt click.
  const dragInfoRef = useRef<{
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } | null>(null);

  function startAutoHide() {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      setShowBubble(false);
      hideTimerRef.current = null;
    }, AUTO_HIDE_MS);
  }

  function clearAutoHide() {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }

  useEffect(() => {
    if (!tip) return;
    setShowBubble(true);
    startAutoHide();
    return () => clearAutoHide();
  }, [tip]);

  // Re-clamp position khi viewport resize (xoay máy, mở keyboard…).
  useEffect(() => {
    function onResize() {
      setPosition((prev) => {
        const maxTop = window.innerHeight - BUTTON_SIZE - EDGE_MARGIN;
        return {
          side: prev.side,
          top: Math.max(EDGE_MARGIN, Math.min(prev.top, maxTop)),
        };
      });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ─── Drag handlers ─────────────────────────────────────────────

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Ignore right-click + middle-click.
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const target = e.currentTarget as HTMLButtonElement;
    const rect = target.getBoundingClientRect();
    dragInfoRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      // Offset từ pointer tới góc top-left của button — giữ pointer
      // "dính" cùng điểm trên button khi drag.
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      moved: false,
    };
    // Capture pointer để nhận move/up events kể cả khi ra ngoài button.
    target.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const info = dragInfoRef.current;
    if (!info) return;
    const dx = e.clientX - info.startX;
    const dy = e.clientY - info.startY;
    if (!info.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    info.moved = true;
    setDragPos({
      x: e.clientX - info.offsetX,
      y: e.clientY - info.offsetY,
    });
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const info = dragInfoRef.current;
      if (!info) return;
      dragInfoRef.current = null;
      try {
        (e.currentTarget as HTMLButtonElement).releasePointerCapture(
          e.pointerId,
        );
      } catch {
        // Ignore — capture có thể đã release.
      }

      if (!info.moved) {
        // Click thực sự — chạy click handler.
        setDragPos(null);
        handleMascotClick();
        return;
      }

      // Drag end — snap to nearest edge.
      const finalX = e.clientX - info.offsetX;
      const finalY = e.clientY - info.offsetY;
      const centerX = finalX + BUTTON_SIZE / 2;
      const side: "left" | "right" =
        centerX < window.innerWidth / 2 ? "left" : "right";
      const maxTop = window.innerHeight - BUTTON_SIZE - EDGE_MARGIN;
      const top = Math.max(EDGE_MARGIN, Math.min(finalY, maxTop));
      const next: MascotPosition = { side, top };
      setPosition(next);
      setDragPos(null);
      savePosition(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tip, showBubble],
  );

  if (muted) return null;
  if (isHiddenRoute(pathname)) return null;

  const hasTip = tip !== null;

  function handleMascotClick() {
    clearAutoHide();
    if (showBubble) {
      cycle();
      return;
    }
    if (tip) {
      setShowBubble(true);
      startAutoHide();
      return;
    }
    const next = cycle();
    if (next) {
      setShowBubble(true);
    }
  }

  function onCloseBubble() {
    clearAutoHide();
    setShowBubble(false);
  }

  // Compute style: trong khi drag → free position; ngược lại → snap
  // bám mép trái hoặc phải.
  const buttonStyle: React.CSSProperties = dragPos
    ? {
        left: dragPos.x,
        top: dragPos.y,
        right: "auto",
        transition: "none",
      }
    : position.side === "right"
      ? {
          right: EDGE_MARGIN,
          top: position.top,
          left: "auto",
        }
      : {
          left: EDGE_MARGIN,
          top: position.top,
          right: "auto",
        };

  // Bubble vị trí bám theo mascot — bên trái nếu mascot ở phải,
  // ngược lại.
  const bubbleStyle: React.CSSProperties =
    position.side === "right"
      ? {
          right: EDGE_MARGIN + BUTTON_SIZE + 4,
          top: position.top,
          left: "auto",
        }
      : {
          left: EDGE_MARGIN + BUTTON_SIZE + 4,
          top: position.top,
          right: "auto",
        };

  return (
    <>
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label={hasTip ? "Có gợi ý mới — bấm để xem" : "Linh vật"}
        title={hasTip ? "Có gợi ý mới" : "Linh vật (kéo để di chuyển)"}
        style={buttonStyle}
        className={cn(
          "mascot-icon",
          hasTip && !showBubble && "mascot-has-tip",
          "fixed z-30",
          dragPos ? "cursor-grabbing" : "cursor-grab",
          // 48px tròn — vừa to để dễ chạm, không quá to thành CTA.
          "h-12 w-12 p-1.5 inline-flex items-center justify-center rounded-full",
          "border bg-card shadow-md hover:bg-muted",
          "overflow-hidden touch-none select-none",
          // Animate snap khi không drag.
          !dragPos && "transition-[left,right,top] duration-200",
        )}
      >
        <img
          src="/mascot/dragon.svg"
          alt=""
          aria-hidden="true"
          className={cn(
            "mascot-emoji",
            "h-full w-full object-contain pointer-events-none select-none",
          )}
          draggable={false}
        />
      </button>

      {tip && showBubble && !dragPos && (
        <div
          role="dialog"
          aria-label={tip.title}
          onMouseEnter={clearAutoHide}
          onMouseLeave={startAutoHide}
          style={bubbleStyle}
          className={cn(
            "fixed z-30",
            "w-[min(18rem,calc(100vw-5rem))]",
            "rounded-lg border bg-card shadow-xl p-3 space-y-2",
            "animate-in fade-in slide-in-from-bottom-2",
          )}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm">{tip.title}</p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {tip.body}
              </p>
            </div>
            <button
              type="button"
              onClick={onCloseBubble}
              aria-label="Đóng"
              className="shrink-0 -mt-1 -mr-1 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
          <TipActions tip={tip} onClose={onCloseBubble} />
        </div>
      )}
    </>
  );
}

function TipActions({
  tip,
  onClose,
}: {
  tip: Tip;
  onClose: () => void;
}) {
  const ctx: TipContext = {
    route: window.location.pathname,
    appVersion: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "",
    lastSeenVersion: "",
    clanId:
      /^\/clans\/([0-9a-f-]{36})/i.exec(window.location.pathname)?.[1] ?? null,
    sessionAgeMs: 0,
    seenCount: 0,
  };
  const action = tip.action?.(ctx);

  return (
    <div className="flex items-center justify-end gap-2">
      {action ? (
        <Link
          to={action.to}
          onClick={onClose}
          className="text-sm font-medium text-primary hover:underline"
        >
          {action.label} →
        </Link>
      ) : (
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-medium text-primary hover:underline"
        >
          Đã hiểu
        </button>
      )}
    </div>
  );
}
