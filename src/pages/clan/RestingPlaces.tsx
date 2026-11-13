import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { FabGroup } from "@/components/FabGroup";
import { Breadcrumb } from "@/components/Breadcrumb";
import { CHIP_TONE_CLASS, Chip } from "@/components/Chip";
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
import { getSignedPhotoUrlMap, PHOTO_URL_STALE_MS } from "@/lib/photoUpload";
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
  });

  const { data: photoUrls } = useQuery({
    queryKey: [
      "resting-place-thumbs",
      (places ?? []).map((p) => p.first_photo_path).join(","),
    ],
    queryFn: () =>
      getSignedPhotoUrlMap(
        (places ?? [])
          .map((p) => p.first_photo_path)
          .filter((p): p is string => !!p),
      ),
    enabled: !!places && places.some((p) => p.first_photo_path),
    staleTime: PHOTO_URL_STALE_MS,
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
            <Select
              value={kind}
              onChange={(e) => patchAndResetPage({ kind: e.target.value })}
              aria-label={t`Lọc theo hình thức`}
              icon={<IconGrave />}
              className="h-11 w-full text-base"
            >
              <option value="">{t`Mọi hình thức`}</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {RESTING_PLACE_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
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
            const thumb = p.first_photo_path
              ? photoUrls?.get(p.first_photo_path)
              : null;
            const dir = directionsUrl(p.latitude, p.longitude);
            return (
              <li key={p.id}>
                <PanelLink
                  to={`/clans/${clan.id}/graves/${p.id}`}
                  panel="grave-view"
                  panelParams={{ pid: p.id }}
                  className="flex min-w-0 items-stretch gap-3 p-3 transition-colors hover:bg-muted/40"
                >
                  <div
                    className={`min-h-14 w-14 shrink-0 self-stretch overflow-hidden rounded-lg border grid place-items-center ${
                      thumb
                        ? "bg-muted"
                        : CHIP_TONE_CLASS[KIND_STYLE[p.kind].tone]
                    }`}
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (() => {
                        const KindIcon = KIND_STYLE[p.kind].icon;
                        return <KindIcon className="h-5 w-5" />;
                      })()
                    )}
                  </div>
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
