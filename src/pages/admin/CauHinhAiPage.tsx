import { IconSparkles } from "@/components/icons";
import { AiSettingsTab } from "@/components/admin/AiSettingsTab";
import { AdminShell } from "@/pages/admin/AdminShell";

export default function CauHinhAiPage() {
  return (
    <AdminShell
      icon={<IconSparkles className="h-7 w-7" />}
      title="Cấu hình trợ lý AI"
      description="Bật/tắt, chọn model, khoá API, hạn mức và trần chi phí."
    >
      <AiSettingsTab />
    </AdminShell>
  );
}
