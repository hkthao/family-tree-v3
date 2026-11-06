import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Chip, type ChipTone } from "@/components/Chip";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { EmptyState } from "@/components/EmptyState";
import { IconTile } from "@/components/IconTile";
import {
  IconBell,
  IconBellOff,
  IconCalendar,
  IconCheck,
  IconFlame,
  IconHelp,
  IconMail,
  IconScroll,
  IconSearch,
  IconSparkles,
  IconTag,
  IconUser,
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
import { LIST_PAGE_SIZE_OPTIONS, useClientPaging, useSearchBox } from "@/hooks/useClientPaging";
import { useUrlState } from "@/hooks/useUrlState";
import {
  getFeedbackSenders,
  listFeedback,
  updateFeedback,
  type FeedbackCategory,
  type FeedbackRow,
  type FeedbackSender,
  type FeedbackStatus,
} from "@/lib/queries/feedback";
import { queryKeys } from "@/lib/queries/keys";
import { unaccent } from "@/lib/unaccent";
import { RefreshIconButton } from "@/pages/admin/shared";

const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: "Mới",
  seen: "Đã xem",
  resolved: "Đã xử lý",
  spam: "Spam",
};

const FEEDBACK_CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  bug: "Lỗi",
  idea: "Ý kiến",
  question: "Câu hỏi",
  other: "Khác",
};

/** Màu chip + icon trạng thái: mới = vàng (cần xem); xử lý xong = xanh; spam = xám. */
const STATUS_STYLE: Record<
  FeedbackStatus,
  { tone: ChipTone; icon: React.ComponentType<{ className?: string }> }
> = {
  new: { tone: "warning", icon: IconBell },
  seen: { tone: "info", icon: IconCheck },
  resolved: { tone: "success", icon: IconCheck },
  spam: { tone: "neutral", icon: IconBellOff },
};

const CATEGORY_STYLE: Record<
  FeedbackCategory,
  { tone: ChipTone; icon: React.ComponentType<{ className?: string }> }
> = {
  bug: { tone: "danger", icon: IconFlame },
  idea: { tone: "info", icon: IconSparkles },
  question: { tone: "violet", icon: IconHelp },
  other: { tone: "neutral", icon: IconMail },
};

const STATUSES = ["all", "new", "seen", "resolved", "spam"] as const;

