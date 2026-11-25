import { t } from "@lingui/core/macro";
import { Navigate, useLocation } from "react-router-dom";

import { CommunitySharePanel } from "@/components/community/CommunitySharePanel";
import { SharedHeritageCard } from "@/components/SharedHeritageCard";
import { SharedPersonCard } from "@/components/SharedPersonCard";
import { SharedRestingPlaceCard } from "@/components/SharedRestingPlaceCard";
import type { ShareViewPayload } from "@/lib/queries/share-view";
import { focusPageOf, sitePagePath } from "@/lib/siteSections";

/**
 * Nội dung của link tập trung (QR người / mộ / di sản) trong khung trang dòng họ. Địa chỉ chuẩn là `/share/:token/<mục>/<id>`
 * (xem lib/shareUrls.ts); QR đã in từ trước chỉ có `/share/:token` hoặc đường dẫn khác thì được chuyển về địa chỉ chuẩn.
 * Nội dung là các thẻ chỉ-đọc sẵn có; payload của link đã chỉ chứa đúng thứ được chia sẻ.
 */
export default function FocusPage({ data, token, base }: { data: ShareViewPayload; token?: string; base: string }) {
  const { pathname } = useLocation();
  const page = focusPageOf(data.scope)!;
  const id = data.scope === "single_person" ? data.root_person_id : data.scope === "resting_place" ? data.resting_place?.id : data.heritage_item?.id;
  const canonical = sitePagePath(base, page, id ?? undefined);
  if (id && pathname.replace(/\/+$/, "") !== canonical) return <Navigate to={canonical} replace />;

  if (data.scope === "resting_place" && data.resting_place) return <SharedRestingPlaceCard rp={data.resting_place} />;
  if (data.scope === "heritage_item" && data.heritage_item) return <SharedHeritageCard h={data.heritage_item} />;
  const focal = data.root_person_id ? data.persons.find((p) => p.id === data.root_person_id) : null;
  if (!focal) return <p className="p-8 text-center text-muted-foreground">{t`Không tìm thấy thông tin người này.`}</p>;
  return (
    <>
      <SharedPersonCard focal={focal} persons={data.persons} families={data.families} genOffset={data.generation_offset ?? 0} clanId={data.clan_id} shareToken={token} restingPlaces={data.resting_places} />
      {token && data.community?.can_contribute && !focal.is_living && (
        <CommunitySharePanel community={data.community} persons={data.persons} token={token} clanId={data.clan_id} clanName={data.clan_name ?? null} fixedPersonId={focal.id} />
      )}
    </>
  );
}
