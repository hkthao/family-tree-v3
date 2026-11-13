import { useQuery } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import type { Link } from "react-router-dom";

import { PanelLink } from "@/components/panel/PanelLink";
import { RelationshipGroup } from "@/components/RelationshipGroup";
import { IconUsers } from "@/components/icons";
import { useAuth } from "@/hooks/useAuth";
import { effectiveRole, useClanContext } from "@/hooks/useClanContext";
import { getSignedPhotoUrlMap, PHOTO_URL_STALE_MS } from "@/lib/photoUpload";
import { getPersonRelationships } from "@/lib/queries/families";
import { queryKeys } from "@/lib/queries/keys";

import { t } from "@lingui/core/macro";
/** Người thân trong ngăn kéo: bấm tên thì ngăn kéo chuyển sang xem người đó. */
function PanelPersonLink({
  personId,
  ...rest
}: ComponentProps<typeof Link> & { personId: string }) {
  return (
    <PanelLink {...rest} panel="person-view" panelParams={{ pid: personId }} />
  );
}

/**
 * Mục "Quan hệ" của ngăn kéo xem nhanh một người: cha mẹ, vợ/chồng, con cái — CHỈ ĐỌC (không
 * nút thêm / gỡ). Thêm quan hệ, gỡ liên kết, xếp thứ tự vợ cả… làm ở trang chi tiết (nút "Sửa").
 */
export function PersonRelationsQuick({
  clanId,
  personId,
}: {
  clanId: string;
  personId: string;
}) {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  // Người ngoài dòng họ công khai chỉ đọc được view đã che (giống trang chi tiết).
  const personSource =
    effectiveRole(clan) === null ? "persons_public_safe" : "persons";

  const { data: relationships } = useQuery({
    queryKey: [
      ...queryKeys.personRelationships(personId, userId),
      personSource,
    ],
    queryFn: () => getPersonRelationships(personId, undefined, personSource),
  });

  const photoPaths = relationships
    ? [
        ...relationships.parents,
        ...relationships.spouses,
        ...relationships.children,
      ]
        .map((r) => r.photo_path)
        .filter((p): p is string => !!p)
        .sort()
    : [];
  const { data: photoUrls } = useQuery({
    queryKey: ["signed-photos", photoPaths.join(",")],
    queryFn: () => getSignedPhotoUrlMap(photoPaths),
    enabled: photoPaths.length > 0,
    staleTime: PHOTO_URL_STALE_MS,
  });

  if (!relationships) return null;

  return (
    <section className="space-y-4">
      <h3 className="inline-flex items-center gap-2 text-base font-semibold">
        <IconUsers className="h-5 w-5" />
        {t`Quan hệ`}
      </h3>
      <RelationshipGroup
        LinkComponent={PanelPersonLink}
        label={t`Cha mẹ`}
        items={relationships.parents}
        clanId={clanId}
        photoUrls={photoUrls}
        emptyHint={t`Chưa nhập cha mẹ`}
      />
      <RelationshipGroup
        LinkComponent={PanelPersonLink}
        label={t`Vợ / chồng`}
        items={relationships.spouses}
        clanId={clanId}
        photoUrls={photoUrls}
        emptyHint={t`Chưa có vợ / chồng.`}
      />
      <RelationshipGroup
        LinkComponent={PanelPersonLink}
        label={t`Con cái`}
        items={relationships.children}
        clanId={clanId}
        photoUrls={photoUrls}
        emptyHint={t`Chưa có con cái.`}
      />
    </section>
  );
}
