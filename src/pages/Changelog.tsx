import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { AppLogo } from "@/components/AppLogo";
import { IconSparkles } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  listPublicAnnouncements,
  type Announcement,
  type AnnouncementLevel,
} from "@/lib/queries/announcements";
import { queryKeys } from "@/lib/queries/keys";

/**
 * `/changelog` — public, không cần đăng nhập. Đọc các tin
 * `is_public=true`. Plan §32.9 O4: đây là single source of truth cho
 * changelog public, không maintain MD song song.
 *
 * SEO note (plan §32.9 O10): server-side render về sau để search
 * engine index "cập nhật gia phả tháng X".
 */
const LEVEL_LABEL: Record<AnnouncementLevel, string> = {
  info: "Tin",
  update: "Cập nhật",
  warning: "Cảnh báo",
  critical: "Quan trọng",
};

const LEVEL_BADGE: Record<AnnouncementLevel, string> = {
  info: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  update: "bg-primary/10 text-primary border-primary/30",
  warning:
    "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  critical:
    "bg-destructive/10 text-destructive border-destructive/30 font-semibold",
};

export default function Changelog() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.publicAnnouncements(),
    queryFn: () => listPublicAnnouncements(),
    staleTime: 60_000,
  });

  const rows = data ?? [];

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-background sticky top-0 z-30">
        <div className="container max-w-4xl flex items-center justify-between gap-2 px-4 h-[64px]">
          <Link
            to="/"
            className="clan-name text-2xl font-semibold text-primary inline-flex items-center gap-2"
          >
            <AppLogo size={28} className="rounded" />
            Gia phả
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link to="/login" className="hover:underline">
              Đăng nhập
            </Link>
            <Link to="/lien-he" className="hover:underline">
              Liên hệ
            </Link>
          </nav>
        </div>
      </header>

      <main className="container max-w-4xl py-6 px-4 space-y-3">
        <PageHeader
          icon={<IconSparkles className="h-7 w-7" />}
          title="Cập nhật mới"
          description="Tổng hợp tính năng, sửa lỗi, thông báo bảo trì của app."
        />

        {isLoading && <p className="text-muted-foreground">Đang tải…</p>}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        )}
        {!isLoading && rows.length === 0 && (
          <p className="text-muted-foreground italic">
            Chưa có cập nhật nào được công bố. Quay lại sau.
          </p>
        )}

        <ul className="space-y-4">
          {rows.map((row) => (
            <ChangelogEntry key={row.id} row={row} />
          ))}
        </ul>
      </main>
    </div>
  );
}

function ChangelogEntry({ row }: { row: Announcement }) {
  return (
    <li className="rounded-lg border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${LEVEL_BADGE[row.level]}`}
        >
          {LEVEL_LABEL[row.level]}
        </span>
        {row.published_at && (
          <time
            className="text-xs text-muted-foreground ml-auto tabular-nums"
            dateTime={row.published_at}
          >
            {new Date(row.published_at).toLocaleDateString("vi-VN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </time>
        )}
      </div>
      <h2 className="font-semibold text-lg">{row.title}</h2>
      <p className="text-sm whitespace-pre-line leading-relaxed">{row.body}</p>
    </li>
  );
}
