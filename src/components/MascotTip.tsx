import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { useQuery } from "@tanstack/react-query";

import { IconX } from "@/components/icons";
import { isMascotEnabled } from "@/lib/queries/platformSettings";
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
// Floating button có thể kéo BẤT KỲ ĐÂU và GIỮ NGUYÊN vị trí khi thả
// — không snap sang mép. Persist localStorage qua reload.
//
// Clamp x/y vào viewport để khi resize / xoay máy không bay ra ngoài.

const STORAGE_KEY = "mascot:position";
const BUTTON_SIZE = 48; // h-12 w-12
const EDGE_MARGIN = 12; // 0.75rem — lề tối thiểu cách viewport edge
const DRAG_THRESHOLD = 5; // px movement = drag, không phải click

interface MascotPosition {
  x: number; // px from left of viewport
  y: number; // px from top of viewport
}

function clamp(pos: MascotPosition): MascotPosition {
  if (typeof window === "undefined") return pos;
  const maxX = window.innerWidth - BUTTON_SIZE - EDGE_MARGIN;
  const maxY = window.innerHeight - BUTTON_SIZE - EDGE_MARGIN;
  return {
    x: Math.max(EDGE_MARGIN, Math.min(pos.x, maxX)),
    y: Math.max(EDGE_MARGIN, Math.min(pos.y, maxY)),
  };
}

function defaultPosition(): MascotPosition {
  // Đáy phải, trên bottom-tab-bar (mobile) / 16px lề (desktop).
  if (typeof window === "undefined") return { x: 600, y: 600 };
  const isMobile = window.innerWidth < 1024;
  const bottomOffset = isMobile ? 80 : 16;
  return clamp({
    x: window.innerWidth - BUTTON_SIZE - EDGE_MARGIN,
    y: window.innerHeight - BUTTON_SIZE - bottomOffset,
  });
}

function loadPosition(): MascotPosition {
  if (typeof window === "undefined") return defaultPosition();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPosition();
    const parsed = JSON.parse(raw) as Partial<MascotPosition> & {
      // Backward-compat: position cũ dùng {side, top} — drop nó.
      side?: string;
      top?: number;
    };
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") {
      return defaultPosition();
    }
    return clamp({ x: parsed.x, y: parsed.y });
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
  // Công tắc của quản trị nền tảng. Mặc định BẬT, và trong lúc chờ tải
  // cũng coi như bật — nếu không thì mỗi lần mở app linh vật lại nhấp
  // nháy hiện rồi biến mất.
  const { data: mascotOn = true } = useQuery({
    queryKey: ["mascot-enabled"],
    queryFn: () => isMascotEnabled(),
    staleTime: 5 * 60_000,
    retry: false,
  });
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
      setPosition((prev) => clamp(prev));
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

      // Drag end — giữ nguyên vị trí thả, chỉ clamp vào viewport.
      const finalX = e.clientX - info.offsetX;
      const finalY = e.clientY - info.offsetY;
      const next = clamp({ x: finalX, y: finalY });
      setPosition(next);
      setDragPos(null);
      savePosition(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tip, showBubble],
  );

  if (!mascotOn) return null;
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

  // Compute style: dùng left/top trực tiếp (không snap edge).
  const activeX = dragPos ? dragPos.x : position.x;
  const activeY = dragPos ? dragPos.y : position.y;
  const buttonStyle: React.CSSProperties = {
    left: activeX,
    top: activeY,
    right: "auto",
    bottom: "auto",
  };

  // Bubble bám theo mascot — bên trái nếu mascot ở nửa phải viewport,
  // ngược lại. Bubble width ~288px nên cần check để không tràn ra
  // ngoài viewport.
  const mascotIsOnRightHalf =
    typeof window !== "undefined"
      ? activeX + BUTTON_SIZE / 2 > window.innerWidth / 2
      : true;
  const bubbleStyle: React.CSSProperties = mascotIsOnRightHalf
    ? {
        right:
          typeof window !== "undefined"
            ? window.innerWidth - activeX + 4
            : "auto",
        top: activeY,
        left: "auto",
      }
    : {
        left: activeX + BUTTON_SIZE + 4,
        top: activeY,
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
          "fixed z-50",
          dragPos ? "cursor-grabbing" : "cursor-grab",
          // 48px tròn — vừa to để dễ chạm, không quá to thành CTA.
          "h-12 w-12 p-1.5 inline-flex items-center justify-center rounded-full",
          "border bg-card shadow-md hover:bg-muted",
          "overflow-hidden touch-none select-none",
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
            "fixed z-50",
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
