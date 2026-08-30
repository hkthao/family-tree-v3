import { useQuery } from "@tanstack/react-query";

import { providerLabelForModel } from "@/lib/aiModels";
import { getPlatformSetting } from "@/lib/queries/platformSettings";

/**
 * Tên nhà cung cấp đang xử lý câu hỏi ("OpenAI", "Anthropic (Claude)"…).
 *
 * Dùng để nói thẳng với người dùng rằng câu hỏi của họ rời khỏi máy chủ
 * của chúng ta. Suy từ `ai.model.qa` chứ không viết cứng: admin đổi model
 * là dòng chữ đó phải đổi theo, nếu không nó thành lời nói dối im lặng.
 *
 * `null` khi chưa tải xong hoặc model lạ — lúc đó giao diện không nói gì
 * cả, thà thiếu còn hơn sai tên.
 */
export function useAiProviderLabel(): string | null {
  const { data } = useQuery({
    queryKey: ["ai-model-qa"],
    queryFn: () => getPlatformSetting("ai.model.qa"),
    staleTime: 5 * 60_000,
    retry: false,
  });
  return providerLabelForModel(data ?? null);
}
