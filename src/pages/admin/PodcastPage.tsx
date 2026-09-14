import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "@/components/Toast";
import { IconMicrophone, IconRefresh } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateOnly, formatRelative } from "@/lib/formatDate";
import {
  formatDuration,
  getPodcastSyncStatus,
  listAllPodcastEpisodes,
  syncPodcastNow,
  updatePodcastEpisode,
  type PodcastEpisode,
} from "@/lib/queries/podcast";
import { AdminShell } from "@/pages/admin/AdminShell";

/**
 * Quản trị Podcast: xem các tập đã kéo về, ẩn tập không phù hợp, sửa tiêu
 * đề, và bấm đồng bộ tay khi không muốn chờ cron.
 *
 * Phần quan trọng nhất lại là dòng nhỏ nhất: MỐC ĐỒNG BỘ GẦN NHẤT. Token
 * Facebook chết là chuyện sẽ xảy ra (đổi mật khẩu, gỡ app, Meta đổi luật)
 * — và nó chết âm thầm: app vẫn chạy, chỉ là không bao giờ có tập mới.
 * Không hiện mốc này thì vài tháng sau mới có người để ý.
 */

/** Quá số ngày này không đồng bộ được thì coi như hỏng, không phải "chưa tới giờ". */
const STALE_DAYS = 3;

export default function PodcastPage() {
  const qc = useQueryClient();
  const toast = useToast();

  const episodesQ = useQuery({
    queryKey: ["podcast-admin-episodes"],
    queryFn: () => listAllPodcastEpisodes(),
  });
  const statusQ = useQuery({
    queryKey: ["podcast-sync-status"],
    queryFn: () => getPodcastSyncStatus(),
  });

  const syncM = useMutation({
    mutationFn: () => syncPodcastNow(),
    onSuccess: (r) => {
      toast.success(
        `Đã đồng bộ: ${r.inserted} tập mới, ${r.updated} tập cập nhật`,
      );
      qc.invalidateQueries({ queryKey: ["podcast-admin-episodes"] });
      qc.invalidateQueries({ queryKey: ["podcast-sync-status"] });
      qc.invalidateQueries({ queryKey: ["podcast-episodes"] });
      qc.invalidateQueries({ queryKey: ["podcast-latest"] });
    },
    onError: (e) =>
      toast.error("Đồng bộ hỏng", { description: (e as Error).message }),
  });

  const status = statusQ.data;
  const lastSync = status?.lastSyncAt ? new Date(status.lastSyncAt) : null;
  const staleDays = lastSync
    ? (Date.now() - lastSync.getTime()) / 86_400_000
    : Infinity;

  return (
    <AdminShell
      icon={<IconMicrophone className="h-7 w-7" />}
      title="Podcast"
      description="Các tập kéo về từ Trang Facebook. Ẩn tập không phù hợp, sửa tiêu đề, đồng bộ lại."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-3">
          <div className="text-sm">
            <p className="font-medium">
              {lastSync
                ? `Đồng bộ gần nhất: ${formatRelative(status!.lastSyncAt!)}`
                : "Chưa đồng bộ lần nào"}
            </p>
            {lastSync && (
              <p className="text-xs text-muted-foreground">
                {lastSync.toLocaleString("vi-VN")}
              </p>
            )}
          </div>
          <Button
            type="button"
            onClick={() => syncM.mutate()}
            disabled={syncM.isPending}
          >
            <IconRefresh
              className={`mr-1.5 h-4 w-4 ${syncM.isPending ? "animate-spin" : ""}`}
            />
            {syncM.isPending ? "Đang đồng bộ…" : "Đồng bộ ngay"}
          </Button>
        </div>

        {status?.lastError && (
          <Alert variant="destructive">
            <AlertDescription>
              Lần đồng bộ gần nhất báo lỗi: {status.lastError}
            </AlertDescription>
          </Alert>
        )}

        {!status?.lastError && staleDays > STALE_DAYS && (
          <Alert variant="destructive">
            <AlertDescription>
              {lastSync
                ? `Đã ${Math.floor(staleDays)} ngày không đồng bộ được tập nào. Token Facebook có thể đã hết hạn — kiểm tra biến FB_PAGE_TOKEN.`
                : "Chưa chạy đồng bộ lần nào. Kiểm tra FB_PAGE_ID / FB_PAGE_TOKEN và lịch cron."}
            </AlertDescription>
          </Alert>
        )}

        {episodesQ.isLoading && (
          <p className="text-sm text-muted-foreground">Đang tải…</p>
        )}

        <ul className="space-y-2">
          {(episodesQ.data ?? []).map((ep) => (
            <EpisodeRow key={ep.id} episode={ep} />
          ))}
        </ul>

        {episodesQ.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Chưa có tập nào trong kho. Bấm "Đồng bộ ngay" để kéo về.
          </p>
        )}
      </div>
    </AdminShell>
  );
}

function EpisodeRow({ episode }: { episode: PodcastEpisode }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState(episode.title);
  const [editing, setEditing] = useState(false);

  const saveM = useMutation({
    mutationFn: (patch: { title?: string; is_visible?: boolean }) =>
      updatePodcastEpisode(episode.id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["podcast-admin-episodes"] });
      qc.invalidateQueries({ queryKey: ["podcast-episodes"] });
      qc.invalidateQueries({ queryKey: ["podcast-latest"] });
      setEditing(false);
    },
    onError: (e) =>
      toast.error("Không lưu được", { description: (e as Error).message }),
  });

  const duration = formatDuration(episode.duration_seconds);

  return (
    <li
      className={`rounded-md border p-3 ${
        episode.is_visible ? "bg-card" : "bg-muted/40"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="sm:w-96"
                aria-label="Tiêu đề tập"
              />
              <Button
                size="sm"
                onClick={() => saveM.mutate({ title: title.trim() })}
                disabled={saveM.isPending || !title.trim()}
              >
                Lưu
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setTitle(episode.title);
                  setEditing(false);
                }}
              >
                Huỷ
              </Button>
            </div>
          ) : (
            <p className="font-medium leading-snug">{episode.title}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {[
              formatDateOnly(episode.published_at),
              duration && `${duration} phút`,
              episode.title_edited && "tiêu đề đã sửa tay",
              !episode.is_visible && "đang ẩn",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <a
            href={episode.permalink_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary hover:underline"
          >
            Mở trên Facebook →
          </a>
        </div>

        <div className="flex shrink-0 gap-2">
          {!editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Sửa tiêu đề
            </Button>
          )}
          <Button
            size="sm"
            variant={episode.is_visible ? "outline" : "default"}
            onClick={() => saveM.mutate({ is_visible: !episode.is_visible })}
            disabled={saveM.isPending}
          >
            {episode.is_visible ? "Ẩn" : "Hiện lại"}
          </Button>
        </div>
      </div>
    </li>
  );
}
