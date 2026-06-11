import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import {
  listAnnouncements,
  listMyAnnouncementReads,
} from "@/lib/queries/announcements";
import { queryKeys } from "@/lib/queries/keys";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

/**
 * Top-banner cho tin `level='critical'` chưa đọc. Hiện tin mới nhất
 * thôi — không stack nhiều cùng lúc (gây nhiễu).
 *
 * Bấm "Đã hiểu" → mark đọc CHỈ tin đó (không phải mark all) — không
 * giấu các tin khác.
 */
export function CriticalBanner() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const annsQ = useQuery({
    queryKey: queryKeys.announcements(),
    queryFn: () => listAnnouncements(),
    enabled: !!user,
    staleTime: 60_000,
  });

  const readsQ = useQuery({
    queryKey: queryKeys.announcementReads(),
    queryFn: () => listMyAnnouncementReads(),
    enabled: !!user,
    staleTime: 60_000,
  });

  const markM = useMutation({
    mutationFn: async (id: string) => {
      if (!user) return;
      const { error } = await supabase
        .from("announcement_reads")
        .insert({ user_id: user.id, announcement_id: id });
      // Conflict (đã đọc trước đó) — bỏ qua.
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

  if (!user) return null;

  const reads = readsQ.data ?? new Set<string>();
  const banner = (annsQ.data ?? []).find(
    (a) => a.level === "critical" && !reads.has(a.id),
  );
  if (!banner) return null;

  return (
    <div
      role="alert"
      className="border-b bg-destructive/10 border-destructive/30 text-destructive-foreground"
    >
      <div className="container max-w-4xl flex items-start gap-3 px-4 py-3">
        <span
          aria-hidden="true"
          className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-base font-bold"
        >
          !
        </span>
        <div className="flex-1 min-w-0 text-foreground">
          <p className="font-semibold">{banner.title}</p>
          <p className="text-sm whitespace-pre-line opacity-90 line-clamp-3">
            {banner.body}
          </p>
          <div className="mt-2 flex items-center gap-3 text-sm">
            <Link
              to="/announcements"
              className="text-primary hover:underline font-medium"
            >
              Xem tất cả thông báo
            </Link>
            <button
              type="button"
              onClick={() => markM.mutate(banner.id)}
              disabled={markM.isPending}
              className="text-muted-foreground hover:text-foreground"
            >
              {markM.isPending ? "Đang lưu…" : "Đã hiểu"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
