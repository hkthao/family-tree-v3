import { IconCheck, IconPencil, IconTrash } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";

/**
 * Thanh nút dính đáy của ngăn kéo xem / sửa. Thứ tự phá huỷ → phụ → chính:
 *  - xem (`readOnly`): chỉ `[ Sửa ]`, và chỉ khi có quyền;
 *  - sửa: `[ Xoá ] [ Hủy ] [ Lưu ]` (Xoá chỉ khi có `onDelete`);
 *  - tạo mới: `[ Hủy ] [ Thêm ]`.
 */
export function ViewEditActions({
  readOnly,
  canEdit = true,
  onEdit,
  onCancel,
  onDelete,
  deleteDisabled,
  saving,
  canSave = true,
  saveLabel = "Lưu",
}: {
  readOnly: boolean;
  canEdit?: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  deleteDisabled?: boolean;
  saving: boolean;
  canSave?: boolean;
  saveLabel?: string;
}) {
  if (readOnly) {
    return canEdit ? (
      <FormActions>
        <Button type="button" onClick={onEdit}>
          <IconPencil className="mr-1.5 h-4 w-4" />
          Sửa
        </Button>
      </FormActions>
    ) : null;
  }
  return (
    <FormActions>
      {onDelete && (
        <Button type="button" variant="destructive-outline" onClick={onDelete} disabled={deleteDisabled}>
          <IconTrash className="mr-1.5 h-4 w-4" />
          Xoá
        </Button>
      )}
      <Button type="button" variant="outline" onClick={onCancel}>
        Hủy
      </Button>
      <Button type="submit" disabled={saving || !canSave}>
        <IconCheck className="mr-1.5 h-4 w-4" />
        {saving ? "Đang lưu…" : saveLabel}
      </Button>
    </FormActions>
  );
}
