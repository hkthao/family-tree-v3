import { Chip, type ChipTone } from "@/components/Chip";
import { IconBell, IconClock, IconGlobe } from "@/components/icons";
import { SidePanel } from "@/components/SidePanel";
import { LEVEL_LABEL } from "@/lib/announcementFormat";
import type {
  Announcement,
  AnnouncementLevel,
} from "@/lib/queries/announcements";

import { t } from "@lingui/core/macro";

export const ANNOUNCEMENT_TONE: Record<AnnouncementLevel, ChipTone> = {
  info: "info",
  update: "primary",
  warning: "warning",
  critical: "danger",
};

/** Ngăn kéo xem trọn một tin (Thông báo hệ thống, Cập nhật mới): bấm một dòng trong danh sách để mở. */
export function AnnouncementPanel({
  row,
  onClose,
}: {
  row: Announcement | null;
  onClose: () => void;
}) {
  if (!row) return null;
  return (
    <SidePanel open title={row.title} onClose={onClose} size="lg" guard={false}>
      <div className="space-y-4 pb-6">
        <div className="flex flex-wrap gap-1.5">
          <Chip tone={ANNOUNCEMENT_TONE[row.level]} icon={<IconBell />}>
            {LEVEL_LABEL[row.level]}
          </Chip>
          {row.published_at && (
            <Chip tone="neutral" icon={<IconClock />}>
              <time dateTime={row.published_at}>
                {new Date(row.published_at).toLocaleDateString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </time>
            </Chip>
          )}
          {row.is_public && (
            <Chip tone="primary" icon={<IconGlobe />}>
              {t`Công khai`}
            </Chip>
          )}
        </div>
        <p className="whitespace-pre-line text-base leading-relaxed">
          {row.body}
        </p>
      </div>
    </SidePanel>
  );
}
