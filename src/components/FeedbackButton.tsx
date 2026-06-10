import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { IconCheck, IconX } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitFeedback } from "@/lib/queries/feedback";
import { cn } from "@/lib/utils";

/**
 * Floating "Góp ý" pill — visible on every page so a user hitting a
 * bug or confused by a flow has somewhere to speak. Works for anon
 * + authenticated; the page URL, user agent, and app version are
 * stamped server-side via the query helper.
 *
 * Position mirrors OfflineIndicator's `bottom-20 lg:bottom-4` so it
 * sits ABOVE the mobile BottomTabBar on phones and tucks into the
 * corner on desktop. Lives on the right; OfflineIndicator (when
 * shown) lives on the left.
 */
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed right-3 bottom-20 lg:bottom-4 z-30",
          "inline-flex items-center gap-1.5 rounded-full",
          "px-4 h-10 shadow-md border bg-primary text-primary-foreground",
          "text-sm font-medium hover:opacity-90 transition-opacity",
        )}
        aria-label="Góp ý / báo lỗi"
      >
        <span aria-hidden="true">✎</span>
        Góp ý
      </button>
      {open && <FeedbackDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const { pathname } = useLocation();
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Pull clan_id out of /clans/:uuid/... so admins can land on the
  // right tree when they read the message. UUID v4 shape, but we
  // accept anything UUID-ish — server validates the FK separately.
  const clanId =
    pathname.match(
      /\/clans\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    )?.[1] ?? null;

  useEffect(() => {
    // ESC + autofocus
    textareaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: () =>
      submitFeedback({
        message: message.trim(),
        contact: contact.trim() || null,
        clanId,
        pageUrl:
          typeof window === "undefined" ? null : window.location.href,
      }),
    onSuccess: () => {
      toast.success("Đã gửi góp ý", {
        description: "Cảm ơn bạn — chúng tôi sẽ xem sớm nhất.",
      });
      onClose();
    },
    onError: (e) =>
      toast.error("Không gửi được", { description: (e as Error).message }),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || mutation.isPending) return;
    mutation.mutate();
  }

  // Standalone modal (don't reuse RelationSheet — feedback should be
  // available on auth pages too, where the sheet's surrounding
  // context isn't relevant).
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Góp ý"
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
        className="w-full sm:max-w-md bg-card border shadow-lg rounded-t-lg sm:rounded-lg flex flex-col max-h-[90vh]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <header className="flex items-start gap-3 px-5 pt-4 pb-3 border-b shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-tight">
              Góp ý / báo lỗi
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Mọi phản hồi đều giúp app tốt hơn. Không cần ngại — viết
              ngắn cũng được.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="-mr-2 -mt-1 inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <IconX className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1 min-h-0">
          <div className="space-y-2">
            <Label htmlFor="feedback-message" required>
              Bạn muốn nói gì?
            </Label>
            <textarea
              ref={textareaRef}
              id="feedback-message"
              required
              maxLength={5000}
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Vd: Khi bấm 'Lưu' thì hiện trang trắng, hoặc app thiếu chỗ ghi 'tên thường gọi'…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-base resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-contact">
              Cách liên lạc lại (tuỳ chọn)
            </Label>
            <Input
              id="feedback-contact"
              maxLength={200}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Email / số điện thoại / Zalo — để trống cũng được"
            />
            <p className="text-xs text-muted-foreground">
              Chỉ admin xem được; không hiện cho người khác trong họ.
            </p>
          </div>
        </div>

        <div className="flex gap-2 px-5 py-3 border-t shrink-0 bg-card">
          <Button
            type="submit"
            className="flex-1"
            disabled={mutation.isPending || !message.trim()}
          >
            <IconCheck className="h-4 w-4 mr-1.5" />
            {mutation.isPending ? "Đang gửi…" : "Gửi"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="shrink-0"
          >
            Huỷ
          </Button>
        </div>
      </form>
    </div>
  );
}
