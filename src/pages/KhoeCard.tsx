import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { IconSparkles, IconTree } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { getPublicCardUrl } from "@/lib/cards/publishCard";
import { supabase } from "@/lib/supabase";

/**
 * `/khoe/:token` — trang công khai hiển thị ĐÚNG tấm thiệp "khoe" mà
 * thành viên đã chia sẻ (ảnh lưu trong bucket card-shares). Link có hạn
 * (≤ 3 tháng); hết hạn thì RLS lọc mất → hiện thông báo, cron sẽ dọn.
 *
 * Khác với /share/:token (trang danh thiếp cá nhân) — trang này chỉ
 * khoe tấm thiệp, không lộ quan hệ/giới tính.
 */
export default function KhoeCard() {
  const { token } = useParams<{ token: string }>();

  const q = useQuery({
    queryKey: ["khoe-card", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("card_shares")
        .select("title, subtitle, image_path, clan_id, expires_at")
        .eq("token", token!)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!token,
    staleTime: 60_000,
  });

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md space-y-5">
        {q.isLoading && (
          <p className="text-center text-muted-foreground">Đang tải…</p>
        )}

        {!q.isLoading && !q.data && (
          <div className="text-center space-y-3 py-12">
            <IconSparkles className="h-10 w-10 mx-auto text-muted-foreground" />
            <h1 className="text-xl font-semibold">Liên kết không còn hiệu lực</h1>
            <p className="text-muted-foreground">
              Tấm thiệp này có thể đã hết hạn chia sẻ hoặc đã bị gỡ.
            </p>
          </div>
        )}

        {q.data && (
          <>
            <header className="text-center space-y-1">
              <h1 className="text-2xl font-semibold clan-name">
                {q.data.title}
              </h1>
              {q.data.subtitle && (
                <p className="text-muted-foreground">{q.data.subtitle}</p>
              )}
            </header>

            <img
              src={getPublicCardUrl(q.data.image_path)}
              alt={q.data.title}
              className="w-full rounded-xl border shadow-md"
            />

            {/* CTA lan toả — mời người xem tìm hiểu / tạo gia phả họ mình. */}
            <div className="rounded-xl border bg-card p-4 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Trang này được tạo từ <span className="font-medium text-foreground">Gia phả dòng họ Việt</span> —
                nơi lưu giữ cây gia phả, kỷ niệm và nét đẹp truyền thống của dòng họ.
              </p>
              <Button asChild className="w-full">
                <Link to="/">
                  <IconTree className="h-4 w-4 mr-1.5" />
                  Tạo gia phả dòng họ của bạn
                </Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
