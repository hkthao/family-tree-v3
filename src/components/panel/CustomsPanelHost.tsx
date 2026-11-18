import { lazy, Suspense } from "react";

import { SidePanel } from "@/components/SidePanel";

import { usePanel } from "./usePanel";

import { t } from "@lingui/core/macro";
const CustomsDetail = lazy(() => import("@/pages/CustomsDetail"));
const CustomsForm = lazy(() => import("@/pages/CustomsForm"));
const CustomsImport = lazy(() => import("@/pages/CustomsImport"));

const Loading = () => (
  <p className="py-6 text-sm text-muted-foreground">{t`Đang tải…`}</p>
);

/**
 * Ngăn kéo của Sổ tay Văn hoá: đọc bài, thêm / sửa bài, nhập hàng loạt từ Markdown. Sổ tay nằm ngoài ClanLayout nên
 * gắn ở CustomsShell; ngăn kéo đọc bài cũng có ở PanelHost (thẻ "Phong tục hôm nay" trong dòng họ).
 */
export function CustomsPanelHost() {
  const { current, params, close } = usePanel();

  if (current === "custom-view" && params.pid) {
    return <CustomViewPanel id={params.pid} onClose={close} />;
  }

  if (current === "custom-new" || (current === "custom-edit" && params.pid)) {
    const isEdit = current === "custom-edit";
    return (
      <SidePanel
        open
        title={isEdit ? t`Sửa bài phong tục` : t`Thêm bài phong tục`}
        onClose={close}
        size="lg"
      >
        <Suspense fallback={<Loading />}>
          <CustomsForm
            embedded={{
              id: isEdit ? params.pid : undefined,
              onDone: close,
              onCancel: close,
            }}
          />
        </Suspense>
      </SidePanel>
    );
  }

  if (current === "custom-import") {
    return (
      <SidePanel
        open
        title={t`Nhập hàng loạt từ Markdown`}
        onClose={close}
        size="lg"
      >
        <Suspense fallback={<Loading />}>
          <CustomsImport embedded={{ onDone: close, onCancel: close }} />
        </Suspense>
      </SidePanel>
    );
  }

  return null;
}

/** Ngăn kéo đọc một bài Sổ tay (dạng bài báo) — dùng chung cho CustomsPanelHost và PanelHost của dòng họ. */
export function CustomViewPanel({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  return (
    <SidePanel
      open
      title={t`Sổ tay Văn hoá`}
      onClose={onClose}
      size="lg"
      guard={false}
    >
      <Suspense fallback={<Loading />}>
        <CustomsDetail embedded={{ id, onClose }} />
      </Suspense>
    </SidePanel>
  );
}
