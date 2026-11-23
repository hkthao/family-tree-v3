import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/components/Toast";
import { queryKeys } from "@/lib/queries/keys";
import { createMilestones } from "@/lib/queries/timeline";
import type { TimelineSuggestion } from "@/lib/timeline/suggestions";
import { candidateToInput } from "@/lib/timeline/mergeTimeline";

import { t } from "@lingui/core/macro";

/**
 * Thêm nhanh các mốc nổi bật (≤8, trải đều thời gian) từ gợi ý gia phả — sao chép thành mốc của dòng thời gian.
 * Chọn từng gợi ý riêng lẻ thì dùng ô "Chọn từ gia phả" trong form thêm mốc.
 */
export function useTimelineActions(
  clanId: string,
  userId: string,
  suggestions: TimelineSuggestion[],
) {
  const toast = useToast();
  const qc = useQueryClient();
  const addHighlights = useMutation({
    mutationFn: () =>
      createMilestones(
        clanId,
        suggestions.filter((c) => c.recommended).map(candidateToInput),
      ),
    onSuccess: () => {
      toast.success(t`Đã thêm các mốc nổi bật`);
      qc.invalidateQueries({ queryKey: queryKeys.timelineRows(clanId, userId) });
    },
    onError: (e) =>
      toast.error(t`Không lưu được`, { description: (e as Error).message }),
  });
  return { addHighlights };
}
