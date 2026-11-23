import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { FilterableSelect } from "@/components/FilterableSelect";
import { FabGroup } from "@/components/FabGroup";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Chip } from "@/components/Chip";
import { EmptyState } from "@/components/EmptyState";
import {
  IconBuildings,
  IconGrave,
  IconMapPin,
  IconPlus,
  IconSearch,
  IconUsers,
} from "@/components/icons";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { PageHeader } from "@/components/PageHeader";
import { PanelLink } from "@/components/panel/PanelLink";
import {
  RESTING_PLACE_KIND_STYLE as KIND_STYLE,
  RESTING_PLACE_STATUS_STYLE as STATUS_STYLE,
} from "@/components/restingPlaceStyle";
import { Pagination } from "@/components/Pagination";
import { RecordDates } from "@/components/RecordDates";
import { SearchInput } from "@/components/SearchInput";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { canEditClan, useClanContext } from "@/hooks/useClanContext";
import {
  LIST_PAGE_SIZE_OPTIONS,
  useClientPaging,
} from "@/hooks/useClientPaging";
import { useUrlState } from "@/hooks/useUrlState";
import { listCemeteries } from "@/lib/queries/cemeteries";
import {
  directionsUrl,
  listRestingPlaces,
  RESTING_PLACE_KIND_LABEL,
  RESTING_PLACE_STATUS_LABEL,
  type RestingPlaceKind,
} from "@/lib/queries/restingPlaces";

import { t } from "@lingui/core/macro";
const KINDS = Object.keys(RESTING_PLACE_KIND_LABEL) as RestingPlaceKind[];

