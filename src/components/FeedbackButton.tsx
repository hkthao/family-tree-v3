import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

import {
  IconCheck,
  IconMail,
  IconScroll,
  IconX,
} from "@/components/icons";
import { SidePanel } from "@/components/SidePanel";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  submitFeedback,
  type FeedbackCategory,
} from "@/lib/queries/feedback";
import { cn } from "@/lib/utils";

/**
 * Inline "Góp ý" trigger — meant to be embedded in places that
 * already have layout (drawer footer, page header, etc) rather
 * than floating over content.
 *
 * Started life as a floating bottom-right pill but the mascot now
 * lives there + the duplicate corner-cluster was eating screen on
 * mobile. Behaviour (anon-friendly insert, page URL stamping) is
 * unchanged — just the chrome moved.
 */
export function FeedbackButton({
  className,
  label,
  icon,
}: {
  className?: string;
  /** Nhãn hiện cạnh icon. Không truyền thì giữ dạng nút gọn như cũ. */
  label?: string;
  icon?: ReactNode;
} = {}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          cn(
            "h-10 inline-flex items-center justify-center gap-1.5 rounded-md border px-3 text-sm",
            "hover:bg-muted transition-colors",
          )
        }
        aria-label="Góp ý / báo lỗi"
        title="Góp ý / báo lỗi"
      >
        {icon ?? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="shrink-0"
          >
            <path d="M22 2L11 13" />
            <path d="M22 2L15 22L11 13L2 9L22 2Z" />
          </svg>
        )}
        {label ? (
          <span className="flex-1 text-left">{label}</span>
        ) : (
          <span className="sr-only">Góp ý / báo lỗi</span>
        )}
      </button>
      {open && <FeedbackDialog onClose={() => setOpen(false)} />}
    </>
  );
}

const CATEGORY_OPTIONS: Array<{ value: FeedbackCategory; label: string }> = [
  { value: "bug", label: "Lỗi / sự cố" },
  { value: "idea", label: "Đề xuất / ý kiến" },
  { value: "question", label: "Câu hỏi" },
  { value: "other", label: "Khác" },
];

export function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const { pathname } = useLocation();
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [category, setCategory] = useState<FeedbackCategory>("other");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Pull clan_id out of /clans/:uuid/... so admins can land on the
  // right tree when they read the message. UUID v4 shape, but we
  // accept anything UUID-ish — server validates the FK separately.
  const clanId =
    pathname.match(
      /\/clans\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    )?.[1] ?? null;

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const mutation = useMutation({
    mutationFn: () =>
      submitFeedback({
        message: message.trim(),
        category,
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

  // Ngăn kéo bên phải (SidePanel, portal ra <body>) — dùng được cả ở trang đăng
  // nhập vì chỉ cần ConfirmDialogProvider ở gốc ứng dụng. Gõ dở mà đóng thì hỏi.
  return (
    <SidePanel
      open
      title="Góp ý / báo lỗi"
      subtitle="Mọi phản hồi đều giúp app tốt hơn. Không cần ngại — viết ngắn cũng được."
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-base font-medium">Loại phản hồi</legend>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm ${
                  category === opt.value
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/40"
                }`}
              >
                <input
                  type="radio"
                  name="feedback-category"
                  value={opt.value}
                  checked={category === opt.value}
                  onChange={() => setCategory(opt.value)}
                  className="h-4 w-4 accent-primary"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Textarea
          ref={textareaRef}
          id="feedback-message"
          label="Bạn muốn nói gì?"
          icon={<IconScroll />}
          required
          maxLength={5000}
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Vd: Khi bấm 'Lưu' thì hiện trang trắng, hoặc app thiếu chỗ ghi 'tên thường gọi'…"
        />

        <div className="space-y-2">
          <Label htmlFor="feedback-contact">Cách liên lạc lại (tuỳ chọn)</Label>
          <Input
            id="feedback-contact"
            icon={<IconMail />}
            maxLength={200}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Email / số điện thoại / Zalo — để trống cũng được"
          />
          <p className="text-xs text-muted-foreground">
            Chỉ admin xem được; không hiện cho người khác trong họ.
          </p>
        </div>

        <FormActions>
          <Button type="button" variant="outline" onClick={onClose}>
            <IconX className="h-4 w-4 mr-1.5" />
            Huỷ
          </Button>
          <Button type="submit" disabled={mutation.isPending || !message.trim()}>
            <IconCheck className="h-4 w-4 mr-1.5" />
            {mutation.isPending ? "Đang gửi…" : "Gửi"}
          </Button>
        </FormActions>
      </form>
    </SidePanel>
  );
}
