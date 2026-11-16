import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  ApiTokenCreatePanel,
  ApiTokenRow,
  ApiTokenViewPanel,
} from "@/components/ApiTokenPanels";
import {
  statusMeta,
  tokenStatus,
  type ApiTokenStatus,
} from "@/components/apiTokenMeta";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Fab } from "@/components/Fab";
import { IconCheck, IconKey, IconSearch } from "@/components/icons";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import {
  LIST_PAGE_SIZE_OPTIONS,
  useClientPaging,
} from "@/hooks/useClientPaging";
import { listClanApiTokens } from "@/lib/queries/api-tokens";
import { unaccent } from "@/lib/unaccent";

import { t } from "@lingui/core/macro";

/**
 * Admin dòng họ: danh sách mọi kết nối AI của MỘT dòng họ (token tạo tay và kết nối OAuth của ChatGPT/Claude…), tạo token mới,
 * xem và thu hồi. Cùng khuôn với tab admin hệ thống (docs/design-language.md → Màn hình danh sách).
 */
export function ClanApiTokensTab({ clanId }: { clanId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ApiTokenStatus | "">("");

  const KEY = ["api-tokens", clanId];
  const mine = user?.id ?? "";
  const listQ = useQuery({
    queryKey: KEY,
    queryFn: () => listClanApiTokens(clanId),
    retry: false,
  });

  const filtered = useMemo(() => {
    const needle = unaccent(search.trim());
    return (listQ.data ?? []).filter(
      (r) =>
        (!status || tokenStatus(r) === status) &&
        (!needle || unaccent(`${r.name} ${r.user_name}`).includes(needle)),
    );
  }, [listQ.data, search, status]);
  const paging = useClientPaging(filtered, 20);
  const open = (listQ.data ?? []).find((r) => r.id === openId) ?? null;

  if (listQ.error) return <ErrorState error={listQ.error} />;

  return (
    <div className="space-y-3">
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
            placeholder={t`Tìm theo tên token, người tạo…`}
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
          icon={
            listQ.data?.length ? (
              <IconSearch className="h-10 w-10" />
            ) : (
              <IconKey className="h-10 w-10" />
            )
          }
          title={
            listQ.data?.length
              ? t`Không có token nào khớp`
              : t`Chưa có token nào`
          }
          description={
            listQ.data?.length
              ? t`Thử bỏ bớt bộ lọc hoặc từ khoá.`
              : t`Bấm nút '+' để tạo token, hoặc kết nối từ ChatGPT/Claude (xem Hướng dẫn kết nối).`
          }
        />
      )}

      {filtered.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {paging.paged.map((tk) => (
            <ApiTokenRow
              key={tk.id}
              tk={tk}
              owner={{ user: tk.user_id === mine ? t`Tôi` : tk.user_name }}
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

      <ApiTokenCreatePanel
        open={creating}
        onClose={() => setCreating(false)}
        userId={mine}
        fixedClanId={clanId}
        onCreated={() => void qc.invalidateQueries({ queryKey: KEY })}
      />
      <ApiTokenViewPanel
        tk={open}
        owner={
          open
            ? { user: open.user_id === mine ? t`Tôi` : open.user_name }
            : undefined
        }
        onClose={() => setOpenId(null)}
        invalidateKeys={[KEY, ["admin-api-tokens"]]}
      />
    </div>
  );
}
