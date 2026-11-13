import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Chip } from "@/components/Chip";
import { IconUser } from "@/components/icons";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { queryKeys } from "@/lib/queries/keys";
import { listClanMembers } from "@/lib/queries/members";
import type { PersonForTree } from "@/lib/queries/tree";

import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
/**
 * Thẻ "Hồ sơ của tôi" ở Tổng quan — lối vào để người trẻ "nhận" vị trí của mình
 * trên cây rồi tự cập nhật hồ sơ (qua luồng Đóng góp, quản trị duyệt).
 *
 * - Chưa nhận vị trí: mời chọn "Tôi là ai" (đã có ở chế độ Trực hệ của Cây).
 * - Đã nhận: hiện tên, đời, trạng thái xác nhận và những gì còn thiếu (ảnh, ngày
 *   sinh), kèm nút tới trang cá nhân để cập nhật.
 */
export function MyProfileCard({
  clanId,
  userId,
  persons,
}: {
  clanId: string;
  userId: string;
  persons: PersonForTree[] | undefined;
}) {
  const { data: members } = useQuery({
    queryKey: queryKeys.clanMembers(clanId, userId),
    queryFn: () => listClanMembers(clanId),
    enabled: !!userId,
  });
  if (!members) return null;
  const mine = members.find((m) => m.user_id === userId);
  if (!mine) return null;

  const lineageTo = `/clans/${clanId}/tree?view=lineage`;

  if (!mine.self_person_id) {
    return (
      <SectionCard
        id="my-profile"
        icon={<IconUser />}
        title={t`Hồ sơ của tôi`}
        footer={
          <Link
            to={lineageTo}
            className="shrink-0 text-sm text-primary hover:underline"
          >
            {t`Chọn vị trí của tôi trên cây →`}
          </Link>
        }
      >
        <p className="text-sm">
          <Trans>
          <strong>Bạn là ai trong dòng họ?</strong> Chọn vị trí của mình
          trên cây để xem đường trực hệ từ thuỷ tổ xuống bạn và tự cập nhật ảnh,
          ngày sinh, tiểu sử của mình.
          </Trans>
        </p>
      </SectionCard>
    );
  }

  const me = persons?.find((p) => p.id === mine.self_person_id);
  const missing: string[] = [];
  if (me && !me.photo_path) missing.push(t`ảnh đại diện`);
  if (me && !me.birth_date) missing.push(t`ngày sinh`);

  return (
    <SectionCard
      id="my-profile"
      icon={<IconUser />}
      title={t`Hồ sơ của tôi`}
      action={
        mine.self_person_verified ? (
          <Chip tone="success">{t`Đã xác nhận`}</Chip>
        ) : (
          <Chip tone="warning">{t`Chờ quản trị xác nhận`}</Chip>
        )
      }
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to={lineageTo}>{t`Đường trực hệ của tôi`}</Link>
          </Button>
          <Button asChild size="sm">
            <Link
              to={`/clans/${clanId}/people/${mine.self_person_id}`}
            >{t`Cập nhật hồ sơ của tôi`}</Link>
          </Button>
        </div>
      }
    >
      <p className="text-sm">
        {t`Bạn là`}{" "}
        <strong>{me?.full_name ?? mine.self_person_full_name ?? "—"}</strong>
        {me?.generation ? <> · đời {me.generation}</> : null}.
      </p>
      {missing.length > 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          <Trans>
          Hồ sơ của bạn còn thiếu {missing.join(", ")}. Bổ sung để người thân dễ
          nhận ra bạn; thông tin sẽ được quản trị duyệt trước khi hiện lên cây.
          </Trans>
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          <Trans>
            <Trans>
              <Trans>
                Hồ sơ của bạn đã đủ ảnh và ngày sinh. Có gì thay đổi (em bé mới
                chào đời, đổi nơi ở…) bạn cứ cập nhật, quản trị sẽ duyệt.
              </Trans>
            </Trans>
          </Trans>
        </p>
      )}
    </SectionCard>
  );
}
