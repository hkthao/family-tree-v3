import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { useAiEnabled } from "@/hooks/useAiEnabled";
import { useAuth } from "@/hooks/useAuth";
import { buildSections, toDrawerSections } from "@/lib/navModel";
import { getClanDetail } from "@/lib/queries/clan-detail";
import { countPendingContributions } from "@/lib/queries/contributions";
import { queryKeys } from "@/lib/queries/keys";
import { countPendingPersonLinks } from "@/lib/queries/person-links";
import { getMyProfile } from "@/lib/queries/profile";
import { countClanTodo } from "@/lib/queries/todo";

/**
 * Dữ liệu menu dùng chung cho menu trái (AppDrawer) và trang "Tất cả tính năng": cùng một nguồn nên hai
 * nơi không bao giờ lệch nhau (mục nào hiện, badge bao nhiêu, ai có quyền). `sections` là ĐẦY ĐỦ mọi nhóm;
 * `drawerSections` là bản rút gọn cho menu trái (sáu mục lõi + lối vào trang hub).
 */
export function useNavSections() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { clanId } = useParams<{ clanId?: string }>();
  const aiEnabled = useAiEnabled();

  const { data: profile } = useQuery({
    queryKey: queryKeys.myProfile(userId),
    queryFn: () => getMyProfile(userId),
    enabled: !!userId,
  });
  const { data: clan } = useQuery({
    queryKey: queryKeys.clan(clanId ?? "", userId),
    queryFn: () => getClanDetail(clanId!, userId),
    enabled: !!userId && !!clanId,
  });
  const canSeeContribs =
    !!clan &&
    (clan.isPlatformAdmin || clan.myRole === "admin" || clan.myRole === "editor");
  const { data: pendingContribCount } = useQuery({
    queryKey: queryKeys.pendingContributionsCount(clanId ?? "", userId),
    queryFn: () => countPendingContributions(clanId!),
    enabled: !!userId && !!clanId && canSeeContribs,
    staleTime: 30_000,
  });
  const canSeeInlaws = !!clan && (clan.isPlatformAdmin || clan.myRole === "admin");
  const { data: pendingInlawCount } = useQuery({
    queryKey: queryKeys.pendingPersonLinksCount(clanId ?? "", userId),
    queryFn: () => countPendingPersonLinks(clanId!),
    enabled: !!userId && !!clanId && canSeeInlaws,
    staleTime: 30_000,
  });
  const canSeeTodo = !!clan && (clan.isPlatformAdmin || clan.myRole !== null);
  const { data: todoCount } = useQuery({
    queryKey: queryKeys.clanTodoCount(clanId ?? "", userId),
    queryFn: () => countClanTodo(clanId!),
    enabled: !!userId && !!clanId && canSeeTodo,
    staleTime: 60_000,
  });

  const sections = buildSections(
    clanId,
    clan ?? null,
    profile ?? null,
    pendingContribCount ?? 0,
    pendingInlawCount ?? 0,
    todoCount ?? 0,
    aiEnabled,
  );
  return {
    clanId,
    profile,
    clan,
    sections,
    drawerSections: toDrawerSections(sections, clanId),
  };
}
