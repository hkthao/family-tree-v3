import { useState } from "react";

import { ApiTokensAdminTab } from "@/components/admin/ApiTokensAdminTab";
import { IconBook, IconSparkles } from "@/components/icons";
import { McpGuidePanel } from "@/components/McpGuidePanel";
import { Button } from "@/components/ui/button";
import { AdminShell } from "@/pages/admin/AdminShell";

import { t } from "@lingui/core/macro";
export default function KetNoiAiPage() {
  const [guide, setGuide] = useState(false);
  return (
    <AdminShell
      icon={<IconSparkles className="h-7 w-7" />}
      title={t`Kết nối AI`}
      description={t`Token để AI bên ngoài (Claude, ChatGPT…) tra cứu gia phả; thu hồi khi nghi bị lộ.`}
      actions={
        <Button size="sm" variant="outline" onClick={() => setGuide(true)}>
          <IconBook className="mr-1.5 h-4 w-4" />
          {t`Hướng dẫn kết nối`}
        </Button>
      }
    >
      <ApiTokensAdminTab />
      <McpGuidePanel open={guide} onClose={() => setGuide(false)} admin />
    </AdminShell>
  );
}
