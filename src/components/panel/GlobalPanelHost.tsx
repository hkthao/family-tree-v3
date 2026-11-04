import { lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";

import { SidePanel } from "@/components/SidePanel";

import { usePanel } from "./usePanel";

const NewClanForm = lazy(() =>
  import("@/pages/NewClan").then((m) => ({ default: m.NewClanForm })),
);

/** Panel không thuộc một dòng họ cụ thể (chưa có ClanLayout): hiện chỉ có tạo dòng họ mới. */
export function GlobalPanelHost() {
  const { current, close } = usePanel();
  const navigate = useNavigate();
  if (current !== "clan-new") return null;
  return (
    <SidePanel open title="Tạo dòng họ mới" subtitle="Tạo xong là dòng họ rỗng, sẵn sàng thêm Thuỷ tổ." onClose={close}>
      <Suspense fallback={<p className="py-6 text-sm text-muted-foreground">Đang tải…</p>}>
        <NewClanForm onDone={(id) => navigate(`/clans/${id}`, { replace: true })} onCancel={close} />
      </Suspense>
    </SidePanel>
  );
}
