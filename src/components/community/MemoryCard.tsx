import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { ImageLightbox } from "@/components/ImageLightbox";
import { Chip } from "@/components/Chip";
import { IconCalendar, IconCamera, IconClock, IconMapPin, IconUser } from "@/components/icons";

import { t } from "@lingui/core/macro";

/** Dữ liệu tối thiểu để hiện một đóng góp — dùng chung cho app (PersonMemory) và trang chia sẻ (share-view). */
export interface MemoryCardData {
  id: string;
  kind: string;
  body: string | null;
  media_url: string | null;
  year_approx: number | null;
  place: string | null;
  source?: string | null;
  author_label: string;
  author_relation: string | null;
  created_at: string;
  person_name?: string | null;
}

/**
 * Một đóng góp: NỘI DUNG là chính (ảnh / ghi âm / lời kể ở trên), thông tin phụ gom MỘT dòng nhỏ
 * ở dưới — trái: người kể (· quan hệ · nguồn), phải: mốc năm · nơi chốn · ngày gửi. `badge` (trạng thái)
 * đặt đầu thẻ khi có; `actions` ở chân thẻ.
 */
export function MemoryCard({
  memory,
  badge,
  actions,
  showPerson = false,
}: {
  memory: MemoryCardData;
  badge?: ReactNode;
  actions?: ReactNode;
  showPerson?: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [zoom, setZoom] = useState(false);
  const date = new Date(memory.created_at).toLocaleDateString("vi-VN");
  const who = [memory.author_label, memory.author_relation].filter(Boolean).join(" · ");
  return (
    <article className="space-y-2 rounded-lg border bg-card p-3">
      {(badge || (showPerson && memory.person_name)) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {showPerson && memory.person_name ? (
            <p className="text-sm font-semibold">{t`Về ${memory.person_name}`}</p>
          ) : (
            <span />
          )}
          {badge}
        </div>
      )}

      {memory.kind === "photo" &&
        memory.media_url &&
        (imgFailed ? (
          <div className="flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-md border bg-muted p-2 text-center text-xs text-muted-foreground sm:h-32 sm:w-32">
            <IconCamera className="h-5 w-5" />
            {t`Không tải được ảnh`}
          </div>
        ) : (
          // Ảnh nhỏ trong thẻ; bấm mở ảnh lớn (ImageLightbox, phóng to / kéo được).
          <button
            type="button"
            onClick={() => setZoom(true)}
            aria-label={t`Xem ảnh lớn`}
            className="block overflow-hidden rounded-md border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <img
              src={memory.media_url}
              alt={memory.body ?? t`Ảnh đóng góp`}
              loading="lazy"
              onError={() => setImgFailed(true)}
              className="h-28 w-28 object-cover transition-transform hover:scale-105 sm:h-32 sm:w-32"
            />
          </button>
        ))}
      {memory.kind === "audio" && memory.media_url && (
        <audio controls preload="none" src={memory.media_url} className="w-full" />
      )}
      {memory.body && <ClampedText text={memory.body} />}

      {/* Một dòng thông tin phụ: trái = nơi chốn (chữ, có thể dài), phải = chip người góp · năm · ngày gửi. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        {memory.place ? (
          <span className="inline-flex min-w-0 items-center gap-1">
            <IconMapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{memory.place}</span>
          </span>
        ) : (
          <span />
        )}
        <span className="flex min-w-0 flex-wrap justify-end gap-1.5" title={memory.source ? t`Nguồn: ${memory.source}` : undefined}>
          <Chip tone="neutral" icon={<IconUser />}>
            {who}
          </Chip>
          {memory.year_approx && (
            <Chip tone="info" icon={<IconCalendar />}>
              {t`khoảng ${memory.year_approx}`}
            </Chip>
          )}
          <Chip tone="neutral" icon={<IconClock />}>
            {date}
          </Chip>
        </span>
      </div>

      {zoom && memory.media_url && (
        <ImageLightbox
          images={[{ src: memory.media_url, caption: memory.body }]}
          index={0}
          onIndexChange={() => {}}
          onClose={() => setZoom(false)}
        />
      )}

      {actions && <footer className="flex flex-wrap justify-end gap-2 border-t pt-3">{actions}</footer>}
    </article>
  );
}

/**
 * Lời kể dài: mặc định 4 dòng, có "Xem thêm" / "Thu gọn" — chỉ hiện nút khi chữ thật sự bị cắt
 * (đo scrollHeight), để thẻ ngắn không có nút thừa và thẻ dài không phá bố cục danh sách.
 */
function ClampedText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [clamped, setClamped] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const check = () => setClamped(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, open]);
  return (
    <div>
      <p
        ref={ref}
        className={`whitespace-pre-line break-words leading-relaxed ${open ? "" : "line-clamp-4"}`}
      >
        {text}
      </p>
      {(clamped || open) && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mt-1 text-sm font-medium text-primary hover:underline"
        >
          {open ? t`Thu gọn` : t`Xem thêm`}
        </button>
      )}
    </div>
  );
}
