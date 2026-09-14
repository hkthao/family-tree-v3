import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { IconArrowRight, IconMicrophone, IconPlay } from "@/components/icons";
import { formatDateOnly } from "@/lib/formatDate";
import { formatDuration, listPodcastEpisodes } from "@/lib/queries/podcast";

/**
 * Tập podcast mới nhất, đặt ở trang "Hôm nay".
 *
 * Vì sao ở đây: "Hôm nay" là trang người ta mở theo thói quen mỗi ngày,
 * nhưng có ngày chẳng có giỗ hay sinh nhật nào — mở ra thấy trống rỗng thì
 * lần sau thôi không mở nữa. Một tập để nghe là lý do quay lại.
 *
 * Không hiện gì khi chưa có tập nào: thẻ rỗng còn tệ hơn không có thẻ.
 */
export function PodcastTodayCard() {
  const { data } = useQuery({
    queryKey: ["podcast-latest"],
    queryFn: () => listPodcastEpisodes(1),
    staleTime: 10 * 60_000,
  });
  const ep = data?.[0];
  if (!ep) return null;

  const duration = formatDuration(ep.duration_seconds);
  const date = formatDateOnly(ep.published_at);

  return (
    <section aria-label="Podcast" className="space-y-2">
      <h2 className="text-lg font-semibold">Nghe gì hôm nay</h2>
      <Link
        to="/podcast"
        className="flex items-center gap-3 rounded-md border bg-card p-3 transition-colors hover:border-primary"
      >
        <span className="relative shrink-0">
          {ep.thumbnail_url ? (
            <img
              src={ep.thumbnail_url}
              alt=""
              className="h-16 w-16 rounded-lg object-cover"
              loading="lazy"
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
              <IconMicrophone className="h-6 w-6 text-muted-foreground" />
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white">
              <IconPlay className="h-4 w-4" />
            </span>
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs uppercase tracking-wide text-muted-foreground">
            Podcast
          </span>
          <span className="block font-medium leading-snug line-clamp-2">
            {ep.title}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {[date, duration && `${duration} phút`].filter(Boolean).join(" · ")}
          </span>
        </span>
        <IconArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </Link>
    </section>
  );
}
