import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "@/components/Toast";
import { IconMicrophone, IconRefresh } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateOnly, formatRelative } from "@/lib/formatDate";
import {
  checkFacebookConnection,
  connectFacebookPage,
  formatDuration,
  getFbCredentialStatus,
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
        <FacebookConnection />

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
        {/* Ảnh bìa ngay trong danh sách: admin cần NHÌN THẤY cái mà người
            dùng sẽ thấy, nhất là khi ảnh bìa lấy từ Facebook và URL có
            hạn dùng — hỏng ảnh thì phải phát hiện ở đây. */}
        {episode.thumbnail_url && (
          <img
            src={episode.thumbnail_url}
            alt=""
            className="h-20 w-[45px] shrink-0 rounded object-cover"
            loading="lazy"
          />
        )}
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
              duration,
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


/**
 * Kết nối Facebook.
 *
 * Admin dán App ID + App Secret + token ngắn lấy từ Graph API Explorer;
 * máy chủ đổi sang token dài rồi lưu ở dạng mã hoá. Token KHÔNG bao giờ
 * quay ngược ra trình duyệt, và App Secret không được lưu lại ở đâu — nó
 * chỉ cần cho đúng lần đổi đó.
 *
 * Vì sao cho cắm trong app thay vì để env: đổi token là việc sẽ phải làm
 * lại nhiều lần (đổi mật khẩu Facebook là token chết), mà mỗi lần lại
 * phải ssh vào máy chủ thì sớm muộn cũng có lần không ai làm.
 */
function FacebookConnection() {
  const qc = useQueryClient();
  const toast = useToast();
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [userToken, setUserToken] = useState("");
  const [pages, setPages] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);

  const statusQ = useQuery({
    queryKey: ["fb-credential-status"],
    queryFn: () => getFbCredentialStatus(),
  });
  const active = statusQ.data?.find((c) => c.is_active);

  const connectM = useMutation({
    mutationFn: (pageId?: string) =>
      connectFacebookPage({ appId, appSecret, userToken, pageId }),
    onSuccess: (r) => {
      if (r.needPage) {
        setPages(r.pages ?? []);
        toast.success(`Tìm thấy ${r.pages?.length ?? 0} Trang — chọn một Trang`);
        return;
      }
      toast.success(`Đã nối Trang ${r.pageName}`);
      // Xoá khỏi bộ nhớ trình duyệt ngay khi xong việc.
      setAppSecret("");
      setUserToken("");
      setPages([]);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["fb-credential-status"] });
    },
    onError: (e) =>
      toast.error("Không nối được", { description: (e as Error).message }),
  });

  const checkM = useMutation({
    mutationFn: () => checkFacebookConnection(),
    onSuccess: (r) => {
      toast.success(`Token còn tốt — Trang ${r.pageName}`);
      qc.invalidateQueries({ queryKey: ["fb-credential-status"] });
    },
    onError: (e) => {
      toast.error("Token không dùng được", {
        description: (e as Error).message,
      });
      qc.invalidateQueries({ queryKey: ["fb-credential-status"] });
    },
  });

  return (
    <section className="space-y-3 rounded-md border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 text-sm">
          <p className="font-medium">Kết nối Facebook</p>
          {active ? (
            <>
              <p className="text-muted-foreground">
                Trang <span className="text-foreground">{active.page_name}</span>{" "}
                · token {active.hint} ·{" "}
                {active.token_expires_at
                  ? `hết hạn ${formatDateOnly(active.token_expires_at)}`
                  : "không hết hạn"}
              </p>
              {active.last_check_at && (
                <p className="text-xs text-muted-foreground">
                  Kiểm tra gần nhất: {formatRelative(active.last_check_at)} —{" "}
                  {active.last_check_ok ? "tốt" : `hỏng (${active.last_check_error})`}
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">
              Chưa nối Trang nào. Đồng bộ sẽ không chạy cho tới khi nối.
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {active && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => checkM.mutate()}
              disabled={checkM.isPending}
            >
              {checkM.isPending ? "Đang kiểm tra…" : "Kiểm tra token"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
            {open ? "Đóng" : active ? "Nối lại" : "Nối Trang"}
          </Button>
        </div>
      </div>

      {active && !active.last_check_ok && active.last_check_error && (
        <Alert variant="destructive">
          <AlertDescription>{active.last_check_error}</AlertDescription>
        </Alert>
      )}

      {open && (
        <div className="space-y-3 border-t pt-3">
          <p className="text-xs text-muted-foreground">
            Lấy ở <span className="font-mono">developers.facebook.com</span>:
            App ID và App Secret trong Cài đặt › Cơ bản; token người dùng sinh
            ở Graph API Explorer với quyền{" "}
            <span className="font-mono">pages_show_list</span>,{" "}
            <span className="font-mono">pages_read_engagement</span>,{" "}
            <span className="font-mono">pages_read_user_content</span>. Token
            ngắn hạn cũng được — máy chủ sẽ tự đổi sang loại dài hạn.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-medium">App ID</span>
              <Input
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="1671135124582219"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">App Secret</span>
              <Input
                type="password"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                placeholder="không được lưu lại"
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Token người dùng</span>
            <Input
              type="password"
              value={userToken}
              onChange={(e) => setUserToken(e.target.value)}
              placeholder="EAA…"
            />
          </label>

          {pages.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Chọn Trang để lấy podcast:</p>
              <ul className="space-y-1">
                {pages.map((pg) => (
                  <li key={pg.id}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => connectM.mutate(pg.id)}
                      disabled={connectM.isPending}
                    >
                      {pg.name}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pages.length === 0 && (
            <Button
              onClick={() => connectM.mutate(undefined)}
              disabled={
                connectM.isPending || !appId || !appSecret || !userToken
              }
            >
              {connectM.isPending ? "Đang nối…" : "Đọc danh sách Trang"}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
