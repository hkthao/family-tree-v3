import { PersonAvatar } from "@/components/PersonAvatar";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

  return (
    <div className="max-w-xl mx-auto p-4 space-y-3">
      {rp.photo_urls.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 gap-2">
              {rp.photo_urls.map((u, i) => (
                <img
                  key={i}
                  src={u}
                  alt=""
                  className="aspect-square w-full rounded-md object-cover"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label={t`Hình thức`} value={KIND_LABEL[rp.kind]} />
          <Row label={t`Nơi`} value={rp.location_name} />
          <Row label={t`Vị trí`} value={rp.location_detail} />
          <Row label={t`Địa chỉ`} value={rp.address} />
          <Row label={t`Trạng thái`} value={STATUS_LABEL[rp.status]} />
        </CardContent>
        {dir && (
          <CardFooter className="border-t pt-4">
            <Button size="sm" variant="outline" asChild>
              <a href={dir} target="_blank" rel="noopener noreferrer">
                <IconMapPin className="h-4 w-4 mr-1" /> {t`Chỉ đường`}
              </a>
            </Button>
          </CardFooter>
        )}
      </Card>

      {rp.occupants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Người an nghỉ ({rp.occupants.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {rp.occupants.map((o, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-md border bg-card px-3 py-2"
                >
                  <PersonAvatar gender={o.gender} photoUrl={null} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{o.full_name}</p>
                    {o.note && (
                      <p className="text-xs text-muted-foreground truncate">
                        {o.note}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 break-words">{value}</span>
    </div>
  );
}
