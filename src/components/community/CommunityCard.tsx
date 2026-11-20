import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { SectionCard } from "@/components/SectionCard";
import { IconBook, IconClock } from "@/components/icons";
import { getCommunitySummary } from "@/lib/queries/community";
import { supabase } from "@/lib/supabase";

import { t } from "@lingui/core/macro";

export const communitySummaryKey = (clanId: string) => ["community-summary", clanId] as const;

/** Số liệu "Đóng góp mới" — dùng chung giữa thẻ này và hàng số trong thẻ Số liệu dòng họ. */
export function useCommunitySummary(clanId: string, enabled = true) {
  return useQuery({
    queryKey: communitySummaryKey(clanId),
    queryFn: () => getCommunitySummary(clanId),
    enabled,
    staleTime: 60_000,
  });
}

/**
 * Thẻ thông tin "Đóng góp mới" trên Tổng quan: ai vừa kể / góp gì, và nhắc hàng chờ duyệt.
 * Chỉ để xem — duyệt, xoá, mời góp nằm ở trang "Đóng góp nội dung" (/dong-gop).
 */
export function CommunityCard({ clanId, canModerate }: { clanId: string; canModerate: boolean }) {
  const { data: summary } = useCommunitySummary(clanId);
  const pending = canModerate ? (summary?.pending_memories ?? 0) : 0;
  const pendingContrib = canModerate ? (summary?.pending_contributions ?? 0) : 0;
  // Gợi ý nhận diện người trong ảnh chờ xác nhận (P2) — RPC trả 0 cho người không phải editor+.
  const { data: pendingFaces = 0 } = useQuery({
    queryKey: ["pending-faces", clanId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("clan_pending_faces", { p_clan_id: clanId });
      if (error) return 0;
      return (data as number | null) ?? 0;
    },
    enabled: canModerate,
    staleTime: 60_000,
  });

  return (
    <SectionCard
      id="dashboard-community"
      icon={<IconBook />}
      title={t`Đóng góp mới`}
      action={
        pending + pendingContrib + pendingFaces > 0 ? (
          <span className="text-xs text-muted-foreground">{t`${pending + pendingContrib + pendingFaces} chờ duyệt`}</span>
        ) : undefined
      }
      footer={
        <Link to={`/clans/${clanId}/dong-gop`} className="shrink-0 text-sm text-primary hover:underline">
          {t`Xem tất cả đóng góp →`}
        </Link>
      }
    >
      <div className="space-y-3">
        {pending > 0 && (
          <Link
            to={`/clans/${clanId}/dong-gop?tt=pending`}
            className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm hover:border-primary"
          >
            <IconClock className="h-4 w-4 text-primary" />
            {t`${pending} đóng góp đang chờ duyệt →`}
          </Link>
        )}
        {pendingContrib > 0 && (
          <Link
            to={`/clans/${clanId}/contributions`}
            className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm hover:border-primary"
          >
            <IconClock className="h-4 w-4 text-primary" />
            {t`${pendingContrib} đề xuất sửa thông tin đang chờ xác nhận →`}
          </Link>
        )}

        {pendingFaces > 0 && (
          <Link
            to={`/clans/${clanId}/dong-gop?loai=identify`}
            className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm hover:border-primary"
          >
            <IconClock className="h-4 w-4 text-primary" />
            {t`${pendingFaces} gợi ý nhận diện người trong ảnh chờ xác nhận →`}
          </Link>
        )}

        {summary && summary.recent.length > 0 ? (
          <ul className="divide-y text-sm">
            {summary.recent.slice(0, 5).map((r) => (
              <li key={`${r.type}-${r.id}`} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0 truncate">
                  <b>{r.author_name ?? t`Người thân`}</b>{" "}
                  {r.type === "memory"
                    ? r.kind === "photo"
                      ? t`góp một tấm ảnh`
                      : r.kind === "audio"
                        ? t`góp một đoạn ghi âm`
                        : t`góp một câu chuyện`
                    : t`đề xuất sửa thông tin`}
                  {r.person_name && (
                    <>
                      {" "}
                      {t`về`}{" "}
                      {r.person_id ? (
                        <Link to={`/clans/${clanId}/people/${r.person_id}`} className="text-primary hover:underline">
                          {r.person_name}
                        </Link>
                      ) : (
                        r.person_name
                      )}
                    </>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString("vi-VN")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t`Chưa có đóng góp nào. Mở hồ sơ một người đã mất rồi bấm "Đóng góp", hoặc vào "Xem tất cả đóng góp" để gửi link mời cả nhà cùng góp ảnh cũ, chuyện xưa.`}
          </p>
        )}
      </div>
    </SectionCard>
  );
}
