import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { Breadcrumb } from "@/components/Breadcrumb";
import { IconCheck, IconHelp } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  submitFeedback,
  type FeedbackCategory,
} from "@/lib/queries/feedback";

/**
 * /lien-he — trang liên hệ / gửi phản hồi đầy đủ.
 *
 * Bổ sung cho nút floating `FeedbackButton`. Trang standalone tiện cho:
 *  - Người đăng nhập gửi report dài có thời gian suy nghĩ
 *  - Anon visitor không gặp scroll-lock của modal
 *  - Link share được trên mạng xã hội ("Liên hệ tác giả")
 *
 * Bám đúng RLS feedback: anon được insert, owner được đọc lại của
 * chính mình (xem queries/feedback.ts + migration §32.4).
 */
const CATEGORIES: Array<{ value: FeedbackCategory; label: string; hint: string }> = [
  { value: "bug", label: "Lỗi / sự cố", hint: "App hỏng, dữ liệu sai, trang trắng…" },
  { value: "idea", label: "Đề xuất / ý kiến", hint: "Tính năng muốn có, chỗ chưa tiện…" },
  { value: "question", label: "Câu hỏi", hint: "Hỏi cách dùng, hỏi về dữ liệu…" },
  { value: "other", label: "Khác", hint: "Mọi thứ khác." },
];

export default function Contact() {
  const toast = useToast();
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [category, setCategory] = useState<FeedbackCategory>("idea");
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      submitFeedback({
        message: message.trim(),
        category,
        contact: contact.trim() || null,
        pageUrl:
          typeof window === "undefined" ? null : window.location.href,
      }),
    onSuccess: () => {
      toast.success("Đã gửi liên hệ", {
        description: "Cảm ơn bạn — chúng tôi sẽ xem sớm nhất.",
      });
      setMessage("");
      setContact("");
      setSent(true);
    },
    onError: (e) =>
      toast.error("Không gửi được", { description: (e as Error).message }),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || mutation.isPending) return;
    setSent(false);
    mutation.mutate();
  }

  return (
    <div className="min-h-dvh bg-background lg:pl-72">
      <AppHeader />
      <main className="container max-w-4xl py-6 px-4 space-y-3">
        <Breadcrumb
          items={[
            { label: "Dòng họ", to: "/clans" },
            { label: "Liên hệ / phản hồi" },
          ]}
        />

        <PageHeader
          icon={<IconHelp className="h-7 w-7" />}
          title="Liên hệ / phản hồi"
          description="Mọi ý kiến đều giúp app tốt hơn. Không cần ngại — viết ngắn cũng được. Có thể gửi không cần đăng nhập."
        />

        {sent && (
          <Alert>
            <AlertDescription>
              Cảm ơn bạn. Phản hồi đã ghi nhận. Nếu để lại liên lạc, chúng
              tôi sẽ trả lời khi có cập nhật.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={onSubmit} className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="text-base font-medium">Loại phản hồi</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CATEGORIES.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${
                    category === opt.value
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="contact-category"
                    value={opt.value}
                    checked={category === opt.value}
                    onChange={() => setCategory(opt.value)}
                    className="mt-1 h-4 w-4 accent-primary shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{opt.label}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {opt.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="contact-message" required>
              Bạn muốn nói gì?
            </Label>
            <textarea
              id="contact-message"
              required
              maxLength={5000}
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Mô tả càng cụ thể càng tốt — bạn đang làm gì, app trả lời thế nào, mong app nên xử thế nào…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-base resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-handle">
              Cách liên lạc lại (tuỳ chọn)
            </Label>
            <Input
              id="contact-handle"
              maxLength={200}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Email / số điện thoại / Zalo — để trống cũng được"
            />
            <p className="text-xs text-muted-foreground">
              Chỉ ban quản trị xem; không hiện cho người khác.
            </p>
          </div>

          <div className="flex gap-3 pt-2 justify-end">
            <Button
              type="submit"
              variant="outline"
              disabled={mutation.isPending || !message.trim()}
            >
              <IconCheck className="h-4 w-4 mr-1.5" />
              {mutation.isPending ? "Đang gửi…" : "Gửi phản hồi"}
            </Button>
            <Button asChild variant="outline">
              <Link to="/clans">Quay lại</Link>
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
