import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Chip } from "@/components/Chip";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { EmptyState } from "@/components/EmptyState";
import { IconTile } from "@/components/IconTile";
import {
  IconBellOff,
  IconCalendar,
  IconCheck,
  IconClock,
  IconMicrophone,
  IconPencil,
  IconRefresh,
  IconSearch,
  IconTag,
} from "@/components/icons";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { SidePanel } from "@/components/SidePanel";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReadOnlyFieldset } from "@/components/ui/readonly-fieldset";
import { Select } from "@/components/ui/select";
import { ViewEditActions } from "@/components/ui/view-edit-actions";
import { LIST_PAGE_SIZE_OPTIONS, useClientPaging } from "@/hooks/useClientPaging";
import { unaccent } from "@/lib/unaccent";
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

  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState<"" | "visible" | "hidden">("");
  const [panel, setPanel] = useState<EpisodePanel>(null);
  const episodes = episodesQ.data ?? [];
  const filtered = useMemo(() => {
    const needle = unaccent(search.trim());
    return episodes.filter(
      (ep) =>
        (visibility === "" || (visibility === "visible") === ep.is_visible) &&
        (!needle || unaccent(ep.title).includes(needle)),
    );
  }, [episodes, search, visibility]);
  const paging = useClientPaging(filtered, 20);

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

        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="p-3 text-sm">
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
          {/* Hành động của cả thẻ nằm ở chân thẻ — docs/design-language.md. */}
          <div className="flex justify-end gap-2 border-t p-3">
            <Button type="button" onClick={() => syncM.mutate()} disabled={syncM.isPending}>
              <IconRefresh
                className={`mr-1.5 h-4 w-4 ${syncM.isPending ? "animate-spin" : ""}`}
              />
              {syncM.isPending ? "Đang đồng bộ…" : "Đồng bộ ngay"}
            </Button>
          </div>
        </section>

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

        <CollapsibleFilters
          activeCount={visibility ? 1 : 0}
          onReset={() => {
            setVisibility("");
            paging.patchAndResetPage({});
          }}
          title="Lọc tập"
          search={(toggle) => (
            <SearchInput
              label="Tìm tập"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                paging.patchAndResetPage({});
              }}
              placeholder="Tìm theo tiêu đề tập…"
              rightSlot={toggle}
            />
          )}
        >
          <div className="flex flex-col gap-3">
            <Select
              value={visibility}
              onChange={(e) => {
                setVisibility(e.target.value as "" | "visible" | "hidden");
                paging.patchAndResetPage({});
              }}
              aria-label="Lọc theo hiển thị"
              icon={<IconTag />}
              className="h-11 w-full text-base"
            >
              <option value="">Cả hiện và ẩn</option>
              <option value="visible">Đang hiện</option>
              <option value="hidden">Đang ẩn</option>
            </Select>
          </div>
        </CollapsibleFilters>

        {episodesQ.isLoading && (
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-muted-foreground">Đang tải…</p>
          </div>
        )}

        {!episodesQ.isLoading && filtered.length === 0 && (
          <EmptyState
            icon={<IconSearch className="h-10 w-10" />}
            title={episodes.length === 0 ? "Chưa có tập nào trong kho" : "Không có tập nào khớp"}
            description={
              episodes.length === 0
                ? 'Bấm "Đồng bộ ngay" để kéo về.'
                : "Thử bỏ bớt bộ lọc hoặc từ khoá."
            }
          />
        )}

        {filtered.length > 0 && (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
            {paging.paged.map((ep) => (
              <EpisodeRowItem
                key={ep.id}
                episode={ep}
                onOpen={() => setPanel({ mode: "view", episode: ep })}
              />
            ))}
          </ul>
        )}

        {filtered.length > 0 && (
          <Pagination
            page={paging.page}
            totalPages={paging.totalPages}
            total={paging.total}
            pageSize={paging.pageSize}
            unit="tập"
            onPageChange={paging.setPage}
            pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
            onPageSizeChange={paging.setPageSize}
          />
        )}

        <SidePanel
          open={panel !== null}
          title={panel?.mode === "edit" ? "Sửa tập" : "Tập podcast"}
          subtitle={panel?.episode.title}
          onClose={() => setPanel(null)}
          guard={panel?.mode === "edit"}
        >
          {panel && (
            <EpisodeForm
              key={`${panel.mode}-${panel.episode.id}`}
              episode={panel.episode}
              readOnly={panel.mode === "view"}
              onEdit={() => setPanel({ mode: "edit", episode: panel.episode })}
              onCancel={() =>
                setPanel(panel.mode === "edit" ? { mode: "view", episode: panel.episode } : null)
              }
              onSaved={() => setPanel(null)}
            />
          )}
        </SidePanel>
      </div>
    </AdminShell>
  );
}

