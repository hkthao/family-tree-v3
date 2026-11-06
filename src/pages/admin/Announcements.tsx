import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Chip, type ChipTone } from "@/components/Chip";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { useConfirm } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { Fab } from "@/components/Fab";
import { IconTile } from "@/components/IconTile";
import {
  IconBell,
  IconCalendar,
  IconCheck,
  IconClock,
  IconGlobe,
  IconPencil,
  IconScroll,
  IconSearch,
  IconTag,
} from "@/components/icons";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { SidePanel } from "@/components/SidePanel";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReadOnlyFieldset } from "@/components/ui/readonly-fieldset";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ViewEditActions } from "@/components/ui/view-edit-actions";
import { LIST_PAGE_SIZE_OPTIONS, useClientPaging } from "@/hooks/useClientPaging";
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncementsForAdmin,
  updateAnnouncement,
  type Announcement,
  type AnnouncementLevel,
} from "@/lib/queries/announcements";
import { queryKeys } from "@/lib/queries/keys";
import { unaccent } from "@/lib/unaccent";

const ANNOUNCEMENT_LEVELS: Array<{ value: AnnouncementLevel; label: string }> = [
  { value: "info", label: "Tin" },
  { value: "update", label: "Cập nhật" },
  { value: "warning", label: "Cảnh báo" },
  { value: "critical", label: "Quan trọng" },
];

const LEVEL_TONE: Record<AnnouncementLevel, ChipTone> = {
  info: "info",
  update: "primary",
  warning: "warning",
  critical: "danger",
};

type StatusKey = "draft" | "expired" | "scheduled" | "live";

const STATUS_LABEL: Record<StatusKey, string> = {
  draft: "Nháp",
  expired: "Hết hạn",
  scheduled: "Lên lịch",
  live: "Đang đăng",
};

/** Nháp = xám; hết hạn = xám; lên lịch = vàng; đang đăng = xanh. */
const STATUS_TONE: Record<StatusKey, ChipTone> = {
  draft: "neutral",
  expired: "neutral",
  scheduled: "warning",
  live: "success",
};

function statusOf(row: Announcement): StatusKey {
  const now = Date.now();
  if (row.published_at === null) return "draft";
  if (row.expires_at !== null && new Date(row.expires_at).getTime() < now) return "expired";
  if (new Date(row.published_at).getTime() > now) return "scheduled";
  return "live";
}

/** Trạng thái ngăn kéo: tạo mới, xem (chỉ đọc) hoặc sửa một tin. */
type PanelState =
  | { mode: "new" }
  | { mode: "view" | "edit"; row: Announcement }
  | null;

const fmt = (iso: string) => new Date(iso).toLocaleString("vi-VN");

