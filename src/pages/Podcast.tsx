import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { IconMicrophone, IconPlay } from "@/components/icons";
import { LoadingState } from "@/components/LoadingState";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { PlatformShell } from "@/components/PlatformShell";
import { useUrlState } from "@/hooks/useUrlState";
import { formatDateOnly } from "@/lib/formatDate";
import {
  facebookEmbedUrl,
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
            {(data?.rows ?? []).map((ep) => (
              <EpisodeCard key={ep.id} episode={ep} />
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
              setPage(p === 1 ? "" : String(p));
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </>
      )}
    </PlatformShell>
  );
}

function EpisodeCard({ episode }: { episode: PodcastEpisode }) {
  // Chỉ nạp iframe khi người ta BẤM XEM — nhúng sẵn là mỗi lần mở trang
  // lại gọi Facebook một lượt cho từng tập, kèm mã theo dõi của Meta,
  // trong khi người dùng chưa hề bảo muốn xem.
  const [playing, setPlaying] = useState(false);
  const duration = formatDuration(episode.duration_seconds);
  const date = formatDateOnly(episode.published_at);

  return (
    <li className="overflow-hidden rounded-xl border bg-card">
      {playing ? (
        // Reel quay DỌC (ảnh bìa đo được 160×284). Khung ngang 16:9 thì
        // video co lại thành một dải hẹp giữa hai mảng đen.
        <div className="mx-auto w-full max-w-[380px] bg-black">
          <div className="aspect-[9/16] w-full">
            <iframe
              src={facebookEmbedUrl(episode.permalink_url)}
              title={episode.title}
              className="h-full w-full"
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
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
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white">
                <IconPlay className="h-5 w-5" />
              </span>
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium leading-snug">
              {episode.title}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {[date, duration].filter(Boolean).join(" · ")}
            </span>
          </span>
        </button>
      )}

      {episode.description && (
        <p className="whitespace-pre-line border-t px-3 py-2 text-sm text-muted-foreground">
          {episode.description.split("\n").slice(0, 4).join("\n")}
        </p>
      )}
    </li>
  );
}
