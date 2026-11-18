import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import {
  ANNOUNCEMENT_TONE,
  AnnouncementPanel,
} from "@/components/AnnouncementPanel";
import { Chip } from "@/components/Chip";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { EmptyState } from "@/components/EmptyState";
import { FeedRow, TONE_TEXT } from "@/components/FeedRow";
import { FilterableSelect } from "@/components/FilterableSelect";
import {
  IconClock,
  IconSearch,
  IconSparkles,
  IconTag,
} from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { PlatformShell } from "@/components/PlatformShell";
import { SearchInput } from "@/components/SearchInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LEVEL_LABEL } from "@/lib/announcementFormat";
import {
  listPublicAnnouncements,
  type Announcement,
  type AnnouncementLevel,
} from "@/lib/queries/announcements";
import { queryKeys } from "@/lib/queries/keys";
import { unaccent } from "@/lib/unaccent";
import { markChangelogSeen } from "@/lib/whatsNew";

import { t } from "@lingui/core/macro";
/**
 * `/changelog` — public, không cần đăng nhập. Đọc các tin
 * `is_public=true`. Plan §32.9 O4: đây là single source of truth cho
 * changelog public, không maintain MD song song.
 *
 * Trình bày giống ngăn kéo Thông báo: ô tìm + icon Tuỳ chọn (lọc mức độ), mỗi tin một dòng (icon thuần, vài ý đầu),
 * bấm mở ngăn kéo xem trọn tin.
 */
const LEVELS = Object.keys(LEVEL_LABEL) as AnnouncementLevel[];

export default function Changelog() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.publicAnnouncements(),
    queryFn: () => listPublicAnnouncements(),
    staleTime: 60_000,
  });

  const rows = useMemo(() => data ?? [], [data]);
  const latest = rows[0]?.published_at;
  useEffect(() => {
    markChangelogSeen(latest);
  }, [latest]);

  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("");
  const [viewing, setViewing] = useState<Announcement | null>(null);
  const filtered = useMemo(() => {
    const q = unaccent(search.trim());
    return rows.filter(
      (r) =>
        (!level || r.level === level) &&
        (!q || unaccent(`${r.title} ${r.body}`).includes(q)),
    );
  }, [rows, search, level]);
  const filtering = !!search.trim() || !!level;

  return (
    <PlatformShell>
      <PageHeader
        icon={<IconSparkles className="h-7 w-7" />}
        title={t`Cập nhật mới`}
        description={t`Tổng hợp tính năng, sửa lỗi, thông báo bảo trì của app.`}
      />

      <CollapsibleFilters
        activeCount={level ? 1 : 0}
        onReset={() => setLevel("")}
        title={t`Lọc cập nhật`}
        search={(toggle) => (
          <SearchInput
            label={t`Tìm cập nhật`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t`Tìm theo tiêu đề / nội dung…`}
            rightSlot={toggle}
          />
        )}
      >
        <FilterableSelect
          value={level}
          onChange={setLevel}
          icon={<IconTag />}
          options={LEVELS.map((l) => ({ value: l, label: LEVEL_LABEL[l] }))}
          emptyLabel={t`Mọi mức độ`}
          filterLabel={t`Lọc theo mức độ`}
          className="h-11 text-base"
        />
      </CollapsibleFilters>

      {isLoading && <p className="text-muted-foreground">{t`Đang tải…`}</p>}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}
      {!isLoading && filtered.length === 0 && (
        <EmptyState
          icon={
            filtering ? (
              <IconSearch className="h-10 w-10" />
            ) : (
              <IconSparkles className="h-10 w-10" />
            )
          }
          title={
            filtering
              ? t`Không có cập nhật nào khớp`
              : t`Chưa có cập nhật nào được công bố. Quay lại sau.`
          }
          description={
            filtering ? t`Thử bỏ bớt bộ lọc hoặc từ khoá.` : undefined
          }
        />
      )}

      {filtered.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {filtered.map((row) => (
            <FeedRow
              key={row.id}
              icon={IconSparkles}
              iconClass={TONE_TEXT[ANNOUNCEMENT_TONE[row.level]]}
              title={row.title}
              body={row.body}
              onClick={() => setViewing(row)}
              chips={
                <>
                  <Chip tone={ANNOUNCEMENT_TONE[row.level]}>
                    {LEVEL_LABEL[row.level]}
                  </Chip>
                  {row.published_at && (
                    <Chip tone="neutral" icon={<IconClock />}>
                      <time dateTime={row.published_at}>
                        {new Date(row.published_at).toLocaleDateString(
                          "vi-VN",
                          {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          },
                        )}
                      </time>
                    </Chip>
                  )}
                </>
              }
            />
          ))}
        </ul>
      )}

      <AnnouncementPanel
        row={viewing}
        onClose={() => setViewing(null)}
        heading={t`Cập nhật mới`}
      />
    </PlatformShell>
  );
}