/** Trạng thái ngăn kéo: xem (chỉ đọc) hoặc sửa (đổi trạng thái / ghi chú nội bộ). */
type PanelState = { mode: "view" | "edit"; row: FeedbackRow } | null;

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function FeedbackTab() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.adminFeedback(),
    queryFn: () => listFeedback(),
    staleTime: 30_000,
  });
  // Phân giải người gửi (tên + email) cho mọi feedback có user_id để admin
  // biết là ai mà hỗ trợ (vd mở khoá giới hạn dòng họ).
  const senderIds = (data ?? []).map((r) => r.user_id);
  const { data: senders } = useQuery({
    queryKey: ["feedback-senders", senderIds],
    queryFn: () => getFeedbackSenders(senderIds),
    enabled: senderIds.some(Boolean),
  });

  const { q, text, setText } = useSearchBox();
  const [statusRaw] = useUrlState("status", "new");
  const statusFilter = (
    (STATUSES as readonly string[]).includes(statusRaw) ? statusRaw : "new"
  ) as FeedbackStatus | "all";
  const [panel, setPanel] = useState<PanelState>(null);
  const closePanel = () => setPanel(null);

  const filtered = useMemo(() => {
    const needle = unaccent(q.trim());
    return (data ?? []).filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!needle) return true;
      return unaccent(
        `${r.message} ${r.contact ?? ""} ${r.page_path ?? ""} ${r.admin_note ?? ""}`,
      ).includes(needle);
    });
  }, [data, q, statusFilter]);
  const paging = useClientPaging(filtered, 20);

  const counts = useMemo(() => {
    const c: Record<FeedbackStatus, number> = { new: 0, seen: 0, resolved: 0, spam: 0 };
    for (const r of data ?? []) c[r.status]++;
    return c;
  }, [data]);

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <p className="text-muted-foreground">Đang tải…</p>
      </div>
    );
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  const senderOf = (r: FeedbackRow) => (r.user_id ? senders?.get(r.user_id) : undefined);

  return (
    <div className="space-y-3">
      {/* Trạng thái nằm trong ngăn kéo của phễu (mặc định chỉ xem "Mới") — như Danh bạ. */}
      <CollapsibleFilters
        activeCount={statusFilter !== "new" ? 1 : 0}
        onReset={() => paging.patchAndResetPage({ status: null })}
        title="Lọc góp ý"
        search={(toggle) => (
          <SearchInput
            label="Tìm trong nội dung / liên hệ / ghi chú"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tìm theo nội dung, email/SĐT, hoặc ghi chú admin…"
            className="pr-[4.75rem]"
            rightSlot={
              <>
                {toggle}
                <RefreshIconButton onClick={() => refetch()} busy={isFetching} compact />
              </>
            }
          />
        )}
      >
        <div className="flex flex-col gap-3">
          <Select
            value={statusFilter}
            onChange={(e) => paging.patchAndResetPage({ status: e.target.value })}
            aria-label="Lọc theo trạng thái"
            icon={<IconTag />}
            className="h-11 w-full text-base"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "Tất cả" : FEEDBACK_STATUS_LABEL[s]} ({s === "all" ? (data?.length ?? 0) : counts[s]})
              </option>
            ))}
          </Select>
          {(data?.length ?? 0) >= 500 && (
            <p className="text-xs text-muted-foreground">Đang giới hạn 500 góp ý mới nhất.</p>
          )}
        </div>
      </CollapsibleFilters>

      {filtered.length === 0 && (
        <EmptyState
          icon={<IconSearch className="h-10 w-10" />}
          title={
            data?.length === 0 ? "Chưa có góp ý nào" : "Không có góp ý nào khớp"
          }
          description={
            data?.length === 0
              ? "Chờ người dùng gửi."
              : "Thử đổi trạng thái hoặc bỏ bớt từ khoá."
          }
        />
      )}

      {filtered.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {paging.paged.map((r) => (
            <FeedbackRowItem
              key={r.id}
              row={r}
              sender={senderOf(r)}
              onOpen={() => setPanel({ mode: "view", row: r })}
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
          unit="góp ý"
          onPageChange={paging.setPage}
          pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
          onPageSizeChange={paging.setPageSize}
        />
      )}

      <SidePanel
        open={panel !== null}
        title={panel?.mode === "edit" ? "Xử lý góp ý" : "Góp ý"}
        subtitle={panel ? formatTime(panel.row.created_at) : undefined}
        onClose={closePanel}
        guard={panel?.mode === "edit"}
      >
        {panel && (
          <FeedbackForm
            key={`${panel.mode}-${panel.row.id}`}
            row={panel.row}
            sender={senderOf(panel.row)}
            readOnly={panel.mode === "view"}
            onEdit={() => setPanel({ mode: "edit", row: panel.row })}
            onCancel={() =>
              setPanel(panel.mode === "edit" ? { mode: "view", row: panel.row } : null)
            }
            onSaved={() => {
              closePanel();
              qc.invalidateQueries({ queryKey: queryKeys.adminFeedback() });
            }}
          />
        )}
      </SidePanel>
    </div>
  );
}

function FeedbackRowItem({
  row,
  sender,
  onOpen,
}: {
  row: FeedbackRow;
  sender?: FeedbackSender;
  onOpen: () => void;
}) {
  const st = STATUS_STYLE[row.status];
  const cat = CATEGORY_STYLE[row.category];
  const StatusIcon = st.icon;
  const CatIcon = cat.icon;
  const who = row.user_id
    ? (sender?.display_name || sender?.email || "Người dùng")
    : "Khách (chưa đăng nhập)";
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-stretch gap-3 p-3 text-left transition-colors hover:bg-muted/40"
      >
        <IconTile icon={CatIcon} tone={cat.tone} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 whitespace-pre-line font-medium">{row.message}</p>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{who}</p>
          <p className="mt-0.5 text-xs text-muted-foreground/80 tabular-nums">{formatTime(row.created_at)}</p>
          <div className="mt-2 flex flex-wrap justify-end gap-1.5">
            <Chip tone={cat.tone} icon={<CatIcon />}>
              {FEEDBACK_CATEGORY_LABEL[row.category]}
            </Chip>
            <Chip tone={st.tone} icon={<StatusIcon />}>
              {FEEDBACK_STATUS_LABEL[row.status]}
            </Chip>
          </div>
        </div>
      </button>
    </li>
  );
}

