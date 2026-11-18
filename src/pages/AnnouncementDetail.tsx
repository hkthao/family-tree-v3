import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useParams } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import {
  Article,
  ArticleFooter,
  ArticleHeader,
  ArticleProse,
} from "@/components/Article";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import {
  listAnnouncements,
  type AnnouncementLevel,
} from "@/lib/queries/announcements";
import { queryKeys } from "@/lib/queries/keys";
import { supabase } from "@/lib/supabase";

import { t } from "@lingui/core/macro";
import { msg } from "@lingui/core/macro";
import { lazyMessages } from "@/lib/i18n/lazy";
/**
 * `/announcements/:id` — trang chi tiết 1 thông báo. Tự đánh dấu
 * "đã đọc" khi mở. Không có gì ngoài tiêu đề + nội dung + meta —
 * announcements ngắn, không cần thêm comments hay action.
 */
const LEVEL_LABEL: Record<AnnouncementLevel, string> = lazyMessages({
  info: msg`Tin`,
  update: msg`Cập nhật`,
  warning: msg`Cảnh báo`,
  critical: msg`Quan trọng`,
}) as Record<AnnouncementLevel, string>;

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
    <div className="min-h-dvh bg-background pb-[env(safe-area-inset-bottom)] lg:pl-72">
      <AppHeader />
      <main className="container max-w-4xl py-6 px-4 space-y-3">
        <Breadcrumb
          items={[
            { label: t`Thông báo`, to: "/announcements" },
            { label: row?.title ?? t`Chi tiết` },
          ]}
        />

        {listQ.isLoading && (
          <p className="text-muted-foreground">{t`Đang tải…`}</p>
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
              {t`Không tìm thấy thông báo này. Có thể đã hết hạn hoặc bị xoá.`}
            </AlertDescription>
          </Alert>
        )}

        {row && (
          <div className="max-w-2xl">
            {/* Dạng bài báo — cùng khuôn với ngăn kéo xem thông báo (AnnouncementPanel, components/Article). */}
            <Article>
              <ArticleHeader
                kicker={LEVEL_LABEL[row.level]}
                title={row.title}
                meta={[
                  row.published_at && (
                    <time className="tabular-nums" dateTime={row.published_at}>
                      {new Date(row.published_at).toLocaleString("vi-VN", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  ),
                  row.is_public && t`Công khai`,
                ]}
              />
              <div className="mt-5">
                <ArticleProse>{row.body}</ArticleProse>
              </div>
              {row.expires_at && (
                <ArticleFooter>
                  <p className="italic">
                    {t`Thông báo này sẽ hết hạn vào`}{" "}
                    <strong className="not-italic">
                      {new Date(row.expires_at).toLocaleString("vi-VN")}
                    </strong>
                    .
                  </p>
                </ArticleFooter>
              )}
            </Article>
          </div>
        )}
      </main>
    </div>
  );
}
