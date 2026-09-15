import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import {
  IconFacebook,
  IconMicrophone,
  IconPlay,
  IconSend,
} from "@/components/icons";
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

  // MỘT tập đang phát tại một thời điểm.
  //
  // Để mỗi thẻ tự giữ trạng thái thì bấm ba tập là ba trình phát cùng
  // chạy, ba luồng tiếng chồng lên nhau — và ba iframe Facebook cùng nằm
  // trên trang, tức ba lần mã theo dõi của Meta được nạp.
  const [playingId, setPlayingId] = useState<string | null>(null);

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
              <EpisodeCard
                key={ep.id}
                episode={ep}
                playing={playingId === ep.id}
                onPlay={() => setPlayingId(ep.id)}
                onStop={() => setPlayingId(null)}
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
              // Sang trang khác thì dừng hẳn — nếu không, tập của trang
              // trước vẫn phát tiếng trong khi màn hình đã là trang khác.
              setPlayingId(null);
              setPage(p === 1 ? "" : String(p));
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </>
      )}
    </PlatformShell>
  );
}

function EpisodeCard({
  episode,
  playing,
  onPlay,
  onStop,
}: {
  episode: PodcastEpisode;
  playing: boolean;
  onPlay: () => void;
  onStop: () => void;
}) {
  // Chỉ nạp iframe khi người ta BẤM XEM — nhúng sẵn là mỗi lần mở trang
  // lại gọi Facebook một lượt cho từng tập, kèm mã theo dõi của Meta,
  // trong khi người dùng chưa hề bảo muốn xem.
  const duration = formatDuration(episode.duration_seconds);
  const date = formatDateOnly(episode.published_at);

  return (
    <li className="overflow-hidden rounded-xl border bg-card">
      {playing ? (
        <>
          {/* Reel quay DỌC (ảnh bìa đo được 160×284). Khung ngang 16:9
              thì video co thành một dải hẹp kẹp giữa hai mảng đen. */}
          {/* Khung phát: bề ngang dẫn dắt, nhưng bị CHẶN theo chiều cao
              màn hình.

              Chiều cao = (ngang × 16/9) cho phần video dọc, cộng 9rem cho
              dải chữ của Facebook (tên Trang, nút thích, nút chia sẻ, mô
              tả). Thiếu 9rem đó thì dải chữ bị cắt ngang — mà nút thích
              nằm đúng trong dải đó.

              Chặn theo `dvh` để nút "Đóng trình phát" luôn còn trong tầm
              nhìn; không thì trên điện thoại người dùng không biết thoát
              bằng cách nào. */}
          <div
            className="flex justify-center bg-black"
            style={
              {
                "--pw": "min(340px, 86vw, (78dvh - 9rem) * 9 / 16)",
              } as React.CSSProperties
            }
          >
            <iframe
              src={facebookEmbedUrl(episode.permalink_url)}
              title={episode.title}
              style={{
                width: "var(--pw)",
                height: "calc(var(--pw) * 16 / 9 + 9rem)",
              }}
              className="border-0"
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
            />
          </div>
          {/* Nút thích ngay trong khung Facebook chỉ bấm được khi trình
              duyệt đang đăng nhập Facebook — mà phần lớn người mở app trên
              điện thoại thì không. Hai nút này mở thẳng bài gốc, nơi họ
              chắc chắn thích và bình luận được. Chúng KHÔNG giả vờ đã
              thích: bấm là đi sang Facebook, đúng như nhãn ghi. */}
          <div className="flex flex-wrap gap-2 border-t p-3">
            <a
              href={episode.permalink_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 text-sm font-medium text-primary hover:bg-primary/20"
            >
              <IconFacebook className="h-4 w-4" />
              Thích bài gốc
            </a>
            <a
              href={episode.permalink_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-muted/50"
            >
              <IconSend className="h-4 w-4" />
              Bình luận
            </a>
            <button
              type="button"
              onClick={onStop}
              className="inline-flex min-h-[44px] items-center justify-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted/50"
            >
              Đóng
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={onPlay}
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
      )}

      {episode.description && !playing && (
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
