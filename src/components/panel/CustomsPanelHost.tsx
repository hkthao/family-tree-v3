import { lazy, Suspense } from "react";

import { SidePanel } from "@/components/SidePanel";

import { usePanel } from "./usePanel";

import { t } from "@lingui/core/macro";
const CustomsForm = lazy(() => import("@/pages/CustomsForm"));
const CustomsImport = lazy(() => import("@/pages/CustomsImport"));

const Loading = () => (
  <p className="py-6 text-sm text-muted-foreground">{t`Đang tải…`}</p>
);

/**
 * Ngăn kéo nhập liệu của Sổ tay Văn hoá (thêm / sửa bài, nhập hàng loạt từ
 * Markdown). Sổ tay nằm ngoài ClanLayout nên gắn ở CustomsShell thay vì PanelHost.
 */
export function CustomsPanelHost() {
  const { current, params, close } = usePanel();

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