export default function RestingPlaces() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const canEdit = canEditClan(clan);

  const [search, setSearch] = useState("");
  const [debounced] = useUrlState("q", "");
  const [kindRaw] = useUrlState("kind", "");
  const kind = (KINDS.includes(kindRaw as RestingPlaceKind) ? kindRaw : "") as
    RestingPlaceKind | "";
  const [cemeteryId] = useUrlState("cemetery", "");

  const { data: cemeteries } = useQuery({
    queryKey: ["cemeteries", clan.id, userId],
    queryFn: () => listCemeteries(clan.id),
    enabled: !!userId,
  });

  useEffect(() => setSearch(debounced), []); // seed input from URL on mount
  useEffect(() => {
    const h = setTimeout(() => {
      if (search !== debounced) patchAndResetPage({ q: search });
    }, 300);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data: places, isLoading } = useQuery({
    queryKey: ["resting-places", clan.id, userId, debounced, kind, cemeteryId],
    queryFn: () =>
      listRestingPlaces(clan.id, {
        search: debounced,
        kind: kind || null,
        cemeteryId: cemeteryId || null,
      }),
    enabled: !!userId,
    // Mộ phần do người khác trong họ thêm (máy khác, nhập hàng loạt) không làm mất hiệu lực cache của máy này; staleTime 4h
    // mặc định + cache lưu trình duyệt khiến "Mọi hình thức" dính danh sách RỖNG cũ trong khi lọc theo loại (khoá mới) lại ra.
    staleTime: 0,
    refetchOnMount: "always",
  });

  const {
    page,
    totalPages,
    pageSize,
    total,
    paged,
    setPage,
    setPageSize,
    patchAndResetPage,
  } = useClientPaging(places ?? [], 20);

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: t`Mộ phần & tro cốt` },
        ]}
      />
      <PageHeader
        icon={<IconGrave className="h-7 w-7" />}
        title={t`Mộ phần & tro cốt`}
        description={t`Nơi an nghỉ của các cụ: mộ phần, tro cốt gửi chùa / tháp họ.`}
      />
      <FabGroup
        label={t`Thêm`}
        actions={[
          ...(canEdit
            ? [
                {
                  label: t`Thêm mộ phần`,
                  icon: <IconPlus />,
                  to: `/clans/${clan.id}/graves/new`,
                  panel: { id: "grave-new" as const },
                },
              ]
            : []),
          {
            label: t`Quản lý cơ sở`,
            icon: <IconMapPin />,
            to: `/clans/${clan.id}/graves/cemeteries`,
          },
        ]}
      />

      <div className="space-y-2">
        <CollapsibleFilters
          activeCount={(kind ? 1 : 0) + (cemeteryId ? 1 : 0)}
          onReset={() => patchAndResetPage({ kind: null, cemetery: null })}
          search={(toggle) => (
            <SearchInput
              label={t`Tìm mộ phần`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t`Tìm theo tên / nghĩa trang / chùa…`}
              rightSlot={toggle}
            />
          )}
        >
          <div className="flex flex-col gap-3">
            <FilterableSelect
              value={kind}
              onChange={(v) => patchAndResetPage({ kind: v })}
              aria-label={t`Lọc theo hình thức`}
              icon={<IconGrave />}
              options={KINDS.map((k) => ({
                value: k,
                label: RESTING_PLACE_KIND_LABEL[k],
              }))}
              emptyLabel={t`Mọi hình thức`}
              filterLabel={t`Lọc theo hình thức`}
              className="h-11 text-base"
            />
            {(cemeteries ?? []).length > 0 && (
              <Select
                value={cemeteryId}
                onChange={(e) =>
                  patchAndResetPage({ cemetery: e.target.value })
                }
                aria-label={t`Lọc theo cơ sở`}
                icon={<IconBuildings />}
                className="h-11 w-full text-base"
              >
                <option value="">{t`Mọi cơ sở`}</option>
                {(cemeteries ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </CollapsibleFilters>
      </div>

      {isLoading && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-muted-foreground">{t`Đang tải…`}</p>
        </div>
      )}

      {places && places.length === 0 && (
        <EmptyState
          icon={<IconSearch className="h-10 w-10" />}
          title={
            debounced || kind
              ? t`Không có mục nào khớp`
              : t`Chưa có mộ phần / tro cốt`
          }
          description={
            debounced || kind
              ? t`Thử bỏ bớt bộ lọc.`
              : canEdit
                ? t`Bấm 'Thêm' để ghi nơi an nghỉ đầu tiên.`
                : t`Chưa có dữ liệu.`
          }
          primary={
            canEdit && !debounced && !kind
              ? {
                  label: t`Thêm`,
                  to: `/clans/${clan.id}/graves/new`,
                  panel: { id: "grave-new" as const },
                  icon: <IconPlus className="h-4 w-4 mr-1.5" />,
                }
              : undefined
          }
        />
      )}

      {places && places.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {paged.map((p) => {
            const dir = directionsUrl(p.latitude, p.longitude);
            return (
              <li key={p.id}>
                <PanelLink
                  to={`/clans/${clan.id}/graves/${p.id}`}
                  panel="grave-view"
                  panelParams={{ pid: p.id }}
                  className="flex min-w-0 items-stretch gap-3 p-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {p.name ||
                        p.location_name ||
                        RESTING_PLACE_KIND_LABEL[p.kind]}
                    </p>
                    {(p.cemetery_name || p.location_name) && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <IconBuildings className="h-3.5 w-3.5 shrink-0" />
                        <span className="line-clamp-2 min-w-0">
                          {p.cemetery_name ?? p.location_name}
                        </span>
                      </p>
                    )}
                    <RecordDates
                      createdAt={p.created_at}
                      updatedAt={p.updated_at}
                      className="text-xs text-muted-foreground/80 mt-1 truncate"
                    />
                    <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                      {(() => {
                        const KindIcon = KIND_STYLE[p.kind].icon;
                        const StatusIcon = STATUS_STYLE[p.status].icon;
                        return (
                          <>
                            <Chip
                              tone={KIND_STYLE[p.kind].tone}
                              icon={<KindIcon />}
                            >
                              {RESTING_PLACE_KIND_LABEL[p.kind]}
                            </Chip>
                            <Chip
                              tone={STATUS_STYLE[p.status].tone}
                              icon={<StatusIcon />}
                            >
                              {RESTING_PLACE_STATUS_LABEL[p.status]}
                            </Chip>
                          </>
                        );
                      })()}
                      <Chip tone="success" icon={<IconUsers />}>
                        {t`${p.occupant_count} người an nghỉ`}
                      </Chip>
                      {dir && (
                        <Chip tone="info" icon={<IconMapPin />}>
                          {t`Có vị trí`}
                        </Chip>
                      )}
                    </div>
                  </div>
                </PanelLink>
              </li>
            );
          })}
        </ul>
      )}

      {places && places.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          unit={t`mục`}
          onPageChange={setPage}
          pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
          onPageSizeChange={setPageSize}
        />
      )}
    </div>
  );
}
