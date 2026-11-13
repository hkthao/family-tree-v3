import { useEffect, useState } from "react";

import { SidePanel } from "@/components/SidePanel";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";

import { t } from "@lingui/core/macro";
export type NewCanvasKind = "members" | "blank";

/** Ngăn kéo "Tạo cây mới": đặt tên + chọn trang trống hoặc có sẵn thành viên. */
export function NewCanvasPanel({
  open,
  busy,
  warnUnsaved = false,
  onClose,
  onCreate,
}: {
  open: boolean;
  busy: boolean;
  warnUnsaved?: boolean;
  onClose: () => void;
  onCreate: (name: string, kind: NewCanvasKind) => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<NewCanvasKind>("members");
  useEffect(() => {
    if (open) {
      setName("");
      setKind("members");
    }
  }, [open]);

  return (
    <SidePanel
      open={open}
      title={t`Tạo cây mới`}
      subtitle={t`Mỗi dòng họ có thể có nhiều cây (bố cục) riêng.`}
      onClose={onClose}
      guard={false}
    >
      <div className="flex flex-1 flex-col space-y-3">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{t`Tên cây`}</span>
          <Input
            value={name}
            maxLength={80}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder={t`VD: Phả đồ chi trưởng`}
          />
        </label>
        <fieldset className="space-y-2 text-sm">
          <legend className="font-medium">{t`Bắt đầu với`}</legend>
          {(
            [
              [
                "members",
                t`Mặc định có thành viên`,
                t`Tự xếp toàn bộ gia phả theo đời, bạn chỉnh tiếp.`,
              ],
              [
                "blank",
                t`Trang trống hoàn toàn`,
                t`Không có thẻ nào; kéo thành viên hoặc thẻ thiết kế sẵn từ bảng công cụ vào.`,
              ],
            ] as const
          ).map(([v, label, desc]) => (
            <label
              key={v}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${kind === v ? "border-primary bg-primary/10" : ""}`}
            >
              <input
                type="radio"
                name="new-kind"
                className="mt-1"
                checked={kind === v}
                onChange={() => setKind(v)}
              />
              <span>
                <span className="block font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground">
                  {desc}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        {warnUnsaved && (
          <p className="text-xs text-amber-600">{t`Thay đổi chưa lưu ở cây hiện tại sẽ không được giữ.`}</p>
        )}
        <FormActions>
          <Button variant="outline" onClick={onClose}>{t`Huỷ`}</Button>
          <Button onClick={() => onCreate(name, kind)} disabled={busy}>
            {busy ? t`Đang tạo…` : t`Tạo`}
          </Button>
        </FormActions>
      </div>
    </SidePanel>
  );
}