/** Trạng thái ngăn kéo: xem (chỉ đọc) hoặc sửa một tập. */
type EpisodePanel = { mode: "view" | "edit"; episode: PodcastEpisode } | null;

function EpisodeRowItem({ episode, onOpen }: { episode: PodcastEpisode; onOpen: () => void }) {
  const duration = formatDuration(episode.duration_seconds);
  return (
    <li className={episode.is_visible ? "" : "bg-muted/30"}>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-stretch gap-3 p-3 text-left transition-colors hover:bg-muted/40"
      >
        {/* Ảnh bìa ngay trong danh sách: admin cần NHÌN THẤY cái mà người
            dùng sẽ thấy, nhất là khi ảnh bìa lấy từ Facebook và URL có
            hạn dùng — hỏng ảnh thì phải phát hiện ở đây. */}
        {episode.thumbnail_url ? (
          <img
            src={episode.thumbnail_url}
            alt=""
            loading="lazy"
            className="min-h-14 w-14 shrink-0 self-stretch rounded-lg border object-cover"
          />
        ) : (
          <IconTile icon={IconMicrophone} tone="violet" />
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-medium leading-snug">{episode.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground/80">
            {[formatDateOnly(episode.published_at), duration].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-2 flex flex-wrap justify-end gap-1.5">
            {episode.title_edited && (
              <Chip tone="warning" icon={<IconPencil />}>
                Tiêu đề đã sửa tay
              </Chip>
            )}
            <Chip
              tone={episode.is_visible ? "success" : "neutral"}
              icon={episode.is_visible ? <IconCheck /> : <IconBellOff />}
            >
              {episode.is_visible ? "Đang hiện" : "Đang ẩn"}
            </Chip>
          </div>
        </div>
      </button>
    </li>
  );
}

function EpisodeForm({
  episode,
  readOnly,
  onEdit,
  onCancel,
  onSaved,
}: {
  episode: PodcastEpisode;
  readOnly: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState(episode.title);
  const [visible, setVisible] = useState(episode.is_visible);

  const changed = title.trim() !== episode.title || visible !== episode.is_visible;

  const saveM = useMutation({
    mutationFn: () =>
      updatePodcastEpisode(episode.id, {
        ...(title.trim() !== episode.title ? { title: title.trim() } : {}),
        ...(visible !== episode.is_visible ? { is_visible: visible } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["podcast-admin-episodes"] });
      qc.invalidateQueries({ queryKey: ["podcast-episodes"] });
      qc.invalidateQueries({ queryKey: ["podcast-latest"] });
      toast.success("Đã cập nhật tập");
      onSaved();
    },
    onError: (e) => toast.error("Không lưu được", { description: (e as Error).message }),
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (changed && title.trim()) saveM.mutate();
      }}
    >
      <ReadOnlyFieldset readOnly={readOnly}>
        <div className="space-y-1.5">
          <Label htmlFor="ep-title" required>
            Tiêu đề tập
          </Label>
          <Input
            id="ep-title"
            icon={<IconMicrophone />}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="ep-date">Ngày đăng</Label>
            <Input
              id="ep-date"
              icon={<IconCalendar />}
              value={formatDateOnly(episode.published_at) ?? ""}
              readOnly
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="ep-dur">Thời lượng</Label>
            <Input
              id="ep-dur"
              icon={<IconClock />}
              value={formatDuration(episode.duration_seconds) ?? ""}
              readOnly
            />
          </div>
        </div>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => setVisible(e.target.checked)}
            className="mt-1 h-4 w-4 accent-primary"
          />
          <span>
            <span className="font-medium">Hiện trên trang Podcast</span>
            <span className="block text-sm text-muted-foreground">
              Bỏ chọn để ẩn tập không phù hợp (không xoá khỏi kho).
            </span>
          </span>
        </label>
      </ReadOnlyFieldset>
      <a
        href={episode.permalink_url}
        target="_blank"
        rel="noreferrer"
        className="inline-block text-sm text-primary hover:underline"
      >
        Mở trên Facebook →
      </a>

      <ViewEditActions
        readOnly={readOnly}
        onEdit={onEdit}
        onCancel={onCancel}
        saving={saveM.isPending}
        canSave={changed && !!title.trim()}
      />
    </form>
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
    <section className="space-y-3 rounded-xl border bg-card shadow-sm p-3">
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
      <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
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
        <Button size="sm" variant={active ? "outline" : "default"} onClick={() => setOpen((v) => !v)}>
          {open ? "Đóng" : active ? "Nối lại" : "Nối Trang"}
        </Button>
      </div>
    </section>
  );
}
