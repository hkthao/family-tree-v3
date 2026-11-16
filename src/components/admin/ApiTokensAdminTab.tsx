import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { McpGuidePanel } from "@/components/McpGuidePanel";
import { ApiTokenCreatePanel, ApiTokenRow, ApiTokenViewPanel } from "@/components/ApiTokenPanels";
import { statusMeta, tokenStatus, type ApiTokenStatus } from "@/components/apiTokenMeta";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Fab } from "@/components/Fab";
import { IconBook, IconCheck, IconKey, IconSearch } from "@/components/icons";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { LIST_PAGE_SIZE_OPTIONS, useClientPaging } from "@/hooks/useClientPaging";
import { listAllApiTokens } from "@/lib/queries/api-tokens-admin";
import { unaccent } from "@/lib/unaccent";

import { t } from "@lingui/core/macro";

const KEY = ["admin-api-tokens"];

/** Quản trị hệ thống: tạo token cho dòng họ bất kỳ, xem và thu hồi mọi token của AI bên ngoài. */
export function ApiTokensAdminTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [guide, setGuide] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ApiTokenStatus | "">("");

  const listQ = useQuery({ queryKey: KEY, queryFn: listAllApiTokens, retry: false });

  const filtered = useMemo(() => {
    const needle = unaccent(search.trim());
    return (listQ.data ?? []).filter(
      (r) =>
        (!status || tokenStatus(r) === status) &&
        (!needle || unaccent(`${r.name} ${r.user_name} ${r.clan_name}`).includes(needle)),
    );
  }, [listQ.data, search, status]);
  const paging = useClientPaging(filtered, 20);
  const open = (listQ.data ?? []).find((r) => r.id === openId) ?? null;

  if (listQ.error) return <ErrorState error={listQ.error} />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setGuide(true)}>
          <IconBook className="mr-1.5 h-4 w-4" />
          {t`Hướng dẫn kết nối`}
        </Button>
      </div>
      <Fab onClick={() => setCreating(true)} label={t`Token mới`} />

      <CollapsibleFilters
        activeCount={status ? 1 : 0}
        onReset={() => {
          setStatus("");
          paging.patchAndResetPage({});
        }}
        title={t`Lọc token`}
        search={(toggle) => (
          <SearchInput
            label={t`Tìm token`}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              paging.patchAndResetPage({});
            }}
            placeholder={t`Tìm theo tên token, người tạo, dòng họ…`}
            rightSlot={toggle}
          />
        )}
      >
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ApiTokenStatus | "");
            paging.patchAndResetPage({});
          }}
          aria-label={t`Lọc theo trạng thái`}
          icon={<IconCheck />}
          className="h-11 w-full text-base"
        >
          <option value="">{t`Mọi trạng thái`}</option>
          {(["active", "revoked", "expired"] as const).map((s) => (
            <option key={s} value={s}>
              {statusMeta(s).label}
            </option>
          ))}
        </Select>
      </CollapsibleFilters>

      {listQ.isLoading && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-muted-foreground">{t`Đang tải…`}</p>
        </div>
      )}

      {!listQ.isLoading && filtered.length === 0 && (
        <EmptyState
          icon={listQ.data?.length ? <IconSearch className="h-10 w-10" /> : <IconKey className="h-10 w-10" />}
          title={listQ.data?.length ? t`Không có token nào khớp` : t`Chưa có token nào`}
          description={
            listQ.data?.length ? t`Thử bỏ bớt bộ lọc hoặc từ khoá.` : t`Bấm nút '+' để tạo token đầu tiên.`
          }
        />
      )}

      {filtered.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {paging.paged.map((tk) => (
            <ApiTokenRow
              key={tk.id}
              tk={tk}
              owner={{ user: tk.user_name, clan: tk.clan_name }}
              onOpen={() => setOpenId(tk.id)}
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
          unit="token"
          onPageChange={paging.setPage}
          pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
          onPageSizeChange={paging.setPageSize}
        />
      )}

      <McpGuidePanel open={guide} onClose={() => setGuide(false)} admin />
      <ApiTokenCreatePanel
        open={creating}
        onClose={() => setCreating(false)}
        userId={user?.id ?? ""}
        onCreated={() => void qc.invalidateQueries({ queryKey: KEY })}
      />
      <ApiTokenViewPanel
        tk={open}
        owner={open ? { user: open.user_name, clan: open.clan_name } : undefined}
        onClose={() => setOpenId(null)}
        invalidateKeys={[KEY]}
      />
    </div>
  );
}
