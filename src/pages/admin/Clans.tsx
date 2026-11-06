import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Chip } from "@/components/Chip";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { EmptyState } from "@/components/EmptyState";
import { IconTile } from "@/components/IconTile";
import {
  IconBuildings,
  IconGlobe,
  IconLock,
  IconScroll,
  IconSearch,
  IconSparkles,
  IconTag,
  IconUser,
  IconUsers,
} from "@/components/icons";
import { Pagination } from "@/components/Pagination";
import { RecordDates } from "@/components/RecordDates";
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
import {
  listAllClans,
  updateClanLimits,
  type AdminClanRow,
} from "@/lib/queries/admin";
import { queryKeys } from "@/lib/queries/keys";
import { unaccent } from "@/lib/unaccent";
import { RefreshIconButton } from "@/pages/admin/shared";

type VisibilityFilter = "" | "public" | "private";

/** Trạng thái ngăn kéo: xem (chỉ đọc) hoặc sửa hạn mức một dòng họ. */
type PanelState = { mode: "view" | "edit"; clan: AdminClanRow } | null;

export function ClansTab() {
  const qc = useQueryClient();
  const { q, text, setText } = useSearchBox();
  const [visibility, setVisibility] = useState<VisibilityFilter>("");
  const [panel, setPanel] = useState<PanelState>(null);
  const closePanel = () => setPanel(null);

  const { data: clans, isLoading, refetch, isFetching } = useQuery({
    queryKey: queryKeys.adminClans(),
    queryFn: () => listAllClans(),
    // Xem ghi chú ở UsersTab: dữ liệu mới nhất + nút Tải lại cho PWA.
    staleTime: 0,
    refetchOnMount: "always",
  });

  const filtered = useMemo(() => {
    const needle = unaccent(q.trim());
    return (clans ?? []).filter(
      (c) =>
        (!visibility || c.visibility === visibility) && (!needle || unaccent(c.name).includes(needle)),
    );
  }, [clans, q, visibility]);
  const paging = useClientPaging(filtered, 20);

  return (
    <div className="space-y-3">
      <CollapsibleFilters
        activeCount={visibility ? 1 : 0}
        onReset={() => {
          setVisibility("");
          paging.patchAndResetPage({});
        }}
        title="Lọc dòng họ"
        search={(toggle) => (
          <SearchInput
            label="Tìm dòng họ theo tên"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tìm dòng họ theo tên — gõ không dấu cũng được"
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
            value={visibility}
            onChange={(e) => {
              setVisibility(e.target.value as VisibilityFilter);
              paging.patchAndResetPage({});
            }}
            aria-label="Lọc theo chế độ hiển thị"
            icon={<IconTag />}
            className="h-11 w-full text-base"
          >
            <option value="">Mọi dòng họ</option>
            <option value="public">Công khai</option>
            <option value="private">Riêng tư</option>
          </Select>
        </div>
      </CollapsibleFilters>

      {isLoading && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-muted-foreground">Đang tải…</p>
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <EmptyState
          icon={<IconSearch className="h-10 w-10" />}
          title={q || visibility ? "Không có dòng họ nào khớp" : "Chưa có dòng họ nào"}
          description={q || visibility ? "Thử bỏ bớt bộ lọc hoặc từ khoá." : undefined}
        />
      )}

      {filtered.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {paging.paged.map((c) => (
            <ClanRow key={c.id} clan={c} onOpen={() => setPanel({ mode: "view", clan: c })} />
          ))}
        </ul>
      )}

      {filtered.length > 0 && (
        <Pagination
          page={paging.page}
          totalPages={paging.totalPages}
          total={paging.total}
          pageSize={paging.pageSize}
          unit="dòng họ"
          onPageChange={paging.setPage}
          pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
          onPageSizeChange={paging.setPageSize}
        />
      )}

      <SidePanel
        open={panel !== null}
        title={panel?.mode === "edit" ? "Sửa hạn mức dòng họ" : "Dòng họ"}
        subtitle={panel?.clan.name}
        onClose={closePanel}
        guard={panel?.mode === "edit"}
      >
        {panel && (
          <ClanForm
            key={`${panel.mode}-${panel.clan.id}`}
            clan={panel.clan}
            readOnly={panel.mode === "view"}
            onEdit={() => setPanel({ mode: "edit", clan: panel.clan })}
            onCancel={() =>
              setPanel(panel.mode === "edit" ? { mode: "view", clan: panel.clan } : null)
            }
            onSaved={() => {
              closePanel();
              qc.invalidateQueries({ queryKey: queryKeys.adminClans() });
            }}
          />
        )}
      </SidePanel>
    </div>
  );
}

/** Số → ô nhập. `null` (chưa đặt) và `undefined` (dữ liệu cũ) đều thành rỗng. */
function asText(v: number | null | undefined): string {
  return v === null || v === undefined ? "" : String(v);
}