function FeedbackForm({
  row,
  sender,
  readOnly,
  onEdit,
  onCancel,
  onSaved,
}: {
  row: FeedbackRow;
  sender?: FeedbackSender;
  readOnly: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [status, setStatus] = useState<FeedbackStatus>(row.status);
  const [note, setNote] = useState(row.admin_note ?? "");

  const changed = status !== row.status || note.trim() !== (row.admin_note ?? "").trim();

  const saveM = useMutation({
    mutationFn: () =>
      updateFeedback(row.id, {
        ...(status !== row.status ? { status } : {}),
        admin_note: note.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Đã cập nhật góp ý");
      onSaved();
    },
    onError: (e) => toast.error("Không lưu được", { description: (e as Error).message }),
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (changed) saveM.mutate();
      }}
    >
      <ReadOnlyFieldset readOnly={readOnly}>
        <div className="space-y-1.5">
          <Label htmlFor="fb-msg">Nội dung</Label>
          <Textarea id="fb-msg" value={row.message} readOnly />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="fb-cat">Phân loại</Label>
            <Input id="fb-cat" icon={<IconTag />} value={FEEDBACK_CATEGORY_LABEL[row.category]} readOnly />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="fb-time">Thời gian</Label>
            <Input id="fb-time" icon={<IconCalendar />} value={formatTime(row.created_at)} readOnly />
          </div>
        </div>
        {row.contact && (
          <div className="space-y-1.5">
            <Label htmlFor="fb-contact">Liên lạc</Label>
            <Input id="fb-contact" icon={<IconMail />} value={row.contact} readOnly />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="fb-sender">Người gửi</Label>
          <Input
            id="fb-sender"
            icon={<IconUser />}
            value={
              row.user_id
                ? [sender?.display_name, sender?.email].filter(Boolean).join(" · ") || "(đang tải…)"
                : "Khách (chưa đăng nhập)"
            }
            readOnly
          />
          {/* Mở thẳng Người dùng, lọc sẵn theo email để xem dòng họ + chỉnh giới hạn. */}
          {sender?.email && (
            <Link
              to={`/admin/nguoi-dung?q=${encodeURIComponent(sender.email)}`}
              className="inline-block text-sm text-primary hover:underline"
            >
              Quản lý người dùng này ↗
            </Link>
          )}
        </div>
        {row.clan_id && (
          <div className="space-y-1.5">
            <Label htmlFor="fb-clan">Dòng họ</Label>
            <Input id="fb-clan" value={row.clan_id} readOnly className="font-mono text-xs" />
            <Link to={`/clans/${row.clan_id}`} className="inline-block text-sm text-primary hover:underline">
              Mở dòng họ ↗
            </Link>
          </div>
        )}
        {(row.page_path || row.app_version) && (
          <div className="grid grid-cols-1 gap-3">
            {row.page_path && (
              <div className="space-y-1.5">
                <Label htmlFor="fb-page">Trang</Label>
                <Input id="fb-page" value={row.page_path} readOnly className="font-mono text-xs" />
              </div>
            )}
            {row.app_version && (
              <div className="space-y-1.5">
                <Label htmlFor="fb-ver">Phiên bản</Label>
                <Input id="fb-ver" value={row.app_version} readOnly className="font-mono text-xs" />
              </div>
            )}
          </div>
        )}
        {row.user_agent && <p className="break-all text-xs text-muted-foreground/70">UA: {row.user_agent}</p>}

        <div className="space-y-1.5">
          <Label htmlFor="fb-status">Trạng thái</Label>
          <Select
            id="fb-status"
            icon={<IconCheck />}
            value={status}
            onChange={(e) => setStatus(e.target.value as FeedbackStatus)}
          >
            {(Object.keys(FEEDBACK_STATUS_LABEL) as FeedbackStatus[]).map((s) => (
              <option key={s} value={s}>
                {FEEDBACK_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fb-note">Ghi chú nội bộ (chỉ admin xem)</Label>
          <Textarea
            id="fb-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú nội bộ…"
            maxLength={4000}
          />
        </div>
        {readOnly && !row.admin_note && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <IconScroll className="h-3.5 w-3.5" /> Chưa có ghi chú nội bộ.
          </p>
        )}
      </ReadOnlyFieldset>

      <ViewEditActions
        readOnly={readOnly}
        onEdit={onEdit}
        onCancel={onCancel}
        saving={saveM.isPending}
        canSave={changed}
      />
    </form>
  );
}
