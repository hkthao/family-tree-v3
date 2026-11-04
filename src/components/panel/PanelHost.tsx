import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";

import { QuickAddSheet } from "@/components/QuickAddSheet";
import { SidePanel } from "@/components/SidePanel";
import { useAuth } from "@/hooks/useAuth";
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
export function PanelHost({ clanId }: { clanId: string }) {
  const { current, params, close } = usePanel();
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
