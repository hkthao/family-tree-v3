import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { FabGroup } from "@/components/FabGroup";
import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import {
  IconBuildings,
  IconGrave,
  IconMapPin,
  IconPlus,
  IconSearch,
} from "@/components/icons";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { PageHeader } from "@/components/PageHeader";
import { RecordDates } from "@/components/RecordDates";
import { SearchInput } from "@/components/SearchInput";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { canEditClan, useClanContext } from "@/hooks/useClanContext";
import { useUrlState } from "@/hooks/useUrlState";
import { getSignedPhotoUrlMap, PHOTO_URL_STALE_MS } from "@/lib/photoUpload";
import { listCemeteries } from "@/lib/queries/cemeteries";
import {
  directionsUrl,
  listRestingPlaces,
  RESTING_PLACE_KIND_LABEL,
  type RestingPlaceKind,
} from "@/lib/queries/restingPlaces";

const KINDS = Object.keys(RESTING_PLACE_KIND_LABEL) as RestingPlaceKind[];

export default function RestingPlaces() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const canEdit = canEditClan(clan);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useUrlState("q", "");
  const [kindRaw, setKind] = useUrlState("kind", "");
  const kind = (KINDS.includes(kindRaw as RestingPlaceKind) ? kindRaw : "") as
    | RestingPlaceKind
    | "";
  const [cemeteryId, setCemeteryId] = useUrlState("cemetery", "");

  const { data: cemeteries } = useQuery({
    queryKey: ["cemeteries", clan.id, userId],
    queryFn: () => listCemeteries(clan.id),
    enabled: !!userId,
  });

  useEffect(() => setSearch(debounced), []); // seed input from URL on mount
  useEffect(() => {
    const h = setTimeout(() => {
      if (search !== debounced) setDebounced(search);
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
    queryKey: ["resting-place-thumbs", (places ?? []).map((p) => p.first_photo_path).join(",")],
    queryFn: () =>
      getSignedPhotoUrlMap(
        (places ?? []).map((p) => p.first_photo_path).filter((p): p is string => !!p),
      ),
    enabled: !!places && places.some((p) => p.first_photo_path),
    staleTime: PHOTO_URL_STALE_MS,
  });

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: "Mộ phần & tro cốt" },
        ]}
      />
      <PageHeader
        icon={<IconGrave className="h-7 w-7" />}
        title="Mộ phần & tro cốt"
        description="Nơi an nghỉ của các cụ: mộ phần, tro cốt gửi chùa / tháp họ."
      />
      <FabGroup
        label="Thêm"
        actions={[
          ...(canEdit
            ? [
                {
                  label: "Thêm mộ phần",
                  icon: <IconPlus />,
                  to: `/clans/${clan.id}/graves/new`,
                  panel: { id: "grave-new" as const },
                },
              ]
            : []),
          { label: "Quản lý cơ sở", icon: <IconMapPin />, to: `/clans/${clan.id}/graves/cemeteries` },
        ]}
      />

      <div className="space-y-2">
        <CollapsibleFilters
          activeCount={(kind ? 1 : 0) + (cemeteryId ? 1 : 0)}
          onReset={() => {
            setKind("");
            setCemeteryId("");
          }}
          search={(toggle) => (
            <SearchInput
              label="Tìm mộ phần"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên / nghĩa trang / chùa…"
              rightSlot={toggle}
            />
          )}
        >
          <div className="flex flex-col gap-3">
            <Select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              aria-label="Lọc theo hình thức"
              icon={<IconGrave />}
              className="h-11 w-full text-base"
            >
              <option value="">Mọi hình thức</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {RESTING_PLACE_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
            {(cemeteries ?? []).length > 0 && (
              <Select
                value={cemeteryId}
                onChange={(e) => setCemeteryId(e.target.value)}
                aria-label="Lọc theo cơ sở"
                icon={<IconBuildings />}
                className="h-11 w-full text-base"
              >
                <option value="">Mọi cơ sở</option>
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

      {isLoading && <p className="text-muted-foreground">Đang tải…</p>}

      {places && places.length === 0 && (
        <EmptyState
          icon={<IconSearch className="h-10 w-10" />}
          title={debounced || kind ? "Không có mục nào khớp" : "Chưa có mộ phần / tro cốt"}
          description={
            debounced || kind
              ? "Thử bỏ bớt bộ lọc."
              : canEdit
                ? "Bấm 'Thêm' để ghi nơi an nghỉ đầu tiên."
                : "Chưa có dữ liệu."
          }
          primary={
            canEdit && !debounced && !kind
              ? { label: "Thêm", to: `/clans/${clan.id}/graves/new`, panel: { id: "grave-new" as const }, icon: <IconPlus className="h-4 w-4 mr-1.5" /> }
              : undefined
          }
        />
      )}

      {places && places.length > 0 && (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {places.map((p) => {
            const thumb = p.first_photo_path ? photoUrls?.get(p.first_photo_path) : null;
            const dir = directionsUrl(p.latitude, p.longitude);
            return (
              <li key={p.id} className="min-w-0">
                <Link
                  to={`/clans/${clan.id}/graves/${p.id}`}
                  className="flex gap-3 rounded-xl border bg-card shadow-sm p-3 hover:border-primary transition-colors h-full"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted grid place-items-center">
                    {thumb ? (
                      <img src={thumb} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : (
                      <IconGrave className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {p.name || p.location_name || RESTING_PLACE_KIND_LABEL[p.kind]}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {RESTING_PLACE_KIND_LABEL[p.kind]}
                      {p.cemetery_name
                        ? ` · ${p.cemetery_name}`
                        : p.location_name
                          ? ` · ${p.location_name}`
                          : ""}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.occupant_count} người an nghỉ
                    </p>
                    {dir && (
                      <span className="inline-flex items-center gap-1 text-xs text-primary mt-1">
                        <IconMapPin className="h-3.5 w-3.5" /> có vị trí
                      </span>
                    )}
                    <RecordDates
                      createdAt={p.created_at}
                      updatedAt={p.updated_at}
                      className="text-xs text-muted-foreground/80 mt-1 truncate"
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
