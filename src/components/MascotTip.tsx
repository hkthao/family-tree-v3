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
  const { tip, dismiss, hide, muted } = useMascotTip();
  const [showBubble, setShowBubble] = useState(false);

  // Auto-show the bubble when a new tip arrives. Don't fight the user
  // if they close it — the hook keeps `tip` non-null until they
  // dismiss explicitly, but we hide the bubble locally so we don't
  // re-open every render.
  useEffect(() => {
    if (tip) setShowBubble(true);
  }, [tip]);

  if (muted) return null;

  const hasTip = tip !== null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!tip) return;
          setShowBubble((v) => !v);
        }}
        aria-label={hasTip ? "Có gợi ý mới — bấm để xem" : "Linh vật"}
        className={cn(
          // Stacked above the "Góp ý" pill on the right. Both clear
          // the mobile BottomTabBar; on lg+ the drawer is pinned on
          // the LEFT so the right edge is always free.
          //   Góp ý       → bottom 20 (mobile) / bottom 4 (desktop)
          //   Mascot icon → bottom 32 (mobile) / bottom 16 (desktop)
          "fixed right-3 bottom-32 lg:bottom-16 z-30",
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
            "fixed right-3 bottom-44 lg:bottom-28 z-30",
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
              onClick={dismiss}
              aria-label="Bỏ qua gợi ý"
              className="shrink-0 -mt-1 -mr-1 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
          <TipActions tip={tip} onDismiss={dismiss} onHide={hide} />
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
