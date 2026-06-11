import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { IconX } from "@/components/icons";
import { useMascotTip } from "@/hooks/useMascotTip";
import type { Tip, TipContext } from "@/lib/tipCatalogue";
import { cn } from "@/lib/utils";

const AUTO_HIDE_MS = 5000;

/**
 * Linh vật góc dưới-phải — tip rotation per plan §31. The hook
 * times the auto-pop (every few minutes); this component handles
 * the bubble lifecycle: auto-hide after 5s if the user doesn't
 * interact, cycle to a different tip on each mascot-click, and
 * the × button just closes (tips are never marked permanently
 * dismissed — they keep rotating).
 */
/**
 * Routes mà linh vật KHÔNG xuất hiện — các trang công khai / pre-auth
 * (login/signup) hoặc share-view chỉ-đọc. Linh vật mang tip dành cho
 * user đăng nhập, đứng cạnh form đăng nhập trông lạc lõng + che nút.
 */
const HIDE_ON_ROUTES = ["/login", "/signup", "/lien-he", "/changelog"];

function isHiddenRoute(pathname: string): boolean {
  return (
    HIDE_ON_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith("/share/") ||
    pathname.startsWith("/inlaws/confirm/")
  );
}

export function MascotTip() {
  const { tip, cycle, muted } = useMascotTip();
  const { pathname } = useLocation();
  const [showBubble, setShowBubble] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

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

  // Auto-show the bubble whenever a new tip arrives, restart the
  // hide timer. If user is mid-reading and a new tip pops in, the
  // bubble swaps content — that's deliberate (rotation > stalling
  // on one).
  useEffect(() => {
    if (!tip) return;
    setShowBubble(true);
    startAutoHide();
    return () => clearAutoHide();
  }, [tip]);

  if (muted) return null;
  if (isHiddenRoute(pathname)) return null;

  const hasTip = tip !== null;

  function onMascotClick() {
    clearAutoHide();
    if (showBubble) {
      // Bubble is up — cycle to the next tip rather than close.
      cycle();
      // useEffect on tip will restart the auto-hide.
      return;
    }
    if (tip) {
      setShowBubble(true);
      startAutoHide();
      return;
    }
    // No active tip — pull one immediately.
    const next = cycle();
    if (next) {
      setShowBubble(true);
      // startAutoHide() will run via useEffect once `tip` updates.
    }
  }

  function onCloseBubble() {
    clearAutoHide();
    setShowBubble(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={onMascotClick}
        aria-label={hasTip ? "Có gợi ý mới — bấm để xem" : "Linh vật"}
        title={hasTip ? "Có gợi ý mới" : "Linh vật"}
        className={cn(
          "mascot-icon",
          hasTip && !showBubble && "mascot-has-tip",
          "fixed right-3 bottom-20 lg:bottom-4 z-30",
          // Slightly bigger than the 40px the FeedbackButton uses
          // so the dragon swim is legible, but not so big it looks
          // like a primary CTA. 48px is the middle ground.
          // p-1.5 keeps the SVG from touching the button border.
          "h-12 w-12 p-1.5 inline-flex items-center justify-center rounded-full",
          "border bg-card shadow-md hover:bg-muted transition-colors",
          "overflow-hidden",
        )}
      >
        {/* Vietnamese dragon SVG — vector, scales sharply at any
            button size. CSS in index.css gives it a gentle
            swimming sway. */}
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

      {tip && showBubble && (
        <div
          role="dialog"
          aria-label={tip.title}
          onMouseEnter={clearAutoHide}
          onMouseLeave={startAutoHide}
          className={cn(
            // Bubble's bottom-RIGHT corner anchors near the mascot's
            // top-LEFT corner with a 4px gap so the bubble visually
            // "points" at the dragon. Mascot is h-12 w-12 (48px) at
            // right-3 bottom-20 / lg:bottom-4 — so:
            //   right offset = 12 (right-3) + 48 + 4 = 64px
            //   bottom mobile  = 80 (bottom-20) + 48 + 4 = 132px
            //   bottom desktop = 16 (bottom-4) + 48 + 4 = 68px
            "fixed right-[64px] bottom-[132px] lg:bottom-[68px] z-30",
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
