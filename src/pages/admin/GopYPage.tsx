import { IconMail } from "@/components/icons";
import { AdminShell } from "@/pages/admin/AdminShell";
import { FeedbackTab } from "@/pages/admin/Feedback";

import { t } from "@lingui/core/macro";
export default function GopYPage() {
  return (
    <AdminShell
      icon={<IconMail className="h-7 w-7" />}
      title={t`Góp ý`}
      description={t`Góp ý và báo lỗi người dùng gửi lên.`}
    >
      <FeedbackTab />
    </AdminShell>
  );
}
