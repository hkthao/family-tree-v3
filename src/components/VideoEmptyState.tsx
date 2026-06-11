import { useState } from "react";
import { Link } from "react-router-dom";

import { VideoModal } from "@/components/HelpVideoButton";
import { Button } from "@/components/ui/button";
import {
  formatDuration,
  getPosterUrl,
  pickViewport,
  VIDEO_BY_ID,
} from "@/lib/videoTutorials";

/**
 * Empty-state card kèm video hướng dẫn — onboarding cho người mới.
 *
 * Hiển:
 *  - Title + description ngắn
 *  - Thumbnail (poster frame) với play overlay → click mở modal
 *  - 1 action chính (Link CTA) nếu có
 *
 * Khác với <EmptyState> cũ: nhấn mạnh video tutorial thay vì chỉ
 * text + button.
 */
export function VideoEmptyState({
  videoId,
  title,
  description,
  ctaLabel,
  ctaTo,
}: {
  videoId: string;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaTo?: string;
}) {
  const tutorial = VIDEO_BY_ID[videoId];
  const [open, setOpen] = useState(false);
  const viewport = pickViewport();
  const poster = tutorial ? getPosterUrl(tutorial.spec, viewport) : "";

  return (
    <div className="rounded-lg border bg-card p-5 sm:p-6 space-y-4">
      <div className="space-y-2 text-center sm:text-left">
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </div>

      {tutorial && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Xem video: ${tutorial.title}`}
          className="group relative w-full max-w-md mx-auto sm:mx-0 rounded-lg overflow-hidden bg-black aspect-video focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={poster}
            alt=""
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
            onError={(e) => {
              // Poster có thể chưa upload — fallback chỉ hiện overlay.
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
          <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white text-xs tabular-nums">
            {formatDuration(tutorial.duration)} · video hướng dẫn
          </span>
        </button>
      )}

      {ctaLabel && ctaTo && (
        <div className="flex justify-center sm:justify-start">
          <Button asChild>
            <Link to={ctaTo}>{ctaLabel} →</Link>
          </Button>
        </div>
      )}

      {tutorial && open && (
        <VideoModal tutorial={tutorial} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}
