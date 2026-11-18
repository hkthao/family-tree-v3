import { Article, ArticleHeader, ArticleProse } from "@/components/Article";
import type { ChipTone } from "@/components/Chip";
import { IconGlobe } from "@/components/icons";
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

/**
 * Ngăn kéo xem trọn một tin (Thông báo hệ thống, Cập nhật mới): bấm một dòng trong danh sách để mở. Nội dung trình bày
 * dạng bài báo (components/Article): mức độ là chuyên mục, tít, ngày đăng, rồi thân bài.
 */
export function AnnouncementPanel({
  row,
  onClose,
  heading,
}: {
  row: Announcement | null;
  onClose: () => void;
  /** Tên ngăn kéo — tít của tin đã nằm trong bài nên không lặp lại ở đầu ngăn kéo. */
  heading?: string;
}) {
  if (!row) return null;
  return (
    <SidePanel
      open
      title={heading ?? t`Thông báo`}
      onClose={onClose}
      size="lg"
      guard={false}
    >
      <div className="pb-6">
        <Article>
          <ArticleHeader
            kicker={LEVEL_LABEL[row.level]}
            title={row.title}
            meta={[
              row.published_at && (
                <time dateTime={row.published_at}>
                  {new Date(row.published_at).toLocaleDateString("vi-VN", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </time>
              ),
              row.is_public && (
                <span className="inline-flex items-center gap-1">
                  <IconGlobe className="h-3.5 w-3.5" />
                  {t`Công khai`}
                </span>
              ),
            ]}
          />
          <div className="mt-5">
            <ArticleProse>{row.body}</ArticleProse>
          </div>
        </Article>
      </div>
    </SidePanel>
  );
}
