import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { CollapsibleCard } from "@/components/CollapsibleCard";
import { IconClock } from "@/components/icons";
import { TIMELINE_ICON_KEYS } from "@/components/timeline/TimelineIcon";
import { TimelinePoster } from "@/components/timeline/TimelinePoster";
import { yearToCanChi } from "@/lib/canChi";
import { bioTimelineRows, lifeEvents, yearOf } from "@/lib/personTimeline";
import { queryKeys } from "@/lib/queries/keys";
import { listTimelineRows } from "@/lib/queries/timeline";
import {
  buildMilestones,
  type Milestone,
  type TimelineRow,
} from "@/lib/timeline/mergeTimeline";

import { t } from "@lingui/core/macro";

const VIRT = "virt:";

/**
 * Dòng thời gian của MỘT NGƯỜI (trang chi tiết Danh bạ) — cùng kho dữ liệu, cùng poster và cùng form sửa với
 * dòng thời gian dòng họ (mốc có `person_id`). Mốc chi tiết của người thường nhiều hơn poster dòng họ; mốc nào
 * bật "hiện trên dòng thời gian dòng họ" mới lên poster dòng họ.
 *
 * Chưa có mốc nào lưu thì dòng họ lịch sử dựng tạm từ các ý "Năm …" trong tiểu sử (chỉ đọc). Luôn thêm các mốc đời
 * người tự dựng từ hồ sơ — sinh, con chào đời, cha mẹ mất, mất (`lifeEvents`) — cũng chỉ đọc.
 */
export function PersonTimelineCard({
  personId,
  clanId,
  userId,
  canEdit,
  bio,
  birthDate,
  deathDate,
  birthPlace,
  burialPlace,
  kids,
  parents,
}: {
  personId: string;
  clanId: string;
  /** Rỗng = khách chưa đăng nhập (trang xem thử công khai). */
  userId?: string;
  canEdit: boolean;
  bio?: string | null;
  birthDate?: string | null;
  deathDate?: string | null;
  /** Để dựng các mốc đời người (sinh tại…, an táng tại…). */
  birthPlace?: string | null;
  burialPlace?: string | null;
  /** Con và cha mẹ — để thêm mốc "con chào đời", "cha / mẹ mất". */
  kids?: { full_name: string; birth_date: string | null }[];
  parents?: { full_name: string; gender: "M" | "F"; death_date: string | null }[];
}) {
  const { data: rows } = useQuery({
    queryKey: queryKeys.timelineRows(clanId, userId ?? "", personId),
    queryFn: () => listTimelineRows(clanId, { personId }),
    enabled: !!personId,
  });

  const birthYear = yearOf(birthDate);
  const deathYear = yearOf(deathDate);

  const milestones: Milestone[] | null = useMemo(() => {
    if (!rows) return null;
    const virt = (
      i: number,
      year: number,
      title: string,
      era: string | null,
      sort: number,
      body: string | null = null,
    ): TimelineRow => ({
      id: `${VIRT}${i}`,
      clan_id: clanId,
      person_id: personId,
      on_clan: false,
      era,
      year,
      sort_order: sort,
      title,
      body,
      icon_key: null,
      photo_person_id: null,
      image_url: null,
      context_title: "",
      context_body: "",
      source_key: null,
    });
    const base: TimelineRow[] =
      rows.length > 0
        ? rows
        : bioTimelineRows(bio, birthYear, deathYear).map((r, i) =>
            virt(100 + i, r.year, r.body, r.era, 500),
          );
    const years = new Set(base.map((r) => r.year));
    // Mốc đời người tự dựng từ hồ sơ (sinh → con chào đời → cha mẹ mất → mất): chỉ xem, không lưu. Sinh / Mất bỏ qua
    // nếu đã có mốc thật cùng năm để khỏi trùng.
    const extra: TimelineRow[] = lifeEvents({ birthYear, deathYear, birthPlace, burialPlace, children: kids, parents })
      .filter((e) => !((e.sort === 0 || e.sort === 999) && years.has(e.year)))
      .map((e, i) => virt(10 + i, e.year, e.title, yearToCanChi(e.year), e.sort, e.body));
    return buildMilestones([...base, ...extra], TIMELINE_ICON_KEYS);
  }, [rows, bio, birthYear, deathYear, birthPlace, burialPlace, kids, parents, clanId, personId]);

  if (!milestones) return null;
  if (milestones.length === 0 && !canEdit) return null;

  return (
    <CollapsibleCard
      title={
        <>
          <IconClock className="h-5 w-5" />
          {t`Dòng thời gian`}
        </>
      }
      titleClassName="inline-flex items-center gap-2"
      contentClassName="space-y-4"
    >
      {milestones.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t`Chưa có mốc nào cho người này.`}
        </p>
      ) : (
        // Poster NGANG (như poster dòng họ): nhiều mốc thì cuộn ngang trong thẻ, không kéo dài cả trang.
        <div className="rounded-xl">
          <TimelinePoster
            clanName=""
            bare
            layout="horizontal"
            items={milestones.map((m) => ({ c: m }))}
          />
        </div>
      )}
    </CollapsibleCard>
  );
}
