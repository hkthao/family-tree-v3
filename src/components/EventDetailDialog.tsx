import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

import { IconCalendar, IconMapPin, IconSparkles, IconUser, IconX } from "@/components/icons";
import { ShareCardDialog } from "@/components/ShareCardDialog";
import { Button } from "@/components/ui/button";
import type { EventRow } from "@/lib/queries/events";

const EVENT_TYPE_LABEL: Record<string, string> = {
  custom: "Sự kiện",
  reunion: "Họp họ",
  memorial: "Giỗ chung",
  tomb_visit: "Tảo mộ / Chạp họ",
};

export function EventDetailDialog({
  open,
  onClose,
  event,
  clanId,
  clanName,
}: {
  open: boolean;
  onClose: () => void;
  event: EventRow | null;
  clanId: string;
  clanName: string;
}) {
  const [cardOpen, setCardOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !event) return null;

  const when = event.date_solar
    ? `${event.date_solar} (dương lịch)`
    : event.lunar_month
      ? `Ngày ${event.lunar_day} tháng ${event.lunar_month}${event.lunar_is_leap ? " nhuận" : ""} (Âm lịch)`
      : "—";
  const cardDate = `${when}${event.is_yearly ? " · hằng năm" : ""}`;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border bg-card shadow-lg overflow-hidden"
      >
        <header className="border-b px-5 py-3 flex items-center justify-between">
          <h2 className="font-semibold">Chi tiết sự kiện</h2>
          <button type="button" onClick={onClose} aria-label="Đóng"
            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground">
            <IconX className="h-4 w-4" />
          </button>
        </header>

        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {EVENT_TYPE_LABEL[event.event_type] ?? "Sự kiện"}
            </p>
            <h3 className="text-xl font-semibold mt-0.5">{event.title}</h3>
          </div>

          <div className="flex items-start gap-2 text-sm">
            <IconCalendar className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <span>{cardDate}</span>
          </div>

          {event.notes && (
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{event.notes}</p>
          )}

          <div className="flex flex-col gap-1.5">
            {event.related_person_id && (
              <Link
                to={`/clans/${clanId}/people/${event.related_person_id}`}
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                onClick={onClose}
              >
                <IconUser className="h-4 w-4" /> Người liên quan
              </Link>
            )}
            {event.resting_place_id && (
              <Link
                to={`/clans/${clanId}/graves/${event.resting_place_id}`}
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                onClick={onClose}
              >
                <IconMapPin className="h-4 w-4" /> Nơi an nghỉ liên quan
              </Link>
            )}
          </div>

          <div className="pt-1">
            <Button className="w-full" onClick={() => setCardOpen(true)}>
              <IconSparkles className="h-4 w-4 mr-1.5" /> Tạo thiệp chia sẻ
            </Button>
          </div>
        </div>
      </div>

      <ShareCardDialog
        open={cardOpen}
        onClose={() => setCardOpen(false)}
        clanName={clanName}
        shareUrl=""
        initialTitle={event.title}
        initialExcerpt={event.notes ?? ""}
        dateText={cardDate}
        defaultGenre="event"
      />
    </div>,
    document.body,
  );
}
