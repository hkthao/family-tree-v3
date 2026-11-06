import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Breadcrumb } from "@/components/Breadcrumb";
import { Chip } from "@/components/Chip";
import { EmptyState } from "@/components/EmptyState";
import { IconGrave, IconMapPin, IconScroll, IconUsers } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { ProvinceMap } from "@/components/ProvinceMap";
import { SectionCard } from "@/components/SectionCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SegmentedButton, SegmentedControl } from "@/components/ui/segmented-control";
import { useClanContext } from "@/hooks/useClanContext";
import { isFeatureEnabled } from "@/lib/clanFeatures";
import { getClanMapStats, MAP_LAYER_LABEL, type MapLayer } from "@/lib/queries/mapStats";
import { listProvinces, VN_REGION_LABEL, type VnRegion } from "@/lib/queries/vnDivisions";

const LAYER_UNIT: Record<MapLayer, string> = { people: "người", graves: "nơi an nghỉ", heritage: "mục di sản" };
const LAYER_ICON: Record<MapLayer, React.ComponentType<{ className?: string }>> = {
  people: IconUsers,
  graves: IconGrave,
  heritage: IconScroll,
};
const MISSING_HINT: Record<MapLayer, string> = {
  people: 'Mở Danh bạ → chọn người → "Sửa" và nhập thẻ "Nơi ở hiện tại".',
  graves: "Mở Mộ phần & tro cốt → sửa từng nơi và chọn Tỉnh / Xã ở mục Khu vực.",
  heritage: "Mở Di sản dòng họ → sửa mục kiểu nơi chốn và chọn Tỉnh / Xã ở mục Khu vực.",
};

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
      (l !== "heritage" || isFeatureEnabled(clan.disabled_features, "heritage")),
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

  const counts = statsQ.data?.[layer] ?? {};
  const total = statsQ.data?.total[layer] ?? 0;
  const missing = statsQ.data?.missing[layer] ?? 0;
  const have = Math.max(total - missing, 0);
  const nameOf = (code: string) => provinces.find((p) => p.code === code)?.name ?? code;

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
  const maxTop = Math.max(1, ...top.map((t) => t.n));
  const unit = LAYER_UNIT[layer];
  const LayerIcon = LAYER_ICON[layer];

  return (
    <div className="space-y-3">
      <Breadcrumb items={[{ label: clan.name, to: `/clans/${clan.id}` }, { label: "Bản đồ" }]} />
      <PageHeader
        icon={<IconMapPin className="h-7 w-7" />}
        title="Bản đồ dòng họ"
        description="Con cháu, mộ phần và di sản phân bố theo tỉnh/thành. Chỉ thành viên dòng họ xem được."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl ariaLabel="Lớp bản đồ">
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
            Loại trừ người đã khuất
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
          <p className="text-muted-foreground">Đang tải…</p>
        </div>
      )}

      {statsQ.data && (
        <>
          {have === 0 && (
            <EmptyState
              icon={<LayerIcon className="h-10 w-10" />}
              title={`Chưa có ${unit} nào có khu vực`}
              description={MISSING_HINT[layer]}
            />
          )}

          <SectionCard id={`map-${layer}`} icon={<IconMapPin />} title={`Phân bố ${unit} theo tỉnh`} bodyClassName="p-2 sm:p-4">
            <ProvinceMap counts={counts} selected={selected} onSelect={setSelected} unit={unit} />
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {selected ? (
                <>
                  <strong className="text-foreground">{nameOf(selected)}</strong>: {counts[selected] ?? 0} {unit}
                </>
              ) : (
                "Bấm một tỉnh để xem số lượng."
              )}
            </p>
          </SectionCard>

          <SectionCard id={`map-top-${layer}`} icon={<LayerIcon />} title="Tỉnh có nhiều nhất">
            {top.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>
            ) : (
              <ol className="space-y-2">
                {top.map((t, i) => (
                  <li key={t.code}>
                    <button
                      type="button"
                      onClick={() => setSelected(selected === t.code ? null : t.code)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">
                          <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                          {nameOf(t.code)}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {t.n} {unit}
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${(t.n / maxTop) * 100}%` }} />
                      </div>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>

          <SectionCard id={`map-region-${layer}`} icon={<IconMapPin />} title="Theo vùng miền">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(VN_REGION_LABEL) as VnRegion[]).map((r) => (
                <Chip key={r} tone={r === "bac" ? "info" : r === "trung" ? "warning" : "success"} icon={<IconMapPin />}>
                  {VN_REGION_LABEL[r]}: {byRegion[r]}
                </Chip>
              ))}
            </div>
          </SectionCard>

          <SectionCard id={`map-data-${layer}`} icon={<LayerIcon />} title="Trạng thái dữ liệu">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Chip tone="success" icon={<IconMapPin />}>
                  Có khu vực: {have}
                </Chip>
                <Chip tone={missing > 0 ? "warning" : "neutral"} icon={<IconMapPin />}>
                  Thiếu khu vực: {missing}
                </Chip>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${total > 0 ? (have / total) * 100 : 0}%` }}
                />
              </div>
              {missing > 0 && <p className="text-sm text-muted-foreground">{MISSING_HINT[layer]}</p>}
              {layer === "people" && (
                <p className="text-xs text-muted-foreground">
                  Người ở nước ngoài không được tính vào bản đồ tỉnh.
                </p>
              )}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
