import { useEffect } from "react";
import { createPortal } from "react-dom";

import {
  IconArrowLeft,
  IconArrowRight,
  IconFacebook,
  IconMicrophone,
  IconSend,
  IconX,
} from "@/components/icons";
import { formatDateOnly } from "@/lib/formatDate";
import {
  facebookEmbedUrl,
  formatDuration,
  type PodcastEpisode,
} from "@/lib/queries/podcast";

/**
 * Khung xem một tập — dựng theo lối trình xem Reels: video đứng giữa sân
 * tối, thông tin và nút bấm nằm bên phải (máy tính) hoặc bên dưới (điện
 * thoại).
 *
 * Vì sao tự dựng thay vì để Facebook lo: bật `show_text=true` thì Facebook
 * kèm luôn một dải chữ NỀN TRẮNG của họ, đặt giữa giao diện tối của app
 * trông như hai trang web dán vào nhau. Ở đây chỉ nhúng đúng khung video,
 * còn tên tập, mô tả, nút bấm thì app tự vẽ bằng màu của mình.
 *
 * Đổi lại, nút thích của Facebook không còn — thay bằng hai nút mở thẳng
 * bài gốc. Thực ra nút kia cũng chỉ bấm được khi trình duyệt đang đăng
 * nhập Facebook, mà trên điện thoại thì phần lớn là không.
 */
export function PodcastViewer({
  episode,
  onClose,
  onPrev,
  onNext,
}: {
  episode: PodcastEpisode;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && onPrev) onPrev();
      if (e.key === "ArrowRight" && onNext) onNext();
    };
    window.addEventListener("keydown", onKey);
    // Khoá cuộn nền: mở trình xem mà nền vẫn trôi sau lưng là cảm giác
    // rẻ tiền nhất của một hộp thoại.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, onPrev, onNext]);

  const duration = formatDuration(episode.duration_seconds);
  const date = formatDateOnly(episode.published_at);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={episode.title}
    >
      {/* Thanh trên: chỉ tên kênh + nút đóng, đúng lối trình xem video —
          mọi thứ khác nhường chỗ cho nội dung. */}
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 text-white">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
            <IconMicrophone className="h-4 w-4" />
          </span>
          Podcast
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
        >
          <IconX className="h-5 w-5" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 lg:flex-row lg:items-center lg:justify-center lg:gap-6 lg:overflow-hidden lg:px-8">
        {/* Sân video: cao bao nhiêu thì bề ngang theo đó, giữ đúng 9:16. */}
        <div className="flex shrink-0 justify-center">
          <div className="aspect-[9/16] h-[58dvh] max-h-[76vh] w-auto overflow-hidden rounded-xl bg-black lg:h-[76dvh]">
            <iframe
              src={facebookEmbedUrl(episode.permalink_url, { withText: false })}
              title={episode.title}
              className="h-full w-full border-0"
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>

        {/* Cột thông tin — chữ của mình, màu của mình. */}
        <div className="flex w-full min-w-0 flex-col gap-3 text-white lg:h-[76dvh] lg:w-[22rem] lg:shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-snug">
              {episode.title}
            </h2>
            <p className="mt-1 text-sm text-white/60">
              {[date, duration].filter(Boolean).join(" · ")}
            </p>
          </div>

          {episode.description && (
            // Không kéo giãn cho đầy cột: mô tả ngắn mà nút bị ghim tận
            // đáy thì giữa cột là một mảng trống to tướng. Chỉ cuộn khi
            // mô tả dài hơn chỗ có.
            <p className="min-h-0 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-white/80">
              {episode.description}
            </p>
          )}

          <div className="flex shrink-0 flex-wrap gap-2">
            <a
              href={episode.permalink_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm font-medium text-white hover:bg-white/20"
            >
              <IconFacebook className="h-4 w-4" />
              Thích bài gốc
            </a>
            <a
              href={episode.permalink_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm font-medium text-white hover:bg-white/20"
            >
              <IconSend className="h-4 w-4" />
              Bình luận
            </a>
          </div>

          {(onPrev || onNext) && (
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={onPrev}
                disabled={!onPrev}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/20 px-3 text-sm text-white/80 hover:bg-white/10 disabled:opacity-30"
              >
                <IconArrowLeft className="h-4 w-4" />
                Tập trước
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={!onNext}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/20 px-3 text-sm text-white/80 hover:bg-white/10 disabled:opacity-30"
              >
                Tập sau
                <IconArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
