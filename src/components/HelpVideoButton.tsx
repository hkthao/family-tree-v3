import { useEffect, useState } from "react";

import { IconHelp, IconX } from "@/components/icons";
import { VideoPlayer } from "@/components/VideoPlayer";
import {
  formatDuration,
  VIDEO_BY_ID,
  type VideoTutorial,
} from "@/lib/videoTutorials";

/**
 * "?" button nhỏ — click mở modal player video hướng dẫn cho feature
 * cụ thể. Đặt cạnh tiêu đề trang / cạnh nút action chính của trang.
 *
 * Usage:
 *   <HelpVideoButton videoId="them-thuy-to" />
 *
 * Tự ẩn nếu `videoId` không match (registry chưa có).
 */
export function HelpVideoButton({
  videoId,
  label = "Hướng dẫn",
  size = "icon",
}: {
  videoId: string;
  /** Label aria; cũng dùng làm text khi size="text". */
  label?: string;
  /** "icon" = "?" tròn 36px; "text" = button có chữ "Xem hướng dẫn 1 phút". */
  size?: "icon" | "text";
}) {
  const tutorial = VIDEO_BY_ID[videoId];
  const [open, setOpen] = useState(false);

  if (!tutorial) return null;

  return (
    <>
      {size === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`${label}: ${tutorial.title}`}
          title={`${label}: ${tutorial.title}`}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground shrink-0"
        >
          <IconHelp className="h-5 w-5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <IconHelp className="h-4 w-4" />
          Xem hướng dẫn {formatDuration(tutorial.duration)}
        </button>
      )}

      {open && <VideoModal tutorial={tutorial} onClose={() => setOpen(false)} />}
    </>
  );
}

// ─── Modal ────────────────────────────────────────────────────────

export function VideoModal({
  tutorial,
  onClose,
}: {
  tutorial: VideoTutorial;
  onClose: () => void;
}) {
  // ESC để đóng + lock body scroll.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Video: ${tutorial.title}`}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-background rounded-lg shadow-2xl flex flex-col max-h-[90vh]"
      >
        <header className="border-b px-5 py-3 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="font-semibold truncate">{tutorial.title}</h2>
            <p className="text-xs text-muted-foreground truncate">
              {tutorial.description} ·{" "}
              <span className="tabular-nums">
                {formatDuration(tutorial.duration)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="shrink-0 h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-muted"
          >
            <IconX className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-auto p-4">
          <VideoPlayer tutorial={tutorial} autoPlay />
        </div>
      </div>
    </div>
  );
}
