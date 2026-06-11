import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useParams } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { BackLink } from "@/components/BackLink";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import {
  listAnnouncements,
  type AnnouncementLevel,
} from "@/lib/queries/announcements";
import { queryKeys } from "@/lib/queries/keys";
import { supabase } from "@/lib/supabase";

/**
 * `/announcements/:id` — trang chi tiết 1 thông báo. Tự đánh dấu
 * "đã đọc" khi mở. Không có gì ngoài tiêu đề + nội dung + meta —
 * announcements ngắn, không cần thêm comments hay action.
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

export default function AnnouncementDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();

  // Dùng list query (đã cache) thay vì fetch riêng — tin xuất hiện ở
  // /announcements thì user vừa thấy. Nếu mở qua link trực tiếp mà
  // chưa load list → load để lấy row tương ứng.
  const listQ = useQuery({
    queryKey: queryKeys.announcements(),
    queryFn: () => listAnnouncements(),
    staleTime: 60_000,
  });

  const row = (listQ.data ?? []).find((a) => a.id === id);

  // Mark as read khi mở. Chạy 1 lần / id. Idempotent (RLS upsert
  // implicit qua INSERT...ON CONFLICT trong DB ON CONFLICT DO NOTHING
  // semantic — INSERT trả lỗi unique, ignore qua check trong catch).
  const markM = useMutation({
    mutationFn: async () => {
      if (!user || !id) return;
      const { error } = await supabase
        .from("announcement_reads")
        .insert({ user_id: user.id, announcement_id: id });
      if (error && !/duplicate|unique/i.test(error.message)) {
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.announcementReads() });
      qc.invalidateQueries({
        queryKey: queryKeys.announcementsUnreadCount(),
      });
    },
  });

  useEffect(() => {
    if (!user || !id) return;
    markM.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, id]);

  return (
    <div className="min-h-dvh bg-background lg:pl-72">
      <AppHeader />
      <main className="container max-w-4xl py-6 px-4 space-y-3">
        <nav>
          <BackLink fallback="/announcements" />
        </nav>

        {listQ.isLoading && (
          <p className="text-muted-foreground">Đang tải…</p>
        )}
        {listQ.error && (
          <Alert variant="destructive">
            <AlertDescription>
              {(listQ.error as Error).message}
            </AlertDescription>
          </Alert>
        )}

        {!listQ.isLoading && !row && (
          <Alert>
            <AlertDescription>
              Không tìm thấy thông báo này. Có thể đã hết hạn hoặc bị xoá.
            </AlertDescription>
          </Alert>
        )}

        {row && (
          <article className="max-w-2xl">
            {/* Eyebrow — level + public flag, nhỏ và mảnh */}
            <div className="flex items-center gap-2 flex-wrap text-xs uppercase tracking-wider text-muted-foreground">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium normal-case ${LEVEL_BADGE[row.level]}`}
              >
                {LEVEL_LABEL[row.level]}
              </span>
              {row.is_public && <span>Public</span>}
            </div>

            {/* Title — font serif Noto Serif (clan-name class) cho cảm
                giác "đang đọc bài" như báo / blog. */}
            <h1 className="clan-name text-3xl sm:text-4xl font-semibold leading-tight mt-3 mb-2">
              {row.title}
            </h1>

            {row.published_at && (
              <time
                className="block text-sm text-muted-foreground tabular-nums"
                dateTime={row.published_at}
              >
                {new Date(row.published_at).toLocaleString("vi-VN", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            )}

            <hr className="my-5 border-border" />

            <div className="text-[17px] leading-[1.75] whitespace-pre-line text-foreground/90">
              {row.body}
            </div>

            {row.expires_at && (
              <p className="text-xs text-muted-foreground mt-8 pt-4 border-t italic">
                Thông báo này sẽ hết hạn vào{" "}
                <strong className="not-italic">
                  {new Date(row.expires_at).toLocaleString("vi-VN")}
                </strong>
                .
              </p>
            )}
          </article>
        )}
      </main>
    </div>
  );
}
