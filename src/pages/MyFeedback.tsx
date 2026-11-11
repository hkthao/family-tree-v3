import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { Chip, type ChipTone } from "@/components/Chip";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { useConfirm } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Fab } from "@/components/Fab";
import {
  IconAward,
  IconBell,
  IconCheck,
  IconHelp,
  IconMail,
  IconScroll,
  IconSearch,
  IconTag,
} from "@/components/icons";
import { IconTile } from "@/components/IconTile";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { SidePanel } from "@/components/SidePanel";
import { useToast } from "@/components/Toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReadOnlyFieldset } from "@/components/ui/readonly-fieldset";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ViewEditActions } from "@/components/ui/view-edit-actions";
import { useAuth } from "@/hooks/useAuth";
import { LIST_PAGE_SIZE_OPTIONS, useClientPaging } from "@/hooks/useClientPaging";
import {
  deleteMyFeedback,
  listMyFeedback,
  submitFeedback,
  updateMyFeedback,
  type FeedbackCategory,
  type FeedbackStatus,
  type MyFeedbackRow,
} from "@/lib/queries/feedback";
import { unaccent } from "@/lib/unaccent";

const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  bug: "Lỗi / sự cố",
  idea: "Đề xuất / ý kiến",
  question: "Câu hỏi",
  other: "Khác",
};
const CATEGORIES = Object.keys(CATEGORY_LABEL) as FeedbackCategory[];

const CATEGORY_STYLE: Record<
  FeedbackCategory,
  { tone: ChipTone; icon: React.ComponentType<{ className?: string }> }
> = {
  bug: { tone: "danger", icon: IconBell },
  idea: { tone: "warning", icon: IconAward },
  question: { tone: "info", icon: IconHelp },
  other: { tone: "neutral", icon: IconMail },
};

/**
 * Trạng thái hiện cho người gửi. "spam" là nhãn nội bộ của quản trị nên gộp
 * vào "Đã xem" — không hiện nguyên văn cho người gửi.
 */
const STATUS_VIEW: Record<FeedbackStatus, { label: string; tone: ChipTone }> = {
  new: { label: "Chờ xem", tone: "warning" },
  seen: { label: "Đã xem", tone: "info" },
  resolved: { label: "Đã xử lý", tone: "success" },
  spam: { label: "Đã xem", tone: "neutral" },
};
const STATUS_FILTERS: Array<{ value: "" | "new" | "seen" | "resolved"; label: string }> = [
  { value: "", label: "Mọi trạng thái" },
  { value: "new", label: "Chờ xem" },
  { value: "seen", label: "Đã xem" },
  { value: "resolved", label: "Đã xử lý" },
];

const fmt = (iso: string) => new Date(iso).toLocaleDateString("vi-VN");
/** Còn sửa / xoá được khi quản trị chưa xem. */
const isEditable = (r: MyFeedbackRow) => r.status === "new";

type PanelState =
  | null
  | { mode: "new" }
  | { mode: "view" | "edit"; row: MyFeedbackRow };

/**
 * /gop-y — danh sách góp ý của chính mình (đủ thêm / xem / sửa / xoá), bố cục
 * theo Danh bạ: tìm kiếm + phễu lọc, danh sách chia vạch, phân trang, nút nổi
 * "Gửi góp ý", bấm dòng mở ngăn kéo xem rồi mới sửa. Góp ý chỉ sửa / xoá được
 * khi quản trị chưa xem.
 */