function ClanRow({ clan, onOpen }: { clan: AdminClanRow; onOpen: () => void }) {
  const isPublic = clan.visibility === "public";
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-stretch gap-3 p-3 text-left transition-colors hover:bg-muted/40"
      >
        <IconTile icon={IconBuildings} tone={isPublic ? "info" : "neutral"} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{clan.name}</p>
          {clan.description && (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{clan.description}</p>
          )}
          <RecordDates
            createdAt={clan.created_at}
            updatedAt={clan.updated_at}
            className="mt-0.5 truncate text-xs text-muted-foreground/80"
          />
          <div className="mt-2 flex flex-wrap justify-end gap-1.5">
            <Chip tone={isPublic ? "info" : "neutral"} icon={isPublic ? <IconGlobe /> : <IconLock />}>
              {isPublic ? "Công khai" : "Riêng tư"}
            </Chip>
            <Chip tone="success" icon={<IconUsers />}>
              {clan.person_count} người
            </Chip>
          </div>
        </div>
      </button>
    </li>
  );
}

function ClanForm({
  clan,
  readOnly,
  onEdit,
  onCancel,
  onSaved,
}: {
  clan: AdminClanRow;
  readOnly: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [maxPersons, setMaxPersons] = useState(String(clan.max_persons));
  const [maxUsers, setMaxUsers] = useState(String(clan.max_users));
  // Rỗng = dùng mức chung của nền tảng. Giữ dạng chuỗi để phân biệt được
  // "rỗng" với "0" — 0 là một mức thật ("khoá hẳn"), không phải bỏ trống.
  //
  // Phải dùng `?? ""` chứ KHÔNG phải so `=== null`: bản ghi cũ còn trong
  // cache của react-query (từ lần deploy trước, khi cột này chưa tồn
  // tại) mang giá trị `undefined`, mà `String(undefined)` ra chuỗi
  // "undefined" — trình duyệt ném đúng lỗi
  // «The specified value "undefined" cannot be parsed» cho input số.
  const [aiDaily, setAiDaily] = useState(asText(clan.ai_daily_limit));
  const [aiMonthly, setAiMonthly] = useState(asText(clan.ai_monthly_limit));
  const asLimit = (v: string) => (v.trim() === "" ? null : Number(v));

  const changed =
    String(clan.max_persons) !== maxPersons ||
    String(clan.max_users) !== maxUsers ||
    asText(clan.ai_daily_limit) !== aiDaily ||
    asText(clan.ai_monthly_limit) !== aiMonthly;

  const m = useMutation({
    mutationFn: () =>
      updateClanLimits(clan.id, {
        max_persons: Number(maxPersons),
        max_users: Number(maxUsers),
        ai_daily_limit: asLimit(aiDaily),
        ai_monthly_limit: asLimit(aiMonthly),
      }),
    onSuccess: () => {
      toast.success("Đã cập nhật giới hạn dòng họ");
      onSaved();
    },
    onError: (e) => toast.error("Không lưu được", { description: (e as Error).message }),
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (changed) m.mutate();
      }}
    >
      <ReadOnlyFieldset readOnly={readOnly}>
        <div className="space-y-1.5">
          <Label htmlFor="c-name">Tên dòng họ</Label>
          <Input id="c-name" icon={<IconBuildings />} value={clan.name} readOnly />
          <Link to={`/clans/${clan.id}`} className="inline-block text-sm text-primary hover:underline">
            Mở dòng họ →
          </Link>
        </div>
        {clan.description && (
          <div className="space-y-1.5">
            <Label htmlFor="c-desc">Mô tả</Label>
            <Textarea id="c-desc" value={clan.description} readOnly />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="mp">Giới hạn người</Label>
            <Input
              id="mp"
              icon={<IconUsers />}
              type="number"
              min={1}
              value={maxPersons}
              onChange={(e) => setMaxPersons(e.target.value)}
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="mu">Giới hạn tài khoản</Label>
            <Input
              id="mu"
              icon={<IconUser />}
              type="number"
              min={1}
              value={maxUsers}
              onChange={(e) => setMaxUsers(e.target.value)}
            />
          </div>
        </div>
        {/* Hai ô AI để trống = dùng mức chung của nền tảng (sửa ở Cài đặt › Trợ lý AI);
            0 = khoá hẳn. */}
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="ad">Lượt AI / ngày</Label>
            <Input
              id="ad"
              icon={<IconSparkles />}
              type="number"
              min={0}
              placeholder="mặc định"
              value={aiDaily}
              onChange={(e) => setAiDaily(e.target.value)}
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="am">Lượt AI / tháng</Label>
            <Input
              id="am"
              icon={<IconSparkles />}
              type="number"
              min={0}
              placeholder="mặc định"
              value={aiMonthly}
              onChange={(e) => setAiMonthly(e.target.value)}
            />
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <IconScroll className="h-3.5 w-3.5 shrink-0" />
          {clan.person_count} người hiện có · để trống hai ô AI = dùng mức chung của nền tảng.
        </p>
      </ReadOnlyFieldset>

      {m.error && (
        <Alert variant="destructive">
          <AlertDescription>{(m.error as Error).message}</AlertDescription>
        </Alert>
      )}

      <ViewEditActions
        readOnly={readOnly}
        onEdit={onEdit}
        onCancel={onCancel}
        saving={m.isPending}
        canSave={changed}
      />
    </form>
  );
}
