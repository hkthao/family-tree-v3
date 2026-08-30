import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import {
  IconCalendar,
  IconCheck,
  IconClock,
  IconPencil,
  IconPlus,
  IconScroll,
  IconTrash,
  IconX,
} from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncementsForAdmin,
  updateAnnouncement,
  type Announcement,
  type AnnouncementLevel,
} from "@/lib/queries/announcements";
import { queryKeys } from "@/lib/queries/keys";

const ANNOUNCEMENT_LEVELS: Array<{ value: AnnouncementLevel; label: string }> = [
  { value: "info", label: "Tin" },
  { value: "update", label: "Cập nhật" },
  { value: "warning", label: "Cảnh báo" },
  { value: "critical", label: "Quan trọng" },
];

export function AnnouncementsAdminTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();

  const listQ = useQuery({
    queryKey: queryKeys.adminAnnouncements(),
    queryFn: () => listAnnouncementsForAdmin(),
    staleTime: 30_000,
  });

  const [editing, setEditing] = useState<Announcement | "new" | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.adminAnnouncements() });
    qc.invalidateQueries({ queryKey: queryKeys.announcements() });
    qc.invalidateQueries({ queryKey: queryKeys.publicAnnouncements() });
    qc.invalidateQueries({
      queryKey: queryKeys.announcementsUnreadCount(),
    });
  };

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: () => {
      invalidate();
      toast.success("Đã xoá tin");
    },
    onError: (e) =>
      toast.error("Không xoá được", { description: (e as Error).message }),
  });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Tổng <strong>{listQ.data?.length ?? 0}</strong> tin
          {listQ.data && ` (gồm nháp/đã hết hạn)`}.
        </p>
        <Button size="sm" onClick={() => setEditing("new")}>
          <IconPlus className="h-4 w-4 mr-1.5" />
          Tin mới
        </Button>
      </div>

      {listQ.isLoading && (
        <p className="text-muted-foreground">Đang tải…</p>
      )}
      {listQ.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {(listQ.error as Error).message}
          </AlertDescription>
        </Alert>
      )}

      {editing && (
        <AnnouncementEditor
          row={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            invalidate();
            setEditing(null);
          }}
        />
      )}

      <ul className="space-y-3">
        {(listQ.data ?? []).map((row) => (
          <AnnouncementAdminCard
            key={row.id}
            row={row}
            onEdit={() => setEditing(row)}
            onDelete={async () => {
              const ok = await confirm({
                title: `Xoá "${row.title}"?`,
                description: "Hành động này không thể hoàn tác.",
                confirmLabel: "Xoá",
                destructive: true,
              });
              if (ok) deleteM.mutate(row.id);
            }}
          />
        ))}
      </ul>
    </section>
  );
}

function AnnouncementAdminCard({
  row,
  onEdit,
  onDelete,
}: {
  row: Announcement;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const now = Date.now();
  const isDraft = row.published_at === null;
  const isExpired = row.expires_at !== null && new Date(row.expires_at).getTime() < now;
  const isFuture =
    row.published_at !== null && new Date(row.published_at).getTime() > now;
  const statusLabel = isDraft
    ? "Nháp"
    : isExpired
      ? "Hết hạn"
      : isFuture
        ? "Lên lịch"
        : "Đang đăng";
  const statusClass = isDraft
    ? "bg-muted text-muted-foreground"
    : isExpired
      ? "bg-muted/40 text-muted-foreground line-through"
      : isFuture
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

  return (
    <li className="rounded-lg border bg-card p-3 sm:p-4 space-y-2">
      <h3 className="font-semibold">{row.title}</h3>
      <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-3">
        {row.body}
      </p>
      <dl className="text-xs text-muted-foreground grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5">
        {row.published_at && (
          <>
            <dt>Đăng:</dt>
            <dd>{new Date(row.published_at).toLocaleString("vi-VN")}</dd>
          </>
        )}
        {row.expires_at && (
          <>
            <dt>Hết hạn:</dt>
            <dd>{new Date(row.expires_at).toLocaleString("vi-VN")}</dd>
          </>
        )}
      </dl>

      <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${statusClass}`}
          >
            {statusLabel}
          </span>
          <span className="text-xs text-muted-foreground">
            {ANNOUNCEMENT_LEVELS.find((l) => l.value === row.level)?.label ??
              row.level}
          </span>
          {row.is_public && (
            <span className="text-xs text-primary">Public</span>
          )}
        </div>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={onEdit}
            aria-label="Sửa tin"
            title="Sửa"
            className="h-9 w-9 p-0"
          >
            <IconPencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="destructive-outline"
            onClick={onDelete}
            aria-label="Xoá tin"
            title="Xoá"
            className="h-9 w-9 p-0 hover:"
          >
            <IconTrash className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </li>
  );
}

function AnnouncementEditor({
  row,
  onClose,
  onSaved,
}: {
  row: Announcement | null;
  onClose: () => void;
  onSaved: () => void;
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
    onError: (e) =>
      toast.error("Không lưu được", { description: (e as Error).message }),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim() && body.trim()) saveM.mutate();
      }}
      className="rounded-lg border bg-card p-4 space-y-4"
    >
      <h3 className="font-semibold">{row ? "Sửa tin" : "Tin mới"}</h3>

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
          className="text-sm resize-y"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-base font-medium">Mức độ</legend>
        <div className="flex flex-wrap gap-2">
          {ANNOUNCEMENT_LEVELS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 rounded-md border px-3 py-1.5 cursor-pointer text-sm ${
                level === opt.value
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/40"
              }`}
            >
              <input
                type="radio"
                name="ann-level"
                checked={level === opt.value}
                onChange={() => setLevel(opt.value)}
                className="h-4 w-4 accent-primary"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="mt-1 h-4 w-4 accent-primary shrink-0"
        />
        <span>
          <span className="font-medium">Public — hiện ở /changelog</span>
          <span className="block text-sm text-muted-foreground">
            Anon đọc được. Bật khi đây là cập nhật muốn quảng bá ra ngoài.
          </span>
        </span>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={publishNow}
              onChange={(e) => setPublishNow(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Đăng ngay
          </label>
          <p className="text-xs text-muted-foreground">
            Để trống và bỏ check "Đăng ngay" = lưu nháp.
          </p>
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
      </div>

      <div className="flex gap-2 pt-2 border-t">
        <Button
          type="submit"
          variant="outline"
          disabled={saveM.isPending || !title.trim() || !body.trim()}
        >
          <IconCheck className="h-4 w-4 mr-1.5" />
          {saveM.isPending ? "Đang lưu…" : row ? "Cập nhật" : "Tạo"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          <IconX className="h-4 w-4 mr-1.5" />
          Huỷ
        </Button>
      </div>
    </form>
  );
}

// ───────────── Nhập gia phả (vietnamgiapha.com) ─────────────────────

function toLocalInput(iso: string): string {
  // YYYY-MM-DDTHH:mm — datetime-local input. Drop seconds + tz.
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Tab Cấu hình (demo config động) ──────────────────────────────

/**
 * Cấu hình nền tảng động (không cần deploy). Hiện có: chọn các DÒNG HỌ DEMO —
 * những dòng họ CÔNG KHAI được tick sẽ dùng cho nút "Xem thử" ở trang Đăng nhập.
 */
