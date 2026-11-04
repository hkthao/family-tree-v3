import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect } from "react";

import { AiChatView } from "@/components/ai/AiChatView";
import { AI_DOCK_OPEN_EVENT } from "@/components/ai/AiChatDock";
import { QuickAddSheet } from "@/components/QuickAddSheet";
import { SidePanel } from "@/components/SidePanel";
import { useAiEnabled } from "@/hooks/useAiEnabled";
import { useAuth } from "@/hooks/useAuth";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { isFeatureEnabled } from "@/lib/clanFeatures";
import type { ClanDetail } from "@/lib/queries/clan-detail";
import { queryKeys } from "@/lib/queries/keys";
import { getPerson } from "@/lib/queries/persons";

import { usePanel } from "./usePanel";

// Tải khi mở (không phình bundle của trang).
const NewPersonForm = lazy(() =>
  import("@/pages/clan/NewPerson").then((m) => ({ default: m.NewPersonForm })),
);
const EditPersonForm = lazy(() =>
  import("@/pages/clan/EditPerson").then((m) => ({ default: m.EditPersonForm })),
);

const Loading = () => <p className="py-6 text-sm text-muted-foreground">Đang tải…</p>;

/**
 * Gắn một lần ở ClanLayout: đọc `?panel=` và dựng ngăn kéo tương ứng. Thêm
 * loại panel mới = thêm một nhánh ở đây + một PanelId trong usePanel.
 */
export function PanelHost({ clan }: { clan: ClanDetail }) {
  const clanId = clan.id;
  const { current, params, close } = usePanel();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const aiEnabled = useAiEnabled();
  const chatOk =
    aiEnabled && isFeatureEnabled(clan.disabled_features, "ai_assistant");

  // Máy tính: "chat" nghĩa là mở khung dock bên phải (không modal) rồi gỡ ?panel=.
  const openDock = current === "chat" && isDesktop && chatOk;
  useEffect(() => {
    if (!openDock) return;
    window.dispatchEvent(new Event(AI_DOCK_OPEN_EVENT));
    close();
  }, [openDock, close]);
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const pid = params.pid;

  const { data: person } = useQuery({
    queryKey: queryKeys.person(pid ?? "", userId),
    queryFn: () => getPerson(pid!),
    enabled: !!pid && !!userId && (current === "person-edit"),
  });

  if (current === "person-new") {
    return (
      <SidePanel
        open
        title={params.pfrom ? "Sao chép người" : "Thêm người"}
        subtitle="Nhập xong bấm Lưu — danh sách phía sau tự cập nhật."
        onClose={close}
        size="lg"
      >
        <Suspense fallback={<Loading />}>
          <NewPersonForm clanId={clanId} fromId={params.pfrom ?? null} onDone={close} onCancel={close} />
        </Suspense>
      </SidePanel>
    );
  }

  if (current === "person-edit" && pid) {
    return (
      <SidePanel
        open
        title="Sửa thông tin"
        subtitle={person?.full_name}
        onClose={close}
        size="lg"
      >
        <Suspense fallback={<Loading />}>
          <EditPersonForm clanId={clanId} personId={pid} onSaved={close} onCancel={close} />
        </Suspense>
      </SidePanel>
    );
  }

  if (current === "chat" && !isDesktop && chatOk) {
    return (
      <SidePanel open title="Trợ lý dòng họ" subtitle={clan.name} onClose={close} bare guard={false}>
        <AiChatView clan={clan} variant="panel" />
      </SidePanel>
    );
  }

  if (current === "person-add" && pid) {
    return (
      <QuickAddSheet
        open
        onClose={close}
        clanId={clanId}
        personId={pid}
        defaultRelation={params.prel}
      />
    );
  }

  return null;
}
