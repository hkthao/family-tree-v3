import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { useToast } from "@/components/Toast";
import { useAuth } from "@/hooks/useAuth";
import { getClanCompletion } from "@/lib/queries/todo";
import { queryKeys } from "@/lib/queries/keys";

// Milestone thresholds in ascending order. Crossing any of these
// upward fires a one-shot celebration toast. Kept sparse so users
// don't get spammed — every 5% would be banner-blindness.
const MILESTONES = [50, 75, 90, 100] as const;
type Milestone = (typeof MILESTONES)[number];

function highestReached(percent: number): Milestone | 0 {
  for (let i = MILESTONES.length - 1; i >= 0; i--) {
    if (percent >= MILESTONES[i]) return MILESTONES[i];
  }
  return 0;
}

const COPY: Record<Milestone, { title: string; description: string }> = {
  50: {
    title: "Họ ta vừa vượt 50% 🎉",
    description: "Còn một nửa thôi — cả họ cùng kéo lên 100%.",
  },
  75: {
    title: "Đã 75% rồi!",
    description: "Sắp xong — chỉ còn vài chỗ thiếu nữa.",
  },
  90: {
    title: "90% — gần trọn vẹn!",
    description: "Còn một chút là dòng họ đầy đủ thông tin.",
  },
  100: {
    title: "🎊 100% hoàn thành!",
    description:
      "Mọi người đã có đủ năm sinh + cha mẹ. Hiếm có gia phả nào làm được.",
  },
};

function storageKey(clanId: string): string {
  return `ftv3:milestone:${clanId}`;
}

/**
 * Watches the clan's completion percentage and fires a one-shot
 * celebration toast each time it crosses a milestone upward. State
 * is persisted per-clan in localStorage so we don't re-fire after
 * a reload, and so a percentage that drops then climbs again only
 * re-celebrates the part above the high-water mark.
 *
 * First-visit behaviour: we initialize the high-water mark from
 * whatever percent is currently in the cache. Without this an old
 * clan opening for the first time would immediately fire all four
 * milestones at once — a noisy ambush, not a celebration.
 */
export function useCompletionMilestone(clanId: string): void {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const toast = useToast();

  const { data: completion } = useQuery({
    queryKey: queryKeys.clanCompletion(clanId, userId),
    queryFn: () => getClanCompletion(clanId),
    enabled: !!userId && !!clanId,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!completion || completion.percent === null) return;
    if (typeof window === "undefined") return;
    const key = storageKey(clanId);
    const reached = highestReached(completion.percent);
    const raw = window.localStorage.getItem(key);

    // No prior high-water mark for THIS clan: silently seed it.
    // (Key is per-clan so switching clans naturally re-seeds.)
    if (raw === null) {
      window.localStorage.setItem(key, String(reached));
      return;
    }

    const stored = Number(raw);
    if (reached > stored && reached > 0) {
      const copy = COPY[reached as Milestone];
      toast.success(copy.title, {
        description: copy.description,
        durationMs: 8000,
      });
      window.localStorage.setItem(key, String(reached));
    }
  }, [completion, clanId, toast]);
}
