import { useState } from "react";

import { Chip } from "@/components/Chip";
import { ProvinceMap } from "@/components/ProvinceMap";
import { SectionCard } from "@/components/SectionCard";
import {
  IconArrowRight,
  IconAward,
  IconBook,
  IconGrave,
  IconMapPin,
  IconPin,
  IconPuzzle,
  IconScroll,
  IconSparkles,
  IconTree,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { HERITAGE_CATEGORY_LABEL } from "@/lib/queries/heritage";
import { HONOR_CATEGORY_LABEL } from "@/lib/queries/honor";
import { RESTING_PLACE_KIND_LABEL } from "@/lib/queries/restingPlaces";
import type {
  ShareViewPerson,
  ShareViewSections,
} from "@/lib/queries/share-view";

import { t } from "@lingui/core/macro";

const vnd = (n: number) => `${new Intl.NumberFormat("vi-VN").format(n)} đ`;
const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("vi-VN") : "";

/** Một mục có "Xem thêm" khi danh sách dài — giữ card gọn. */
function useMore<T>(rows: T[], first = 4) {
  const [all, setAll] = useState(false);
  return {
    shown: all ? rows : rows.slice(0, first),
    more: rows.length > first && !all,
    showAll: () => setAll(true),
  };
}

function MoreButton({ onClick, n }: { onClick: () => void; n: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm font-medium text-primary hover:underline"
    >
      {t`Xem thêm ${n}`}
    </button>
  );
}

/**
 * Tab "Tổng quan" của link chia sẻ: các card như trang Tổng quan trong app. Cây gia phả luôn có (mở
 * toàn khung bằng nút); các phần khác chỉ hiện khi admin bật ở Cài đặt (clans.share_sections).
 */
export function ShareOverview({
  persons,
  generationOffset,
  sections,
  onOpenTree,
}: {
  persons: ShareViewPerson[];
  generationOffset: number;
  sections: ShareViewSections;
  onOpenTree: () => void;
}) {
  const gens = persons
    .map((p) => p.generation)
    .filter((g): g is number => g != null);
  const maxGen = gens.length ? Math.max(...gens) - generationOffset : null;
  const root = persons.find((p) => p.is_root && !p.is_living);
  const info = sections.info;
  const board = useMore(sections.board ?? [], 3);
  const heritage = useMore(sections.heritage ?? []);
  const graves = useMore(sections.graves ?? []);
  const honor = useMore(sections.honor ?? [], 5);

  return (
    // Cùng bề rộng với thanh mời góp / thanh tab (max-w-6xl); màn rộng xếp 2 cột, card Cây chiếm cả hàng.
    <div className="container grid max-w-6xl grid-cols-1 items-start gap-4 py-4 lg:grid-cols-2">
      {/* Cây gia phả — luôn có; mở cây toàn khung (kéo, phóng to). */}
      <div className="lg:col-span-2">
        <SectionCard
          id="share-tree"
          icon={<IconTree />}
          title={t`Cây gia phả`}
          footer={
            <Button size="sm" className="h-9 px-3 text-sm" onClick={onOpenTree}>
              <IconTree className="mr-1.5 h-4 w-4" />
              {t`Xem cây gia phả`}
            </Button>
          }
        >
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border bg-muted/30 px-2 py-2">
              <div className="text-2xl font-bold tabular-nums text-primary">
                {persons.length}
              </div>
              <div className="text-xs text-muted-foreground">{t`người`}</div>
            </div>
            <div className="rounded-lg border bg-muted/30 px-2 py-2">
              <div className="text-2xl font-bold tabular-nums text-primary">
                {maxGen ?? "—"}
              </div>
              <div className="text-xs text-muted-foreground">{t`đời`}</div>
            </div>
            <div className="min-w-0 rounded-lg border bg-muted/30 px-2 py-2">
              <div className="truncate text-sm font-semibold">
                {root?.full_name ?? "—"}
              </div>
              <div className="text-xs text-muted-foreground">{t`thuỷ tổ`}</div>
            </div>
          </div>
        </SectionCard>
      </div>

      {info && (
        <SectionCard
          id="share-info"
          icon={<IconBook />}
          title={t`Thông tin dòng họ`}
        >
          <div className="space-y-2 text-sm">
            {info.description && (
              <p className="whitespace-pre-line leading-relaxed">
                {info.description}
              </p>
            )}
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
              {[
                [t`Quê gốc`, info.origin_place],
                [t`Từ đường`, info.ancestral_hall],
                [t`Giỗ tổ`, info.ancestor_anniversary],
                [t`Trưởng họ`, info.chief_name],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k as string} className="flex gap-2">
                    <dt className="shrink-0 text-muted-foreground">{k}:</dt>
                    <dd className="min-w-0">{v}</dd>
                  </div>
                ))}
            </dl>
          </div>
        </SectionCard>
      )}

      {sections.board && sections.board.length > 0 && (
        <SectionCard
          id="share-board"
          icon={<IconSparkles />}
          title={t`Bảng tin`}
        >
          <ul className="divide-y text-sm">
            {board.shown.map((p) => (
              <li key={p.id} className="space-y-1 py-2">
                <p className="font-medium">
                  {p.pinned && (
                    <IconPin
                      className="mr-1 inline h-3.5 w-3.5 text-primary"
                      aria-label={t`Ghim`}
                    />
                  )}
                  {p.title || p.excerpt.slice(0, 60)}
                </p>
                <p className="line-clamp-3 whitespace-pre-line text-muted-foreground">
                  {p.excerpt}
                </p>
                <p className="text-xs text-muted-foreground/80">
                  {day(p.created_at)}
                </p>
              </li>
            ))}
          </ul>
          {board.more && (
            <MoreButton
              onClick={board.showAll}
              n={(sections.board?.length ?? 0) - board.shown.length}
            />
          )}
        </SectionCard>
      )}

      {sections.map &&
        Object.keys(sections.map.people).length +
          Object.keys(sections.map.graves).length >
          0 && (
          <SectionCard
            id="share-map"
            icon={<IconMapPin />}
            title={t`Bản đồ dòng họ`}
          >
            <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,14rem)_1fr]">
              <div className="mx-auto w-full max-w-[14rem]">
                <ProvinceMap
                  counts={sections.map.people}
                  selected={null}
                  onSelect={() => {}}
                  unit={t`người`}
                  className="h-auto max-h-72 w-full"
                />
              </div>
              <div className="space-y-1.5 text-sm">
                <p className="font-medium">{t`Con cháu nhiều nhất ở`}</p>
                <ol className="space-y-1">
                  {Object.entries(sections.map.people)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([code, n], i) => (
                      <li key={code} className="flex justify-between gap-2">
                        <span className="truncate">
                          <span className="mr-2 text-muted-foreground">
                            {i + 1}.
                          </span>
                          {sections.map!.province_names[code] ?? code}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{t`${n} người`}</span>
                      </li>
                    ))}
                </ol>
              </div>
            </div>
          </SectionCard>
        )}

      {sections.heritage && sections.heritage.length > 0 && (
        <SectionCard
          id="share-heritage"
          icon={<IconScroll />}
          title={t`Di sản dòng họ`}
        >
          <ul className="divide-y text-sm">
            {heritage.shown.map((h) => (
              <li key={h.id} className="flex gap-3 py-2">
                {h.photo_url && (
                  <img
                    src={h.photo_url}
                    alt=""
                    loading="lazy"
                    className="h-14 w-14 shrink-0 rounded-lg border object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{h.title}</p>
                  {h.summary && (
                    <p className="line-clamp-2 text-muted-foreground">
                      {h.summary}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Chip tone="info" icon={<IconScroll />}>
                      {HERITAGE_CATEGORY_LABEL[
                        h.category as keyof typeof HERITAGE_CATEGORY_LABEL
                      ] ?? h.category}
                    </Chip>
                    {h.location_name && (
                      <Chip tone="neutral" icon={<IconMapPin />}>
                        {h.location_name}
                      </Chip>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {heritage.more && (
            <MoreButton
              onClick={heritage.showAll}
              n={(sections.heritage?.length ?? 0) - heritage.shown.length}
            />
          )}
        </SectionCard>
      )}

      {sections.graves && sections.graves.length > 0 && (
        <SectionCard
          id="share-graves"
          icon={<IconGrave />}
          title={t`Mộ phần & tro cốt`}
        >
          <ul className="divide-y text-sm">
            {graves.shown.map((g) => (
              <li key={g.id} className="py-2">
                <p className="font-medium">
                  {g.name ||
                    RESTING_PLACE_KIND_LABEL[
                      g.kind as keyof typeof RESTING_PLACE_KIND_LABEL
                    ] ||
                    g.kind}
                </p>
                {g.occupants.length > 0 && (
                  <p className="text-muted-foreground">
                    {g.occupants.join(", ")}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Chip tone="teal" icon={<IconGrave />}>
                    {RESTING_PLACE_KIND_LABEL[
                      g.kind as keyof typeof RESTING_PLACE_KIND_LABEL
                    ] ?? g.kind}
                  </Chip>
                  {g.location_name && (
                    <Chip tone="neutral" icon={<IconMapPin />}>
                      {g.location_name}
                    </Chip>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {graves.more && (
            <MoreButton
              onClick={graves.showAll}
              n={(sections.graves?.length ?? 0) - graves.shown.length}
            />
          )}
        </SectionCard>
      )}

      {sections.honor && sections.honor.length > 0 && (
        <SectionCard
          id="share-honor"
          icon={<IconAward />}
          title={t`Bảng vàng công đức`}
        >
          <ul className="divide-y text-sm">
            {honor.shown.map((h) => (
              <li
                key={h.id}
                className="flex items-start justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-medium">{h.honoree_name}</p>
                  {h.note && (
                    <p className="line-clamp-2 text-muted-foreground">
                      {h.note}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground/80">
                    {[
                      HONOR_CATEGORY_LABEL[
                        h.category as keyof typeof HONOR_CATEGORY_LABEL
                      ] ?? h.category,
                      day(h.occurred_on),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {h.amount ? (
                  <span className="shrink-0 font-semibold tabular-nums text-primary">
                    {vnd(h.amount)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {honor.more && (
            <MoreButton
              onClick={honor.showAll}
              n={(sections.honor?.length ?? 0) - honor.shown.length}
            />
          )}
        </SectionCard>
      )}

      {sections.mosaic && sections.mosaic.tiles.length > 0 && (
        <SectionCard
          id="share-mosaic"
          icon={<IconPuzzle />}
          title={sections.mosaic.title || t`Ảnh ghép đại gia đình`}
        >
          {sections.mosaic.description && (
            <p className="mb-2 text-sm text-muted-foreground">
              {sections.mosaic.description}
            </p>
          )}
          <div
            className="grid gap-0.5 overflow-hidden rounded-lg"
            style={{
              gridTemplateColumns: `repeat(${sections.mosaic.cols}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: sections.mosaic.slots }, (_, i) => {
              const tile = sections.mosaic!.tiles.find((x) => x.position === i);
              return tile?.photo_url ? (
                <img
                  key={i}
                  src={tile.photo_url}
                  alt={tile.caption ?? ""}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div key={i} className="aspect-square bg-muted" />
              );
            })}
          </div>
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <IconArrowRight className="h-3.5 w-3.5" />
            {t`${sections.mosaic.tiles.length} người đã góp mảnh ảnh`}
          </p>
        </SectionCard>
      )}
    </div>
  );
}