export function AnnouncementsAdminTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const [panel, setPanel] = useState<PanelState>(null);
  const closePanel = () => setPanel(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey | "">("");

  const listQ = useQuery({
    queryKey: queryKeys.adminAnnouncements(),
    queryFn: () => listAnnouncementsForAdmin(),
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const needle = unaccent(search.trim());
    return (listQ.data ?? []).filter(
      (r) =>
        (!statusFilter || statusOf(r) === statusFilter) &&
        (!needle || unaccent(`${r.title} ${r.body}`).includes(needle)),
    );
  }, [listQ.data, search, statusFilter]);
  const paging = useClientPaging(filtered, 20);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.adminAnnouncements() });
    qc.invalidateQueries({ queryKey: queryKeys.announcements() });
    qc.invalidateQueries({ queryKey: queryKeys.publicAnnouncements() });
    qc.invalidateQueries({ queryKey: queryKeys.announcementsUnreadCount() });
  };

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: () => {
      invalidate();
      closePanel();
      toast.success("Đã xoá tin");
    },
    onError: (e) => toast.error("Không xoá được", { description: (e as Error).message }),
  });

  return (
    <div className="space-y-3">
      <Fab onClick={() => setPanel({ mode: "new" })} label="Tin mới" />

      <CollapsibleFilters
        activeCount={statusFilter ? 1 : 0}
        onReset={() => {
          setStatusFilter("");
          paging.patchAndResetPage({});
        }}
        title="Lọc thông báo"
        search={(toggle) => (
          <SearchInput
            label="Tìm thông báo"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              paging.patchAndResetPage({});
            }}
            placeholder="Tìm theo tiêu đề / nội dung…"
            rightSlot={toggle}
          />
        )}
      >
        <div className="flex flex-col gap-3">
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusKey | "");
              paging.patchAndResetPage({});
            }}
            aria-label="Lọc theo trạng thái"
            icon={<IconTag />}
            className="h-11 w-full text-base"
          >
            <option value="">Mọi trạng thái</option>
            {(Object.keys(STATUS_LABEL) as StatusKey[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
      </CollapsibleFilters>

      {listQ.isLoading && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-muted-foreground">Đang tải…</p>
        </div>
      )}
      {listQ.error && (
        <Alert variant="destructive">
          <AlertDescription>{(listQ.error as Error).message}</AlertDescription>
        </Alert>
      )}

      {!listQ.isLoading && filtered.length === 0 && (
        <EmptyState
          icon={<IconSearch className="h-10 w-10" />}
          title={
            listQ.data?.length ? "Không có thông báo nào khớp" : "Chưa có thông báo nào"
          }
          description={
            listQ.data?.length ? "Thử bỏ bớt bộ lọc hoặc từ khoá." : "Bấm nút '+' để viết tin đầu tiên."
          }
        />
      )}

      {filtered.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {paging.paged.map((row) => (
            <AnnouncementRow
              key={row.id}
              row={row}
              onOpen={() => setPanel({ mode: "view", row })}
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
          unit="tin"
          onPageChange={paging.setPage}
          pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
          onPageSizeChange={paging.setPageSize}
        />
      )}

      <SidePanel
        open={panel !== null}
        title={
          panel?.mode === "new" ? "Tin mới" : panel?.mode === "edit" ? "Sửa tin" : "Thông báo"
        }
        subtitle={panel && panel.mode !== "new" ? panel.row.title : undefined}
        onClose={closePanel}
        size="lg"
        guard={panel?.mode !== "view"}
      >
        {panel && (
          <AnnouncementForm
            key={panel.mode === "new" ? "new" : `${panel.mode}-${panel.row.id}`}
            row={panel.mode === "new" ? null : panel.row}
            readOnly={panel.mode === "view"}
            onEdit={() => panel.mode === "view" && setPanel({ mode: "edit", row: panel.row })}
            onCancel={() =>
              setPanel(panel.mode === "edit" ? { mode: "view", row: panel.row } : null)
            }
            onSaved={() => {
              closePanel();
              invalidate();
            }}
            onDelete={
              panel.mode === "edit"
                ? async () => {
                    const ok = await confirm({
                      title: `Xoá "${panel.row.title}"?`,
                      description: "Hành động này không thể hoàn tác.",
                      confirmLabel: "Xoá",
                      destructive: true,
                    });
                    if (ok) deleteM.mutate(panel.row.id);
                  }
                : undefined
            }
          />
        )}
      </SidePanel>
    </div>
  );
}

function AnnouncementRow({ row, onOpen }: { row: Announcement; onOpen: () => void }) {
  const status = statusOf(row);
  const level = ANNOUNCEMENT_LEVELS.find((l) => l.value === row.level)?.label ?? row.level;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-stretch gap-3 p-3 text-left transition-colors hover:bg-muted/40"
      >
        <IconTile icon={IconBell} tone={LEVEL_TONE[row.level]} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{row.title}</p>
          <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">
            {row.body}
          </p>
          {(row.published_at || row.expires_at) && (
            <p className="mt-0.5 text-xs text-muted-foreground/80">
              {row.published_at && `Đăng ${fmt(row.published_at)}`}
              {row.published_at && row.expires_at && " · "}
              {row.expires_at && `Hết hạn ${fmt(row.expires_at)}`}
            </p>
          )}
          <div className="mt-2 flex flex-wrap justify-end gap-1.5">
            <Chip tone={LEVEL_TONE[row.level]} icon={<IconBell />}>
              {level}
            </Chip>
            <Chip
              tone={STATUS_TONE[status]}
              icon={
                status === "live" ? (
                  <IconCheck />
                ) : status === "scheduled" ? (
                  <IconCalendar />
                ) : status === "expired" ? (
                  <IconClock />
                ) : (
                  <IconPencil />
                )
              }
            >
              {STATUS_LABEL[status]}
            </Chip>
            {row.is_public && (
              <Chip tone="primary" icon={<IconGlobe />}>
                Public
              </Chip>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}

function AnnouncementForm({
  row,
  readOnly,
  onEdit,
  onCancel,
  onSaved,
  onDelete,
}: {
  row: Announcement | null;
  readOnly: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
  onDelete?: () => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(row?.title ?? "");
  const [body, setBody] = useState(row?.body ?? "");
  const [level, setLevel] = useState<AnnouncementLevel>(row?.level ?? "info");
  const [isPublic, setIsPublic] = useState(row?.is_public ?? false);
  const [publishedAt, setPublishedAt] = useState<string>(
    row?.published_at ? toLocalInput(row.published_at) : "",
  );
  const [expiresAt, setExpiresAt] = useState<string>(
    row?.expires_at ? toLocalInput(row.expires_at) : "",
  );
  const [publishNow, setPublishNow] = useState(false);

  const saveM = useMutation({
    mutationFn: async () => {
      const draft = {
        title: title.trim(),
        body: body.trim(),
        level,
        is_public: isPublic,
        published_at: publishNow
          ? new Date().toISOString()
          : publishedAt
            ? new Date(publishedAt).toISOString()
            : null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      };
      if (row) {
        await updateAnnouncement(row.id, draft);
      } else {
        await createAnnouncement(draft);
      }
    },
    onSuccess: () => {
      toast.success(row ? "Đã cập nhật tin" : "Đã tạo tin");
      onSaved();
    },
    onError: (e) => toast.error("Không lưu được", { description: (e as Error).message }),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim() && body.trim()) saveM.mutate();
      }}
      className="space-y-3"
    >
      <ReadOnlyFieldset readOnly={readOnly}>
        <div className="space-y-2">
          <Label htmlFor="ann-title" required>
            Tiêu đề
          </Label>
          <Input
            id="ann-title"
            icon={<IconScroll />}
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ann-body" required>
            Nội dung
          </Label>
          <Textarea
            id="ann-body"
            required
            maxLength={20000}
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ann-level">Mức độ</Label>
          <Select
            id="ann-level"
            icon={<IconBell />}
            value={level}
            onChange={(e) => setLevel(e.target.value as AnnouncementLevel)}
          >
            {ANNOUNCEMENT_LEVELS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-primary"
          />
          <span>
            <span className="font-medium">Public — hiện ở /changelog</span>
            <span className="block text-sm text-muted-foreground">
              Anon đọc được. Bật khi đây là cập nhật muốn quảng bá ra ngoài.
            </span>
          </span>
        </label>

        <div className="space-y-2">
          <Label htmlFor="ann-published">Lịch đăng</Label>
          <Input
            id="ann-published"
            icon={<IconCalendar />}
            type="datetime-local"
            value={publishedAt}
            onChange={(e) => {
              setPublishedAt(e.target.value);
              setPublishNow(false);
            }}
            disabled={publishNow}
          />
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={publishNow}
              onChange={(e) => setPublishNow(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-primary"
            />
            <span>
              <span className="font-medium">Đăng ngay</span>
              <span className="block text-sm text-muted-foreground">
                Đăng khi bấm Lưu. Để trống lịch đăng và bỏ chọn = lưu nháp.
              </span>
            </span>
          </label>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ann-expires">Hết hạn (tuỳ chọn)</Label>
          <Input
            id="ann-expires"
            icon={<IconClock />}
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
      </ReadOnlyFieldset>

      <ViewEditActions
        readOnly={readOnly}
        onEdit={onEdit}
        onCancel={onCancel}
        onDelete={onDelete}
        saving={saveM.isPending}
        canSave={!!title.trim() && !!body.trim()}
        saveLabel={row ? "Lưu" : "Tạo"}
      />
    </form>
  );
}

function toLocalInput(iso: string): string {
  // YYYY-MM-DDTHH:mm — datetime-local input. Drop seconds + tz.
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
