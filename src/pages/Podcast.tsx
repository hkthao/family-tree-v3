import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { IconMicrophone, IconPlay } from "@/components/icons";
import { LoadingState } from "@/components/LoadingState";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { PlatformShell } from "@/components/PlatformShell";
import { PodcastViewer } from "@/components/PodcastViewer";
import { useUrlState } from "@/hooks/useUrlState";
import { formatDateOnly } from "@/lib/formatDate";
import {
  formatDuration,
  listPodcastPage,
  PODCAST_PAGE_SIZE,
  type PodcastEpisode,
} from "@/lib/queries/podcast";

/**
 * Podcast — các tập do nền tảng sản xuất, đăng trên Facebook và kéo về đây.
 *
 * Nghe ngay trong app, không đá người dùng sang Facebook: sang bên đó là
 * mất họ vào dòng tin vô tận, mười lần thì chín lần không quay lại.
 */
export default function Podcast() {
  const [pageRaw, setPage] = useUrlState("trang", "");
  const page = Math.max(1, Number(pageRaw) || 1);

  // MỘT tập mở tại một thời điểm, trong trình xem riêng.
  //
  // Nhúng thẳng vào từng thẻ thì bấm ba tập là ba trình phát cùng chạy,
  // ba luồng tiếng chồng lên nhau — và ba iframe Facebook cùng nằm trên
  // trang, tức ba lần mã theo dõi của Meta được nạp.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["podcast-page", page],
    queryFn: () => listPodcastPage(page),
    // Ngắn thôi: tập mới đăng xong mà người dùng phải chờ hết giờ mới thấy
    // thì họ tưởng đồng bộ hỏng.
    staleTime: 30_000,
    refetchOnMount: "always",
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PODCAST_PAGE_SIZE));

  return (
    <PlatformShell homeTo="/podcast">
      <PageHeader
        icon={<IconMicrophone className="h-7 w-7" />}
        title="Podcast"
        description="Những câu chuyện ngắn để nghe lúc rảnh — mỗi tập một câu hỏi đáng nghĩ."
      />

      {isLoading && <LoadingState label="Đang tải danh sách tập…" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && total === 0 && (
        <EmptyState
          icon={<IconMicrophone className="h-8 w-8" />}
          title="Chưa có tập nào"
          description="Tập mới sẽ xuất hiện ở đây ngay sau khi đăng."
        />
      )}

      {total > 0 && (
        <>
          <ul className="space-y-3">
            {(data?.rows ?? []).map((ep, i) => (
              <EpisodeCard
                key={ep.id}
                episode={ep}
                onOpen={() => setOpenIndex(i)}
              />
            ))}
          </ul>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={PODCAST_PAGE_SIZE}
            unit="tập"
            isFetching={isFetching}
            onPageChange={(p) => {
              // Sang trang khác thì đóng hẳn — nếu không, tập của trang
              // trước vẫn phát tiếng trong khi màn hình đã là trang khác.
              setOpenIndex(null);
              setPage(p === 1 ? "" : String(p));
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </>
      )}

      {openIndex !== null && data?.rows[openIndex] && (
        <PodcastViewer
          episode={data.rows[openIndex]}
          onClose={() => setOpenIndex(null)}
          onPrev={openIndex > 0 ? () => setOpenIndex(openIndex - 1) : undefined}
          onNext={
            openIndex < data.rows.length - 1
              ? () => setOpenIndex(openIndex + 1)
              : undefined
          }
        />
      )}
    </PlatformShell>
  );
}

function EpisodeCard({
  episode,
  onOpen,
}: {
  episode: PodcastEpisode;
  onOpen: () => void;
}) {
  const duration = formatDuration(episode.duration_seconds);
  const date = formatDateOnly(episode.published_at);

  return (
    <li className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-center gap-3 p-3 text-left hover:bg-muted/40"
      >
        <span className="relative shrink-0">
          {episode.thumbnail_url ? (
            <img
              src={episode.thumbnail_url}
              alt=""
              // Ảnh bìa reel là ảnh dọc — khung vuông cắt mất đầu và chân.
              className="h-24 w-[54px] rounded-lg object-cover"
              loading="lazy"
            />
          ) : (
            <span className="flex h-24 w-[54px] items-center justify-center rounded-lg bg-muted">
              <IconMicrophone className="h-6 w-6 text-muted-foreground" />
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white transition-transform group-hover:scale-110">
              <IconPlay className="h-5 w-5" />
            </span>
          </span>
        </span>
        <span className="min-w-0 flex-1">
          {/* KHÔNG kèm `block`: nó đè lên `display:-webkit-box` mà
              line-clamp cần, và thế là cắt dòng không ăn — tiêu đề dài
              vẫn tràn ra bốn năm dòng. */}
          <span className="line-clamp-3 break-words font-medium leading-snug">
            {episode.title}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {[date, duration].filter(Boolean).join(" · ")}
          </span>
        </span>
      </button>

      {episode.description && (
        // Padding nằm ở KHUNG NGOÀI, không nằm trên thẻ bị cắt dòng:
        // `overflow:hidden` cắt ở mép padding chứ không phải mép chữ, nên
        // để padding trên chính thẻ đó thì dòng thứ ba ló nửa người vào
        // khoảng đệm — trông như cắt hụt.
        <div className="border-t px-3 py-2">
          <p className="line-clamp-2 text-sm text-muted-foreground sm:line-clamp-3">
            {episode.description
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
              .join(" ")}
          </p>
        </div>
      )}
    </li>
  );
}
