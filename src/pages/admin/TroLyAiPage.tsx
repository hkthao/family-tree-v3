import { IconSparkles } from "@/components/icons";
import { AiUsageTab } from "@/components/admin/AiUsageTab";
import { AdminShell } from "@/pages/admin/AdminShell";

export default function TroLyAiPage() {
  return (
    <AdminShell
      icon={<IconSparkles className="h-7 w-7" />}
      title="Trợ lý AI"
      description="Lượt hỏi, chi phí, độ trễ, hạn mức đang dùng."
    >
      <AiUsageTab />
    </AdminShell>
  );
}
