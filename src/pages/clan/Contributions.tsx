import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link, Navigate } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { Chip, type ChipTone } from "@/components/Chip";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { EmptyState } from "@/components/EmptyState";
import { IconTile } from "@/components/IconTile";
import {
  IconCheck,
  IconClock,
  IconHelp,
  IconPencil,
  IconScroll,
  IconSearch,
  IconTag,
  IconUserPlus,
  IconX,
} from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { canEditClan, useClanContext } from "@/hooks/useClanContext";
import { LIST_PAGE_SIZE_OPTIONS, useClientPaging, useSearchBox, useUrlFilter } from "@/hooks/useClientPaging";
import {
  listContributions,
  type ContributionRow,
  type ContributionStatus,
} from "@/lib/queries/contributions";
import { queryKeys } from "@/lib/queries/keys";
import { unaccent } from "@/lib/unaccent";

type Icon = React.ComponentType<{ className?: string }>;

const STATUS_FILTERS: Array<{ value: ContributionStatus | "all"; label: string }> = [
  { value: "pending", label: "Chờ duyệt" },
  { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Đã từ chối" },
  { value: "needs_info", label: "Cần thêm" },
  { value: "all", label: "Tất cả" },
];

const TYPE_LABEL: Record<ContributionRow["contribution_type"], string> = {
  edit_person: "Sửa",
  add_note: "Bổ sung tiểu sử",
  add_person: "Thêm người",
};

const TYPE_ICON: Record<ContributionRow["contribution_type"], Icon> = {
  edit_person: IconPencil,
  add_note: IconScroll,
  add_person: IconUserPlus,
};

/** Chờ duyệt = vàng (cần xử lý); đã duyệt = xanh; từ chối = đỏ; cần thêm = xanh dương. */
const STATUS_STYLE: Record<ContributionStatus, { label: string; tone: ChipTone; icon: Icon }> = {
  pending: { label: "Chờ duyệt", tone: "warning", icon: IconClock },
  approved: { label: "Đã duyệt", tone: "success", icon: IconCheck },
  rejected: { label: "Đã từ chối", tone: "danger", icon: IconX },
  needs_info: { label: "Cần thêm", tone: "info", icon: IconHelp },
};

/**
 * /clans/:id/contributions — admin/editor review queue.
 *
 * RLS already filters out viewers from this list (they only see their
 * own submissions, never anyone else's), and the apply/reject RPCs
 * enforce admin-only at the SQL layer. We still gate the navigation
 * client-side so viewers don't accidentally land here.
 *
 * Bấm một dòng đi tới trang duyệt (có so sánh trước/sau và nút duyệt/từ chối) — đó là quy trình
 * làm việc chứ không phải form xem/sửa nên không dùng ngăn kéo.
 */
export default function Contributions() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const canEdit = canEditClan(clan);

  const [status, setStatus] = useUrlFilter<ContributionStatus | "all">("tt", "pending");
  // Từ khoá tìm nằm trên URL (?q=) nên bấm Back vẫn giữ nguyên.
  const { q: search, text: searchText, setText: setSearchText } = useSearchBox();
  const { data: rows, isLoading, error } = useQuery({
    queryKey: queryKeys.contributions(clan.id, userId, { status }),
    queryFn: () => listContributions(clan.id, { status }),
    enabled: !!userId && canEdit,
  });

  const filtered = useMemo(() => {
    const q = unaccent(search.trim()).toLowerCase();
    return (rows ?? []).filter(
      (c) =>
        !q ||
        unaccent(`${c.submitter_name ?? ""} ${c.submitter_relation ?? ""}`).toLowerCase().includes(q),
    );
  }, [rows, search]);
  const paging = useClientPaging(filtered, 20);

  if (!canEdit) {
    return <Navigate to={`/clans/${clan.id}`} replace />;
  }

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: "Đóng góp" },
        ]}
      />

      <PageHeader
        icon={<IconScroll className="h-7 w-7" />}
        title="Đóng góp từ cộng đồng"
        description="Người xem đề xuất sửa hoặc thêm thông tin — admin duyệt trước khi áp dụng vào gia phả."
      />

      {/* Trạng thái nằm trong ngăn kéo của phễu (mặc định "Chờ duyệt") — như Danh bạ. */}
      <CollapsibleFilters
        activeCount={status !== "pending" ? 1 : 0}
        onReset={() => {
          paging.patchAndResetPage({ tt: null });
        }}
        title="Lọc đóng góp"
        search={(toggle) => (
          <SearchInput
            label="Tìm đóng góp"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
            }}
            placeholder="Tìm theo tên người gửi…"
            rightSlot={toggle}
          />
        )}
      >
        <div className="flex flex-col gap-3">
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ContributionStatus | "all");
            }}
            aria-label="Lọc theo trạng thái"
            icon={<IconTag />}
            className="h-11 w-full text-base"
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
      </CollapsibleFilters>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-muted-foreground">Đang tải…</p>
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <EmptyState
          icon={search.trim() ? <IconSearch className="h-10 w-10" /> : <IconScroll className="h-10 w-10" />}
          title={search.trim() ? "Không có đóng góp nào khớp" : "Chưa có đóng góp nào"}
          description={
            search.trim()
              ? "Thử bỏ bớt từ khoá hoặc đổi trạng thái."
              : "Khi có người gửi đề xuất, danh sách sẽ xuất hiện ở đây."
          }
        />
      )}

      {filtered.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {paging.paged.map((c) => (
            <ContributionRowItem key={c.id} c={c} clanId={clan.id} />
          ))}
        </ul>
      )}

      {filtered.length > 0 && (
        <Pagination
          page={paging.page}
          totalPages={paging.totalPages}
          total={paging.total}
          pageSize={paging.pageSize}
          unit="đóng góp"
          onPageChange={paging.setPage}
          pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
          onPageSizeChange={paging.setPageSize}
        />
      )}
    </div>
  );
}

function ContributionRowItem({ c, clanId }: { c: ContributionRow; clanId: string }) {
  const st = STATUS_STYLE[c.status];
  const StatusIcon = st.icon;
  const TypeIcon = TYPE_ICON[c.contribution_type];
  const submitterDisplay = c.submitter_name ?? (c.submitter_user_id ? "Thành viên" : "Khách");
  return (
    <li>
      <Link
        to={`/clans/${clanId}/contributions/${c.id}`}
        className="flex items-stretch gap-3 p-3 transition-colors hover:bg-muted/40"
      >
        <IconTile icon={TypeIcon} tone={st.tone} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{submitterDisplay}</p>
          {c.submitter_relation && (
            <p className="truncate text-sm text-muted-foreground">{c.submitter_relation}</p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground/80">
            {new Date(c.created_at).toLocaleString("vi-VN")}
            {c.submitter_user_id === null && " · qua link chia sẻ"}
          </p>
          <div className="mt-2 flex flex-wrap justify-end gap-1.5">
            <Chip tone="neutral" icon={<TypeIcon />}>
              {TYPE_LABEL[c.contribution_type]}
            </Chip>
            <Chip tone={st.tone} icon={<StatusIcon />}>
              {st.label}
            </Chip>
          </div>
        </div>
      </Link>
    </li>
  );
}
