import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Chip, type ChipTone } from "@/components/Chip";
import { IconChevronDown, IconClock, IconSparkles } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { PlatformShell } from "@/components/PlatformShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  listPublicAnnouncements,
  type Announcement,
  type AnnouncementLevel,
} from "@/lib/queries/announcements";
import { LEVEL_LABEL, previewLines } from "@/lib/announcementFormat";
import { queryKeys } from "@/lib/queries/keys";
import { markChangelogSeen } from "@/lib/whatsNew";

import { t } from "@lingui/core/macro";
/**
 * `/changelog` — public, không cần đăng nhập. Đọc các tin
 * `is_public=true`. Plan §32.9 O4: đây là single source of truth cho
 * changelog public, không maintain MD song song.
 *
 * SEO note (plan §32.9 O10): server-side render về sau để search
 * engine index "cập nhật gia phả tháng X".
 */
const LEVEL_TONE: Record<AnnouncementLevel, ChipTone> = {
  info: "info",
  update: "primary",
  warning: "warning",
  critical: "danger",
};

export default function Changelog() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.publicAnnouncements(),
    queryFn: () => listPublicAnnouncements(),
    staleTime: 60_000,
  });

  const rows = data ?? [];
  const latest = rows[0]?.published_at;
  useEffect(() => {
    markChangelogSeen(latest);
  }, [latest]);

  return (
    <PlatformShell>
      <PageHeader
        icon={<IconSparkles className="h-7 w-7" />}
        title={t`Cập nhật mới`}
        description={t`Tổng hợp tính năng, sửa lỗi, thông báo bảo trì của app.`}
      />

      {isLoading && <p className="text-muted-foreground">{t`Đang tải…`}</p>}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}
      {!isLoading && rows.length === 0 && (
        <p className="text-muted-foreground italic">
          {t`Chưa có cập nhật nào được công bố. Quay lại sau.`}
        </p>
      )}

      <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        {rows.map((row, i) => (
          <ChangelogEntry key={row.id} row={row} defaultOpen={i === 0} />
        ))}
      </ul>
    </PlatformShell>
  );
}

/**
 * Một mục changelog: thu gọn thì chỉ thấy tiêu đề + vài ý đầu (mỗi ý một dòng), bấm để mở toàn bộ. Mục mới nhất
 * mở sẵn; các mục cũ gập để trang không dài hàng chục màn hình.
 */
function ChangelogEntry({
  row,
  defaultOpen,
}: {
  row: Announcement;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const tone = LEVEL_TONE[row.level];
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-stretch gap-3 p-3 text-left transition-colors hover:bg-muted/40"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2">
            <span className="min-w-0 flex-1 font-semibold leading-snug">
              {row.title}
            </span>
            <IconChevronDown
              className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          </span>
          {open ? (
            <span className="mt-1 block whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {row.body}
            </span>
          ) : (
            <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
              {previewLines(row.body, 3).map((line, i) => (
                <span key={i} className="block truncate">
                  {line}
                </span>
              ))}
            </span>
          )}
          <span className="mt-2 flex flex-wrap justify-end gap-1.5">
            <Chip tone={tone}>{LEVEL_LABEL[row.level]}</Chip>
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
          </span>
        </span>
      </button>
    </li>
  );
}
