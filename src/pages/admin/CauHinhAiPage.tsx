import { IconSparkles } from "@/components/icons";
import { AiSettingsTab } from "@/components/admin/AiSettingsTab";
import { AdminShell } from "@/pages/admin/AdminShell";

import { t } from "@lingui/core/macro";
export default function CauHinhAiPage() {
  return (
    <AdminShell
      icon={<IconSparkles className="h-7 w-7" />}
      title={t`Cấu hình trợ lý AI`}
      description={t`Bật/tắt, chọn model, khoá API, hạn mức và trần chi phí.`}
    >
      <AiSettingsTab />
    </AdminShell>
  );
}
