import { lazyAs } from "@/lib/i18n/lazy";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { Breadcrumb } from "@/components/Breadcrumb";
import { Chip } from "@/components/Chip";
import { EmptyState } from "@/components/EmptyState";
import {
  IconGrave,
  IconMapPin,
  IconScroll,
  IconUsers,
} from "@/components/icons";
import { IconTile } from "@/components/IconTile";
import { usePanel } from "@/components/panel/usePanel";
import { SidePanel } from "@/components/SidePanel";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { ProvinceMap, type MapMarker } from "@/components/ProvinceMap";
import { SectionCard } from "@/components/SectionCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  SegmentedButton,
  SegmentedControl,
} from "@/components/ui/segmented-control";
import { useClanContext } from "@/hooks/useClanContext";
import { isFeatureEnabled } from "@/lib/clanFeatures";
import { lonLatToXY } from "@/lib/vnMapProject";
import { VN_MAP_PROVINCES } from "@/lib/vnMapPaths";
import {
  HERITAGE_CATEGORY_LABEL,
  listHeritageItems,
} from "@/lib/queries/heritage";
import { listPeopleInProvince } from "@/lib/queries/personAddresses";
import {
  listRestingPlaces,
  RESTING_PLACE_KIND_LABEL,
} from "@/lib/queries/restingPlaces";
import { VN_WARD_KIND_LABEL, type VnWardKind } from "@/lib/queries/vnDivisions";
import {
  getClanMapStats,
  MAP_LAYER_LABEL,
  type MapLayer,
} from "@/lib/queries/mapStats";
import {
  listProvinces,
  VN_REGION_LABEL,
  type VnRegion,
} from "@/lib/queries/vnDivisions";

import { t } from "@lingui/core/macro";
import { msg } from "@lingui/core/macro";
import { lazyMessages } from "@/lib/i18n/lazy";
import { Trans } from "@lingui/react/macro";
const LAYER_UNIT: Record<MapLayer, string> = lazyMessages({
  people: msg`người`,
  graves: msg`nơi an nghỉ`,
  heritage: msg`mục di sản`,
}) as Record<MapLayer, string>;
const LAYER_ICON: Record<
  MapLayer,
  React.ComponentType<{ className?: string }>
> = {
  people: IconUsers,
  graves: IconGrave,
  heritage: IconScroll,
};
const MISSING_HINT: Record<MapLayer, string> = lazyAs<Record<MapLayer, string>>({
  people: msg`Mở Danh bạ → chọn người → "Sửa" và nhập thẻ "Nơi ở hiện tại".`,
  graves:
    msg`Mở Mộ phần & tro cốt → sửa từng nơi và chọn Tỉnh / Xã ở mục Khu vực.`,
  heritage:
    msg`Mở Di sản dòng họ → sửa mục kiểu nơi chốn và chọn Tỉnh / Xã ở mục Khu vực.`,
});

/**
 * Bản đồ dòng họ: số người / mộ phần / di sản theo tỉnh. Chỉ thành viên dòng họ xem được (hàm
 * `clan_map_stats` tự chặn người ngoài). Chỉ hiện số đếm theo tỉnh — không tên, không địa chỉ chi tiết.
 */