export default function MyFeedback() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [panel, setPanel] = useState<PanelState>(null);
  const closePanel = () => setPanel(null);

  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ["my-feedback"],
    queryFn: () => listMyFeedback(),
    enabled: !!user?.id,
  });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | "new" | "seen" | "resolved">("");
  const [category, setCategory] = useState<FeedbackCategory | "">("");

  const filtered = useMemo(() => {
    const q = unaccent(search.trim()).toLowerCase();
    return data.filter((r) => {
      const view = r.status === "spam" ? "seen" : r.status;
      return (
        (!status || view === status) &&
        (!category || r.category === category) &&
        (!q || unaccent(`${r.message} ${r.admin_reply ?? ""}`).toLowerCase().includes(q))
      );
    });
  }, [data, search, status, category]);
  const paging = useClientPaging(filtered, 20);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["my-feedback"] });

  const delM = useMutation({
    mutationFn: (id: string) => deleteMyFeedback(id),
    onSuccess: () => {
      void invalidate();
      closePanel();
      toast.success("Đã xoá góp ý");
    },
    onError: (e) => toast.error("Không xoá được", { description: (e as Error).message }),
  });

  return (
    <div className="min-h-dvh bg-background lg:pl-72">
      <AppHeader />
      <main className="container max-w-4xl space-y-4 px-4 py-6">
        <PageHeader
          icon={<IconMail className="h-7 w-7" />}
          title="Góp ý của tôi"
          description="Các góp ý bạn đã gửi, trạng thái xử lý và phản hồi của quản trị."
          actionsBelow
          actions={<Fab onClick={() => setPanel({ mode: "new" })} label="Gửi góp ý" />}
        />

        <SidePanel
          open={panel !== null}
          title={
            panel?.mode === "new"
              ? "Gửi góp ý"
              : panel?.mode === "edit"
                ? "Sửa góp ý"
                : "Góp ý của tôi"
          }
          subtitle={
            panel?.mode === "new"
              ? "Mọi phản hồi đều giúp app tốt hơn. Viết ngắn cũng được."
              : undefined
          }
          onClose={closePanel}
          guard={panel?.mode !== "view"}
        >
          {panel && (
            <FeedbackForm
              key={panel.mode === "new" ? "new" : `${panel.mode}-${panel.row.id}`}
              row={panel.mode === "new" ? null : panel.row}
              readOnly={panel.mode === "view"}
              onSaved={() => {
                closePanel();
                void invalidate();
              }}
              onCancel={() =>
                setPanel(panel.mode === "edit" ? { mode: "view", row: panel.row } : null)
              }
              onEdit={() => panel.mode === "view" && setPanel({ mode: "edit", row: panel.row })}
              onDelete={
                panel.mode === "edit"
                  ? async () => {
                      const ok = await confirm({
                        title: "Xoá góp ý này?",
                        description: "Quản trị sẽ không còn thấy nó.",
                        confirmLabel: "Xoá",
                        destructive: true,
                      });
                      if (ok) delM.mutate(panel.row.id);
                    }
                  : undefined
              }
              deleting={delM.isPending}
            />
          )}
        </SidePanel>

        <CollapsibleFilters
          activeCount={(status ? 1 : 0) + (category ? 1 : 0)}
          onReset={() => {
            setStatus("");
            setCategory("");
            paging.patchAndResetPage({});
          }}
          title="Lọc góp ý"
          search={(toggle) => (
            <SearchInput
              label="Tìm góp ý"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                paging.patchAndResetPage({});
              }}
              placeholder="Tìm trong nội dung góp ý và phản hồi…"
              rightSlot={toggle}
            />
          )}
        >
          <div className="flex flex-col gap-3">
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as typeof status);
                paging.patchAndResetPage({});
              }}
              aria-label="Lọc theo trạng thái"
              icon={<IconCheck />}
              className="h-11 w-full text-base"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as FeedbackCategory | "");
                paging.patchAndResetPage({});
              }}
              aria-label="Lọc theo loại"
              icon={<IconTag />}
              className="h-11 w-full text-base"
            >
              <option value="">Mọi loại</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </div>
        </CollapsibleFilters>

        {isLoading && (
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-muted-foreground">Đang tải…</p>
          </div>
        )}
        {error && <ErrorState error={error} onRetry={() => void refetch()} />}

        {!isLoading && !error && data.length === 0 && (
          <EmptyState
            icon={<IconScroll className="h-10 w-10" />}
            title="Bạn chưa gửi góp ý nào"
            description="Bấm nút '+' để gửi góp ý hoặc báo lỗi. Trạng thái xử lý và phản hồi của quản trị sẽ hiện ở đây."
          />
        )}
        {!isLoading && data.length > 0 && filtered.length === 0 && (
          <EmptyState
            icon={<IconSearch className="h-10 w-10" />}
            title="Không có góp ý nào khớp"
            description="Thử bỏ bớt bộ lọc hoặc từ khoá."
          />
        )}

        {filtered.length > 0 && (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
            {paging.paged.map((r) => (
              <FeedbackRowItem key={r.id} row={r} onOpen={() => setPanel({ mode: "view", row: r })} />
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
      </main>
    </div>
  );
}

function FeedbackRowItem({ row, onOpen }: { row: MyFeedbackRow; onOpen: () => void }) {
  const cat = CATEGORY_STYLE[row.category];
  const st = STATUS_VIEW[row.status];
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-stretch gap-3 p-3 text-left transition-colors hover:bg-muted/40"
      >
        <IconTile icon={cat.icon} tone={cat.tone} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 whitespace-pre-wrap break-words font-semibold">{row.message}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{fmt(row.created_at)}</p>
          <div className="mt-2 flex flex-wrap justify-end gap-1.5">
            <Chip tone={cat.tone} icon={<cat.icon />}>
              {CATEGORY_LABEL[row.category]}
            </Chip>
            {row.admin_reply && (
              <Chip tone="primary" icon={<IconMail />}>
                Có phản hồi
              </Chip>
            )}
            <Chip tone={st.tone} icon={row.status === "new" ? <IconBell /> : <IconCheck />}>
              {st.label}
            </Chip>
          </div>
        </div>
      </button>
    </li>
  );
}

function FeedbackForm({
  row,
  readOnly,
  onSaved,
  onCancel,
  onEdit,
  onDelete,
  deleting,
}: {
  /** null = gửi mới. */
  row: MyFeedbackRow | null;
  readOnly: boolean;
  onSaved: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const toast = useToast();
  const [message, setMessage] = useState(row?.message ?? "");
  const [category, setCategory] = useState<FeedbackCategory>(row?.category ?? "idea");
  const [contact, setContact] = useState(row?.contact ?? "");

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        message: message.trim(),
        category,
        contact: contact.trim() || null,
      };
      return row
        ? updateMyFeedback(row.id, payload)
        : submitFeedback({
            ...payload,
            pageUrl: typeof window === "undefined" ? null : window.location.href,
          });
    },
    onSuccess: () => {
      toast.success(row ? "Đã cập nhật góp ý" : "Đã gửi góp ý", {
        description: row ? undefined : "Cảm ơn bạn — chúng tôi sẽ xem sớm nhất.",
      });
      onSaved();
    },
    onError: (e) => toast.error("Không lưu được", { description: (e as Error).message }),
  });

  const st = row ? STATUS_VIEW[row.status] : null;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (message.trim() && !save.isPending) save.mutate();
      }}
    >
      <ReadOnlyFieldset readOnly={readOnly}>
        <div className="space-y-1.5">
          <Label htmlFor="fb-category">Loại phản hồi</Label>
          <Select
            id="fb-category"
            icon={<IconTag />}
            className="h-10"
            value={category}
            onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </Select>
        </div>
        <Textarea
          id="fb-message"
          label="Nội dung"
          icon={<IconScroll />}
          required
          maxLength={5000}
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Vd: Khi bấm 'Lưu' thì hiện trang trắng, hoặc app thiếu chỗ ghi 'tên thường gọi'…"
        />
        <div className="space-y-1.5">
          <Label htmlFor="fb-contact">Cách liên lạc lại (tuỳ chọn)</Label>
          <Input
            id="fb-contact"
            icon={<IconMail />}
            className="h-10"
            maxLength={200}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Email / số điện thoại / Zalo — để trống cũng được"
          />
          <p className="text-xs text-muted-foreground">
            Chỉ quản trị xem được; không hiện cho người khác trong họ.
          </p>
        </div>
      </ReadOnlyFieldset>

      {row && st && (
        <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip tone={st.tone} icon={row.status === "new" ? <IconBell /> : <IconCheck />}>
              {st.label}
            </Chip>
            <span className="text-xs text-muted-foreground">Gửi ngày {fmt(row.created_at)}</span>
          </div>
          {row.admin_reply ? (
            <div className="space-y-1 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
              <p className="text-xs font-medium text-primary">
                Phản hồi từ quản trị{row.replied_at ? ` · ${fmt(row.replied_at)}` : ""}
              </p>
              <p className="whitespace-pre-wrap break-words text-sm">{row.admin_reply}</p>
            </div>
          ) : row.status === "resolved" ? (
            <p className="text-xs text-muted-foreground">
              Quản trị đã xử lý{row.resolved_at ? ` ngày ${fmt(row.resolved_at)}` : ""}.
            </p>
          ) : row.status === "new" ? (
            <p className="text-xs text-muted-foreground">
              Quản trị chưa xem. Bạn vẫn sửa hoặc xoá được góp ý này.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Quản trị đã xem nên góp ý này không sửa hoặc xoá được nữa.
            </p>
          )}
        </div>
      )}

      <ViewEditActions
        readOnly={readOnly}
        canEdit={!row || isEditable(row)}
        onEdit={onEdit}
        onCancel={onCancel}
        onDelete={onDelete}
        deleteDisabled={deleting}
        saving={save.isPending}
        canSave={message.trim().length > 0}
        saveLabel={row ? "Lưu" : "Gửi"}
      />
    </form>
  );
}
