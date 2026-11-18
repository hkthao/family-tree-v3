import { PersonAvatar } from "@/components/PersonAvatar";
import {
  Article,
  ArticleFactBox,
  ArticleFigure,
  ArticleHeader,
  ArticleList,
  ArticleSection,
} from "@/components/Article";
import { Button } from "@/components/ui/button";
import { IconMapPin } from "@/components/icons";
import type { ShareViewRestingPlaceFull } from "@/lib/queries/share-view";

import { t } from "@lingui/core/macro";
import { msg } from "@lingui/core/macro";
import { lazyMessages } from "@/lib/i18n/lazy";
const KIND_LABEL: Record<ShareViewRestingPlaceFull["kind"], string> =
  lazyMessages({
    grave: msg`Mộ / chôn cất`,
    ashes_temple: msg`Gửi tro cốt ở chùa`,
    columbarium: msg`Nhà lưu tro / tháp cốt`,
    scattered: msg`Rải tro`,
    other: msg`Khác`,
  }) as Record<ShareViewRestingPlaceFull["kind"], string>;
const STATUS_LABEL: Record<ShareViewRestingPlaceFull["status"], string> =
  lazyMessages({
    existing: msg`Hiện hữu`,
    relocated: msg`Đã cải táng`,
    lost: msg`Thất lạc`,
  }) as Record<ShareViewRestingPlaceFull["status"], string>;

/** Public read-only card for /share/:token when scope='resting_place' (QR tại mộ). */
export function SharedRestingPlaceCard({
  rp,
}: {
  rp: ShareViewRestingPlaceFull;
}) {
  const dir =
    rp.latitude != null && rp.longitude != null
      ? `https://www.google.com/maps?q=${rp.latitude},${rp.longitude}`
      : null;
  const title = rp.name || rp.location_name || KIND_LABEL[rp.kind];

  const names = rp.occupants.map((o) => o.full_name);

  // Dạng bài báo — cùng khuôn với ngăn kéo xem nơi an nghỉ trong app (components/Article).
  return (
    <div className="mx-auto max-w-xl p-4 pb-[calc(1.5rem_+_env(safe-area-inset-bottom))]">
      <Article>
        <ArticleHeader
          kicker={KIND_LABEL[rp.kind]}
          title={title}
          deck={
            names.length > 0
              ? t`Nơi an nghỉ của ${names.join(", ")}.`
              : undefined
          }
          meta={[STATUS_LABEL[rp.status]]}
        />

        {rp.photo_urls[0] && (
          <ArticleFigure src={rp.photo_urls[0]} alt={title} />
        )}

        <ArticleFactBox
          title={t`Thông tin`}
          rows={[
            { label: t`Hình thức`, value: KIND_LABEL[rp.kind] },
            { label: t`Nơi`, value: rp.location_name },
            { label: t`Vị trí`, value: rp.location_detail },
            { label: t`Địa chỉ`, value: rp.address },
            { label: t`Trạng thái`, value: STATUS_LABEL[rp.status] },
          ]}
          footer={
            dir && (
              <Button size="sm" variant="outline" asChild>
                <a href={dir} target="_blank" rel="noopener noreferrer">
                  <IconMapPin className="h-4 w-4 mr-1" /> {t`Chỉ đường`}
                </a>
              </Button>
            )
          }
        />

        {rp.occupants.length > 0 && (
          <ArticleSection title={t`Người an nghỉ`} aside={rp.occupants.length}>
            <ArticleList>
              {rp.occupants.map((o, i) => (
                <li key={i} className="flex items-center gap-3 py-2.5">
                  <PersonAvatar gender={o.gender} photoUrl={null} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{o.full_name}</p>
                    {o.note && (
                      <p className="truncate text-sm text-muted-foreground">
                        {o.note}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ArticleList>
          </ArticleSection>
        )}

        {rp.photo_urls.length > 1 && (
          <ArticleSection title={t`Hình ảnh`} aside={rp.photo_urls.length}>
            <div className="grid grid-cols-3 gap-2">
              {rp.photo_urls.map((u, i) => (
                <img
                  key={i}
                  src={u}
                  alt=""
                  loading="lazy"
                  className="aspect-square w-full rounded-md object-cover"
                />
              ))}
            </div>
          </ArticleSection>
        )}
      </Article>
    </div>
  );
}
