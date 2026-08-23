import { useQuery } from "@tanstack/react-query";

import { isAiEnabled } from "@/lib/queries/aiChat";

/**
 * Công tắc tổng của trợ lý AI. Xem `isAiEnabled()` để biết vì sao cần cả
 * cái này lẫn feature-flag theo dòng họ.
 *
 * Trả `false` trong lúc đang tải — thà ẩn nút một nhịp còn hơn hiện ra
 * rồi lại biến mất, và cũng đúng hướng an toàn khi chưa áp migration.
 */
export function useAiEnabled(): boolean {
  const { data } = useQuery({
    queryKey: ["ai-enabled"],
    queryFn: isAiEnabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
  return data === true;
}
