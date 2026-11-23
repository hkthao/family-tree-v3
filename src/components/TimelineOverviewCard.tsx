import { Link } from "react-router-dom";

import { IconArrowRight, IconCalendar } from "@/components/icons";
import { SectionCard } from "@/components/SectionCard";
import { TimelinePoster } from "@/components/timeline/TimelinePoster";
import { useClanTimeline } from "@/hooks/useClanTimeline";

import { t } from "@lingui/core/macro";

/**
 * Thẻ "Dòng thời gian" ở Tổng quan: hiện CHÍNH poster ngang ĐẦY ĐỦ của dòng họ (tiêu đề, mã QR; cuộn ngang được), chỉ để xem. Bấm
 * "Xem dòng thời gian" để vào trang chi tiết (mẫu nền, mã QR, xuất PDF, thêm / sửa mốc). Chưa có mốc thì mời tạo
 * (người sửa được) hoặc báo trống.
 */
export function TimelineOverviewCard({ clanId }: { clanId: string }) {
  const { clan, milestones, isLoading, canEdit } = useClanTimeline();
  const full = `/clans/${clanId}/timeline/clan`;

  return (
    <SectionCard
      id="timeline"
      icon={<IconCalendar />}
      title={t`Dòng thời gian`}
      footer={
        <Link
          to={full}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          {milestones.length === 0 && canEdit
            ? t`Tạo dòng thời gian`
            : t`Xem dòng thời gian`}{" "}
          <IconArrowRight className="h-4 w-4" />
        </Link>
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t`Đang tải…`}</p>
      ) : milestones.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? t`Chưa có mốc nào. Kể câu chuyện dòng họ qua các thế hệ bằng một poster có sẵn mẫu, chọn là xong.`
            : t`Dòng họ chưa có mốc nào trên dòng thời gian.`}
        </p>
      ) : (
        <div>
          {/* Poster ngang ĐẦY ĐỦ của dòng họ (tiêu đề, mã QR…), cuộn ngang khi nhiều mốc; chỉ để xem. */}
          <TimelinePoster
            clanName={clan.name}
            layout="horizontal"
            qrUrl={`${window.location.origin}${full}`}
            items={milestones.map((m) => ({ c: m }))}
          />
        </div>
      )}
    </SectionCard>
  );
}
