import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { Chip } from "@/components/Chip";
import { IconArrowRight, IconGrave, IconMapPin, IconScroll, IconUsers } from "@/components/icons";
import { ProvinceMap } from "@/components/ProvinceMap";
import { SectionCard } from "@/components/SectionCard";
import { useClanContext } from "@/hooks/useClanContext";
import { isFeatureEnabled } from "@/lib/clanFeatures";
import { getClanMapStats, MAP_LAYER_LABEL, type MapLayer } from "@/lib/queries/mapStats";
import { listProvinces } from "@/lib/queries/vnDivisions";

const ICON: Record<MapLayer, React.ComponentType<{ className?: string }>> = {
  people: IconUsers,
  graves: IconGrave,
  heritage: IconScroll,
};

/**
 * Thẻ "Bản đồ" ở Tổng quan (chỉ thành viên): bản đồ thu nhỏ tô theo nơi ở của con cháu, số liệu
 * từng lớp (có khu vực / tổng) và 3 tỉnh nhiều nhất. Bấm bản đồ hoặc "Xem bản đồ" để vào trang đầy đủ.
 */
export function MapOverviewCard({ clanId }: { clanId: string }) {
  const { clan } = useClanContext();
  const navigate = useNavigate();
  const full = `/clans/${clanId}/map`;

  const { data: stats } = useQuery({
    queryKey: ["clan-map-stats", clanId, true],
    queryFn: () => getClanMapStats(clanId, true),
    staleTime: 60_000,
  });
  const { data: provinces = [] } = useQuery({
    queryKey: ["vn-provinces"],
    queryFn: () => listProvinces(),
    staleTime: 60 * 60_000,
  });

  const layers = (Object.keys(MAP_LAYER_LABEL) as MapLayer[]).filter(
    (l) =>
      (l !== "graves" || isFeatureEnabled(clan.disabled_features, "graves")) &&
      (l !== "heritage" || isFeatureEnabled(clan.disabled_features, "heritage")),
  );
  const nameOf = (code: string) => provinces.find((p) => p.code === code)?.name ?? code;

  const people = stats?.people ?? {};
  const top = Object.entries(people)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const nothing = !!stats && layers.every((l) => (stats.total[l] ?? 0) - (stats.missing[l] ?? 0) <= 0);

  return (
    <SectionCard
      id="map"
      icon={<IconMapPin />}
      title="Bản đồ dòng họ"
      footer={
        <Link to={full} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          Xem bản đồ đầy đủ <IconArrowRight className="h-4 w-4" />
        </Link>
      }
    >
      {!stats ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : (
        <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,15rem)_1fr]">
          {/* Bản đồ thu nhỏ: bấm là vào trang bản đồ đầy đủ. */}
          <div className="mx-auto w-full max-w-[15rem]">
            <ProvinceMap
              counts={people}
              selected={null}
              onSelect={() => navigate(full)}
              unit="người"
              className="h-auto max-h-72 w-full"
            />
          </div>

          <div className="space-y-3">
            {/* Số liệu từng lớp: đã có khu vực / tổng. */}
            <div className="flex flex-wrap gap-2">
              {layers.map((l) => {
                const Ic = ICON[l];
                const total = stats.total[l] ?? 0;
                const have = Math.max(total - (stats.missing[l] ?? 0), 0);
                return (
                  <Chip key={l} tone={have > 0 ? "success" : "neutral"} icon={<Ic />}>
                    {MAP_LAYER_LABEL[l]}: {have}/{total}
                  </Chip>
                );
              })}
            </div>

            {nothing ? (
              <p className="text-sm text-muted-foreground">
                Chưa có dữ liệu khu vực. Nhập <strong>"Nơi ở hiện tại"</strong> cho từng người trong Danh bạ (hoặc chọn
                Tỉnh / Xã cho mộ phần, di sản) để con cháu hiện lên bản đồ.
              </p>
            ) : (
              <div>
                <p className="mb-1.5 text-sm font-medium">Con cháu nhiều nhất ở</p>
                <ol className="space-y-1 text-sm">
                  {top.map(([code, n], i) => (
                    <li key={code} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                        {nameOf(code)}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{n} người</span>
                    </li>
                  ))}
                  {top.length === 0 && <li className="text-muted-foreground">Chưa có.</li>}
                </ol>
              </div>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
