import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { IconGrave, IconMapPin, IconPlus, IconSearch } from "@/components/icons";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { PageHeader } from "@/components/PageHeader";
import { RecordDates } from "@/components/RecordDates";
import { SearchInput } from "@/components/SearchInput";
import { Button } from "@/components/ui/button";
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
  const navigate = useNavigate();
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
        actionsBelow
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to={`/clans/${clan.id}/graves/cemeteries`}>
                <IconMapPin className="h-4 w-4 mr-1" /> Cơ sở
              </Link>
            </Button>
            {canEdit && (
              <Button size="sm" onClick={() => navigate(`/clans/${clan.id}/graves/new`)}>
                <IconPlus className="h-4 w-4 mr-1" />
                Thêm
              </Button>
            )}
          </div>
        }
      />

      <div className="sm:flex sm:items-center sm:gap-2 space-y-2 sm:space-y-0">
        <div className="sm:flex-1 sm:min-w-[200px]">
          <SearchInput
            label="Tìm mộ phần"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên / nghĩa trang / chùa…"
          />
        </div>
        <CollapsibleFilters
          activeCount={(kind ? 1 : 0) + (cemeteryId ? 1 : 0)}
        >
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            aria-label="Lọc theo hình thức"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[160px]"
          >
            <option value="">Mọi hình thức</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {RESTING_PLACE_KIND_LABEL[k]}
              </option>
            ))}
          </select>
          {(cemeteries ?? []).length > 0 && (
            <select
              value={cemeteryId}
              onChange={(e) => setCemeteryId(e.target.value)}
              aria-label="Lọc theo cơ sở"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[160px]"
            >
              <option value="">Mọi cơ sở</option>
              {(cemeteries ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
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
              ? { label: "Thêm", to: `/clans/${clan.id}/graves/new`, icon: <IconPlus className="h-4 w-4 mr-1.5" /> }
              : undefined
          }
        />
      )}

      {places && places.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {places.map((p) => {
            const thumb = p.first_photo_path ? photoUrls?.get(p.first_photo_path) : null;
            const dir = directionsUrl(p.latitude, p.longitude);
            return (
              <li key={p.id}>
                <Link
                  to={`/clans/${clan.id}/graves/${p.id}`}
                  className="flex gap-3 rounded-lg border bg-card p-3 hover:border-primary transition-colors h-full"
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