export default function MapStats() {
  const { clan } = useClanContext();
  const [layer, setLayer] = useState<MapLayer>("people");
  const [includeDeceased, setIncludeDeceased] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const layers = (Object.keys(MAP_LAYER_LABEL) as MapLayer[]).filter(
    (l) =>
      (l !== "graves" || isFeatureEnabled(clan.disabled_features, "graves")) &&
      (l !== "heritage" ||
        isFeatureEnabled(clan.disabled_features, "heritage")),
  );

  const statsQ = useQuery({
    queryKey: ["clan-map-stats", clan.id, includeDeceased],
    queryFn: () => getClanMapStats(clan.id, includeDeceased),
    staleTime: 30_000,
  });
  const { data: provinces = [] } = useQuery({
    queryKey: ["vn-provinces"],
    queryFn: () => listProvinces(),
    staleTime: 60 * 60_000,
  });

  const { open: openPanel } = usePanel();
  const peopleInQ = useQuery({
    queryKey: ["map-people", clan.id, selected, includeDeceased],
    queryFn: () => listPeopleInProvince(clan.id, selected!, includeDeceased),
    enabled: layer === "people" && !!selected,
    staleTime: 30_000,
  });

  // Mộ phần / di sản có GPS → ghim đúng vị trí; chưa có GPS nhưng có tỉnh → ghim ở tâm tỉnh (màu xám).
  const gravesQ = useQuery({
    queryKey: ["map-graves", clan.id],
    queryFn: () => listRestingPlaces(clan.id),
    enabled: layer === "graves",
    staleTime: 30_000,
  });
  const heritageQ = useQuery({
    queryKey: ["map-heritage", clan.id],
    queryFn: () => listHeritageItems(clan.id),
    enabled: layer === "heritage",
    staleTime: 30_000,
  });

  const counts = statsQ.data?.[layer] ?? {};
  const total = statsQ.data?.total[layer] ?? 0;
  const missing = statsQ.data?.missing[layer] ?? 0;
  const have = Math.max(total - missing, 0);
  const nameOf = (code: string) =>
    provinces.find((p) => p.code === code)?.name ?? code;

  const top = useMemo(
    () =>
      Object.entries(counts)
        .map(([code, n]) => ({ code, n }))
        .sort((a, b) => b.n - a.n)
        .slice(0, 8),
    [counts],
  );
  const byRegion = useMemo(() => {
    const acc: Record<VnRegion, number> = { bac: 0, trung: 0, nam: 0 };
    for (const [code, n] of Object.entries(counts)) {
      const r = provinces.find((p) => p.code === code)?.region;
      if (r) acc[r] += n;
    }
    return acc;
  }, [counts, provinces]);
  const centroid = (code: string) =>
    VN_MAP_PROVINCES.find((p) => p.code === code);

  /** Mục trong tỉnh đang chọn — bấm một mục mở ngăn kéo xem chi tiết (chỉ đọc). */
  interface ListItem {
    id: string;
    title: string;
    subtitle: string;
    open: () => void;
  }
  const listItems: ListItem[] = !selected
    ? []
    : layer === "people"
      ? (peopleInQ.data ?? []).map((p) => ({
          id: p.person_id,
          title: p.full_name,
          subtitle: [
            p.ward_name
              ? `${VN_WARD_KIND_LABEL[(p.ward_kind as VnWardKind) ?? "xa"] ?? ""} ${p.ward_name}`.trim()
              : null,
            p.is_living ? null : t`đã mất`,
          ]
            .filter(Boolean)
            .join(" · "),
          open: () => openPanel("person-view", { pid: p.person_id }),
        }))
      : layer === "graves"
        ? (gravesQ.data ?? [])
            .filter((g) => g.province_code === selected)
            .map((g) => ({
              id: g.id,
              title:
                g.name || g.location_name || RESTING_PLACE_KIND_LABEL[g.kind],
              subtitle: [
                RESTING_PLACE_KIND_LABEL[g.kind],
                g.cemetery_name ?? g.location_name,
                t`${g.occupant_count} người an nghỉ`,
              ]
                .filter(Boolean)
                .join(" · "),
              open: () => openPanel("grave-view", { pid: g.id }),
            }))
        : (heritageQ.data ?? [])
            .filter((h) => h.province_code === selected)
            .map((h) => ({
              id: h.id,
              title: h.title,
              subtitle: [HERITAGE_CATEGORY_LABEL[h.category], h.location_name]
                .filter(Boolean)
                .join(" · "),
              open: () => openPanel("heritage-view", { pid: h.id }),
            }));
  const listLoading =
    layer === "people"
      ? peopleInQ.isLoading
      : layer === "graves"
        ? gravesQ.isLoading
        : heritageQ.isLoading;
  const [shown, setShown] = useState(30);
  useEffect(() => setShown(30), [selected, layer]);

  const markers = useMemo<MapMarker[]>(() => {
    if (layer === "people") {
      return Object.entries(counts)
        .filter(([, n]) => n > 0)
        .flatMap(([code, n]) => {
          const c = centroid(code);
          if (!c) return [];
          return [
            {
              id: `p-${code}`,
              x: c.cx,
              y: c.cy,
              label: t`${nameOf(code)}: ${n} người`,
              count: n,
              onClick: () => setSelected(code),
            } satisfies MapMarker,
          ];
        });
    }
    const items: {
      id: string;
      name: string;
      lat: number | null;
      lng: number | null;
      province: string | null;
    }[] =
      layer === "graves"
        ? (gravesQ.data ?? []).map((g) => ({
            id: g.id,
            name: g.name || g.location_name || t`Nơi an nghỉ`,
            lat: g.latitude,
            lng: g.longitude,
            province: g.province_code,
          }))
        : (heritageQ.data ?? []).map((h) => ({
            id: h.id,
            name: h.title,
            lat: h.latitude,
            lng: h.longitude,
            province: h.province_code,
          }));
    const exact: MapMarker[] = [];
    const approx: Record<string, number> = {};
    for (const it of items) {
      const xy =
        it.lat != null && it.lng != null ? lonLatToXY(it.lng, it.lat) : null;
      if (xy)
        exact.push({
          id: it.id,
          x: xy.x,
          y: xy.y,
          label: it.name,
          onClick: it.province ? () => setSelected(it.province) : undefined,
        });
      else if (it.province)
        approx[it.province] = (approx[it.province] ?? 0) + 1;
    }
    const approxPins = Object.entries(approx).flatMap(([code, n]) => {
      const c = centroid(code);
      return c
        ? [
            {
              id: `a-${code}`,
              x: c.cx,
              y: c.cy,
              label: t`${nameOf(code)}: ${n} ${LAYER_UNIT[layer]} (chưa có GPS)`,
              count: n,
              tone: "muted",
              onClick: () => setSelected(code),
            } satisfies MapMarker,
          ]
        : [];
    });
    return [...exact, ...approxPins];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, counts, gravesQ.data, heritageQ.data, provinces]);

  const maxTop = Math.max(1, ...top.map((t) => t.n));
  const unit = LAYER_UNIT[layer];
  const LayerIcon = LAYER_ICON[layer];

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: t`Bản đồ` },
        ]}
      />
      <PageHeader
        icon={<IconMapPin className="h-7 w-7" />}
        title={t`Bản đồ dòng họ`}
        description={t`Con cháu, mộ phần và di sản phân bố theo tỉnh/thành. Chỉ thành viên dòng họ xem được.`}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl ariaLabel={t`Lớp bản đồ`}>
          {layers.map((l) => {
            const Ic = LAYER_ICON[l];
            return (
              <SegmentedButton
                key={l}
                active={layer === l}
                onClick={() => {
                  setLayer(l);
                  setSelected(null);
                }}
                className="inline-flex items-center gap-1.5 px-3"
              >
                <Ic className="h-4 w-4" />
                {MAP_LAYER_LABEL[l]}
              </SegmentedButton>
            );
          })}
        </SegmentedControl>
        {layer === "people" && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!includeDeceased}
              onChange={(e) => setIncludeDeceased(!e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            {t`Loại trừ người đã khuất`}
          </label>
        )}
      </div>

      {statsQ.error && (
        <Alert variant="destructive">
          <AlertDescription>{(statsQ.error as Error).message}</AlertDescription>
        </Alert>
      )}
      {statsQ.isLoading && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-muted-foreground">{t`Đang tải…`}</p>
        </div>
      )}

      {statsQ.data && (
        <>
          {have === 0 && (
            <EmptyState
              icon={<LayerIcon className="h-10 w-10" />}
              title={t`Chưa có ${unit} nào có khu vực`}
              description={MISSING_HINT[layer]}
            />
          )}

          <SectionCard
            id={`map-${layer}`}
            icon={<IconMapPin />}
            title={t`Phân bố ${unit} theo tỉnh`}
            bodyClassName="p-2 sm:p-4"
          >
            <ProvinceMap
              counts={counts}
              selected={selected}
              onSelect={setSelected}
              unit={unit}
              markers={markers}
            />
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {selected ? (
                <>
                  <strong className="text-foreground">
                    {nameOf(selected)}
                  </strong>
                  : {counts[selected] ?? 0} {unit}
                </>
              ) : (
                t`Bấm một tỉnh hoặc ghim để xem số lượng.`
              )}
            </p>
            {layer !== "people" && (
              <p className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <Trans>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />{" "}
                  Ghim đỏ: vị trí GPS
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground" />{" "}
                  Ghim xám: chỉ biết tỉnh
                </span>
                </Trans>
              </p>
            )}
          </SectionCard>

          <SectionCard
            id={`map-top-${layer}`}
            icon={<LayerIcon />}
            title={t`Tỉnh có nhiều nhất`}
          >
            {top.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t`Chưa có dữ liệu.`}</p>
            ) : (
              <ol className="space-y-2">
                {top.map((t, i) => (
                  <li key={t.code}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelected(selected === t.code ? null : t.code)
                      }
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">
                          <span className="mr-2 text-muted-foreground">
                            {i + 1}.
                          </span>
                          {nameOf(t.code)}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {t.n} {unit}
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(t.n / maxTop) * 100}%` }}
                        />
                      </div>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>

          <SectionCard
            id={`map-region-${layer}`}
            icon={<IconMapPin />}
            title={t`Theo vùng miền`}
          >
            <div className="flex flex-wrap gap-2">
              {(Object.keys(VN_REGION_LABEL) as VnRegion[]).map((r) => (
                <Chip
                  key={r}
                  tone={
                    r === "bac" ? "info" : r === "trung" ? "warning" : "success"
                  }
                  icon={<IconMapPin />}
                >
                  {VN_REGION_LABEL[r]}: {byRegion[r]}
                </Chip>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            id={`map-data-${layer}`}
            icon={<LayerIcon />}
            title={t`Trạng thái dữ liệu`}
          >
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Chip tone="success" icon={<IconMapPin />}>
                  {t`Có khu vực: ${have}`}
                </Chip>
                <Chip
                  tone={missing > 0 ? "warning" : "neutral"}
                  icon={<IconMapPin />}
                >
                  {t`Thiếu khu vực: ${missing}`}
                </Chip>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${total > 0 ? (have / total) * 100 : 0}%` }}
                />
              </div>
              {missing > 0 && (
                <p className="text-sm text-muted-foreground">
                  {MISSING_HINT[layer]}
                </p>
              )}
              {layer === "people" && (
                <p className="text-xs text-muted-foreground">
                  {t`Người ở nước ngoài không được tính vào bản đồ tỉnh.`}
                </p>
              )}
            </div>
          </SectionCard>
        </>
      )}

      {/* Bấm ghim / tỉnh → danh sách các mục ở đó trong ngăn kéo (trang không bị cuộn); bấm một mục → ngăn kéo xem chi tiết. */}
      <SidePanel
        open={!!selected}
        title={selected ? nameOf(selected) : ""}
        subtitle={selected ? `${listItems.length} ${unit}` : undefined}
        onClose={() => setSelected(null)}
        guard={false}
      >
        {listLoading ? (
          <p className="py-4 text-sm text-muted-foreground">{t`Đang tải…`}</p>
        ) : listItems.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            <Trans>
            Chưa có {unit} nào ở tỉnh này.
            </Trans>
          </p>
        ) : (
          <div className="space-y-3 pb-4">
            <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
              {listItems.slice(0, shown).map((it) => (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={it.open}
                    className="flex w-full items-stretch gap-3 p-3 text-left transition-colors hover:bg-muted/40"
                  >
                    <IconTile
                      icon={LayerIcon}
                      tone={
                        layer === "people"
                          ? "primary"
                          : layer === "graves"
                            ? "violet"
                            : "warning"
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{it.title}</p>
                      {it.subtitle && (
                        <p className="truncate text-sm text-muted-foreground">
                          {it.subtitle}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {listItems.length > shown && (
              <div className="text-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShown((n) => n + 30)}
                >
                  {t`Hiện thêm (${listItems.length - shown})`}
                </Button>
              </div>
            )}
          </div>
        )}
      </SidePanel>
    </div>
  );
}
