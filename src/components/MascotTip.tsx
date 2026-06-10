import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { IconX } from "@/components/icons";
import { useMascotTip } from "@/hooks/useMascotTip";
import { cn } from "@/lib/utils";

/**
 * Linh vật góc dưới-trái — pops a tooltip occasionally with hints
 * pulled from src/lib/tipCatalogue.ts. See plan.md §31 for the
 * design rationale (anti-banner-blindness rules, throttling, etc).
 *
 * Mounted once globally from App.tsx, alongside FeedbackButton.
 * FeedbackButton sits bottom-right; we take bottom-left so they
 * don't collide on small screens. Both clear the mobile
 * BottomTabBar via `bottom-20 lg:bottom-4`.
 */
export function MascotTip() {
  const { tip, dismiss, hide, peek, muted } = useMascotTip();
  const [showBubble, setShowBubble] = useState(false);
  // Tracks the "đã xem hết" state — when user clicks the mascot but
  // no eligible tip is left, we still want visible feedback rather
  // than a dead button.
  const [showAllClear, setShowAllClear] = useState(false);
  // Tips already shown in this open-bubble session, so each click
  // cycles to a NEW one instead of re-showing the same. Resets when
  // the bubble closes (dismiss / hide / muted), so future opens
  // start fresh.
  const [shownThisSession, setShownThisSession] = useState<string[]>([]);

  useEffect(() => {
    if (tip) {
      setShowBubble(true);
      setShowAllClear(false);
    }
  }, [tip]);

  if (muted) return null;

  const hasTip = tip !== null;

  function onMascotClick() {
    // Bubble already open: cycle to the next unseen tip instead of
    // closing. Users said "mỗi lần click hiện tip với nội dung khác
    // nhau" — repeated clicks should keep delivering content until
    // the catalogue is exhausted for this session.
    if (showBubble && tip) {
      const skip = [...shownThisSession, tip.id];
      const next = peek(skip);
      if (next) {
        setShownThisSession(skip);
      } else {
        setShownThisSession([]);
        setShowBubble(false);
        setShowAllClear(true);
      }
      return;
    }
    if (showAllClear) {
      setShowAllClear(false);
      setShownThisSession([]);
      return;
    }
    if (tip) {
      setShowBubble(true);
      setShownThisSession([tip.id]);
      return;
    }
    // No active tip — bypass cooldown and try to surface one. If
    // nothing's eligible, show the all-clear note so the user knows
    // the button isn't broken.
    const next = peek();
    if (next) {
      setShowBubble(true);
      setShownThisSession([next.id]);
    } else {
      setShowAllClear(true);
    }
  }

  function onDismissTip() {
    dismiss();
    setShownThisSession([]);
  }
  function onHideTip() {
    hide();
    setShownThisSession([]);
  }

  return (
    <>
      <button
        type="button"
        onClick={onMascotClick}
        aria-label={hasTip ? "Có gợi ý mới — bấm để xem" : "Linh vật"}
        className={cn(
          // Bottom-right, above the mobile BottomTabBar (h-14) on
          // phones; tucks into the corner on desktop. Feedback button
          // has been moved into the drawer footer so the mascot now
          // owns this slot on its own.
          "fixed right-3 bottom-20 lg:bottom-4 z-30",
          "h-10 w-10 inline-flex items-center justify-center rounded-full",
          "border bg-card shadow-md hover:bg-muted transition-colors",
          "text-xl",
        )}
        title={hasTip ? "Có gợi ý mới" : "Linh vật"}
      >
        <span aria-hidden="true">🐉</span>
        {hasTip && !showBubble && (
          <span
            aria-hidden="true"
            className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-background"
          />
        )}
      </button>

      {tip && showBubble && (
        <div
          role="dialog"
          aria-label={tip.title}
          className={cn(
            // Anchored to the same right edge as the mascot, popping
            // above it. Width caps at 18rem so on desktop the bubble
            // hugs the corner instead of slicing across the page.
            "fixed right-3 bottom-32 lg:bottom-16 z-30",
            "w-[min(18rem,calc(100vw-1.5rem))]",
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
              onClick={onDismissTip}
              aria-label="Bỏ qua gợi ý"
              className="shrink-0 -mt-1 -mr-1 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
          <TipActions tip={tip} onDismiss={onDismissTip} onHide={onHideTip} />
        </div>
      )}

      {showAllClear && (
        <div
          role="dialog"
          aria-label="Không có gợi ý mới"
          className={cn(
            "fixed right-3 bottom-32 lg:bottom-16 z-30",
            "w-[min(18rem,calc(100vw-1.5rem))]",
            "rounded-lg border bg-card shadow-xl p-3 space-y-2",
            "animate-in fade-in slide-in-from-bottom-2",
          )}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm">Bạn đã xem hết gợi ý</p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Linh vật sẽ pop lên khi có cập nhật hoặc tính năng mới.
                Trong lúc đó, mở{" "}
                <Link
                  to="/docs"
                  onClick={() => setShowAllClear(false)}
                  className="text-primary hover:underline"
                >
                  Hướng dẫn
                </Link>{" "}
                nếu cần.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAllClear(false)}
              aria-label="Đóng"
              className="shrink-0 -mt-1 -mr-1 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function TipActions({
  tip,
  onDismiss,
  onHide,
}: {
  tip: ReturnType<typeof useMascotTip>["tip"];
  onDismiss: () => void;
  onHide: () => void;
}) {
  // The action() factory is what produces the Link target — needs
  // context, but the hook already filtered on `when()` which would
  // typically guarantee the action is buildable. Still, factory may
  // return undefined if the run-time context lost the data.
  const action = tip?.action?.({
    route: window.location.pathname,
    appVersion: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "",
    lastSeenVersion: "",
    clanId:
      /^\/clans\/([0-9a-f-]{36})/i.exec(window.location.pathname)?.[1] ?? null,
    sessionAgeMs: 0,
    seenCount: 0,
  });

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onHide}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        Để sau
      </button>
      {action ? (
        <Link
          to={action.to}
          onClick={onDismiss}
          className="text-sm font-medium text-primary hover:underline"
        >
          {action.label} →
        </Link>
      ) : (
        <button
          type="button"
          onClick={onDismiss}
          className="text-sm font-medium text-primary hover:underline"
        >
          Đã hiểu
        </button>
      )}
    </div>
  );
}
