import { Navigate } from "react-router-dom";

import { ApiTokensSection } from "@/components/ApiTokensSection";
import { Breadcrumb } from "@/components/Breadcrumb";
import { IconSparkles } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { isClanAdmin, useClanContext } from "@/hooks/useClanContext";

import { t } from "@lingui/core/macro";

/**
 * `/clans/:clanId/ket-noi-ai` — kết nối AI (Claude, ChatGPT…) của dòng họ, đặt trong menu "Công cụ & Quản trị" cho admin dòng họ dễ
 * tìm. Cùng thành phần với thẻ "Kết nối AI" trong Cài đặt dòng họ; quyền vẫn do RLS + server MCP quyết định.
 */
export default function AiConnect() {
  const { clan } = useClanContext();
  if (!isClanAdmin(clan)) return <Navigate to={`/clans/${clan.id}/people`} replace />;

  return (
    <div className="space-y-3">
      <Breadcrumb items={[{ label: clan.name, to: `/clans/${clan.id}` }, { label: t`Kết nối AI` }]} />
      <PageHeader
        icon={<IconSparkles className="h-7 w-7" />}
        title={t`Kết nối AI`}
        description={t`Cho Claude, ChatGPT… tra cứu và cập nhật gia phả bằng đúng quyền của bạn. Xem và thu hồi mọi kết nối của dòng họ.`}
      />
      <ApiTokensSection clanId={clan.id} />
    </div>
  );
}
