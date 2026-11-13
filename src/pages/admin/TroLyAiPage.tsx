import { IconSparkles } from "@/components/icons";
import { AiUsageTab } from "@/components/admin/AiUsageTab";
import { AdminShell } from "@/pages/admin/AdminShell";

import { t } from "@lingui/core/macro";
export default function TroLyAiPage() {
  return (
    <AdminShell
      icon={<IconSparkles className="h-7 w-7" />}
      title={t`Trợ lý AI`}
      description={t`Lượt hỏi, chi phí, độ trễ, hạn mức đang dùng.`}
    >
      <AiUsageTab />
    </AdminShell>
  );
}
