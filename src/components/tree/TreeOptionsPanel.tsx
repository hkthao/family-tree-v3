import {
  IconAward,
  IconLayers,
  IconLayoutHorizontal,
  IconLayoutVertical,
  IconPencil,
  IconSparkles,
  IconTree,
  IconUser,
  IconUsers,
} from "@/components/icons";
import { Select } from "@/components/ui/select";
import { NAME_FONTS } from "@/lib/tree/nameFonts";
import type {
  Backdrop,
  CardFrame,
  CardLayout,
  TreeViewPrefs,
} from "@/lib/tree/viewPrefs";

import { t } from "@lingui/core/macro";
export type TreeMode = "2d" | "3d" | "folder";
export type TreeOrientation = "vertical" | "horizontal";
export type TreeView = "tree" | "lineage";

/** Các mức "số đời quanh người làm tâm" (0 = tất cả). Dùng chung hai trang. */
export const TREE_DEPTH_OPTIONS = [3, 4, 5, 8, 0] as const;

const SELECT = "w-full h-11 text-base";

/**
 * Nội dung ngăn kéo "Tuỳ chọn cây" — MỘT nơi duy nhất cho cả trang Cây và trang Chia sẻ.
 * Trang nào không hỗ trợ tuỳ chọn nào thì bỏ prop tương ứng (vd. Chia sẻ không có chế độ
 * "Thư mục" và "Trực hệ"): ô đó tự ẩn.
 */
export function TreeOptionsPanel({
  prefs,
  mode,
  onModeChange,
  modes = ["2d", "3d", "folder"],
  depth,
  onDepthChange,
  view,
  onViewChange,
  orientation,
  onOrientationChange,
}: {
  prefs: TreeViewPrefs;
  mode: TreeMode;
  onModeChange: (m: TreeMode) => void;
  /** Các chế độ cây trang này hỗ trợ. */
  modes?: TreeMode[];
  depth: number;
  onDepthChange: (d: number) => void;
  /** Cả cây / Trực hệ — chỉ truyền khi trang hỗ trợ (cần đăng nhập). */
  view?: TreeView;
  onViewChange?: (v: TreeView) => void;
  orientation: TreeOrientation;
  onOrientationChange: (o: TreeOrientation) => void;
}) {
  const treeView = (view ?? "tree") === "tree";
  return (
    <div className="flex flex-col gap-3">
      <Select
        aria-label={t`Kiểu hiển thị cây`}
        icon={<IconTree />}
        value={mode}
        onChange={(e) => onModeChange(e.target.value as TreeMode)}
        className={SELECT}
      >
        {modes.includes("2d") && <option value="2d">{t`Cây 2D`}</option>}
        {modes.includes("3d") && <option value="3d">{t`Cây 3D`}</option>}
        {modes.includes("folder") && (
          <option value="folder">{t`Thư mục`}</option>
        )}
      </Select>
      {mode !== "folder" && (
        <Select
          aria-label={t`Số đời hiển thị quanh người làm tâm`}
          icon={<IconLayers />}
          value={depth}
          onChange={(e) => onDepthChange(Number(e.target.value))}
          className={SELECT}
        >
          {TREE_DEPTH_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d === 0 ? t`Tất cả các đời` : t`Số đời: ${d}`}
            </option>
          ))}
        </Select>
      )}
      {mode === "2d" && onViewChange && (
        <Select
          aria-label={t`Chế độ xem`}
          icon={<IconUsers />}
          value={view ?? "tree"}
          onChange={(e) => onViewChange(e.target.value as TreeView)}
          className={SELECT}
        >
          <option value="tree">{t`Cả cây`}</option>
          <option value="lineage">{t`Trực hệ`}</option>
        </Select>
      )}
      {mode === "2d" && treeView && (
        <>
          <Select
            aria-label={t`Hướng cây`}
            icon={
              orientation === "vertical" ? (
                <IconLayoutVertical />
              ) : (
                <IconLayoutHorizontal />
              )
            }
            value={orientation}
            onChange={(e) =>
              onOrientationChange(e.target.value as TreeOrientation)
            }
            className={SELECT}
          >
            <option value="vertical">{t`Hướng dọc`}</option>
            <option value="horizontal">{t`Hướng ngang`}</option>
          </Select>
          <Select
            aria-label={t`Hình nền cây`}
            icon={<IconSparkles />}
            value={prefs.backdrop}
            onChange={(e) => prefs.setBackdrop(e.target.value as Backdrop)}
            className={SELECT}
          >
            <option value="phoenix">{t`Nền: Phượng`}</option>
            <option value="dragon">{t`Nền: Rồng`}</option>
            <option value="none">{t`Tắt nền`}</option>
          </Select>
          <Select
            aria-label={t`Khung viền thẻ`}
            icon={<IconAward />}
            value={prefs.cardFrame}
            onChange={(e) => prefs.setCardFrame(e.target.value as CardFrame)}
            className={SELECT}
          >
            <option value="royal">{t`Khung: Hoàng gia`}</option>
            <option value="simple">{t`Khung: Đơn giản`}</option>
          </Select>
          <Select
            aria-label={t`Kiểu thẻ`}
            icon={<IconLayoutVertical />}
            value={prefs.cardLayout}
            onChange={(e) => prefs.setCardLayout(e.target.value as CardLayout)}
            className={SELECT}
          >
            <option value="wide">{t`Thẻ: Ngang`}</option>
            <option value="tall">{t`Thẻ: Dọc (xem được nhiều người hơn)`}</option>
          </Select>
          {prefs.cardLayout === "tall" && (
            <Select
              aria-label={t`Ảnh trên thẻ`}
              icon={<IconUser />}
              value={prefs.cardAvatar ? "on" : "off"}
              onChange={(e) => prefs.setCardAvatar(e.target.value === "on")}
              className={SELECT}
            >
              <option value="on">{t`Ảnh: Hiện`}</option>
              <option value="off">{t`Ảnh: Ẩn`}</option>
            </Select>
          )}
        </>
      )}
      {/* Font tên + avatar mặc định áp dụng cho cả 2D, 3D và Thư mục. */}
      <Select
        aria-label={t`Font tên`}
        icon={<IconPencil />}
        value={prefs.nameFont}
        onChange={(e) => prefs.setNameFont(e.target.value)}
        className={SELECT}
      >
        {NAME_FONTS.map((f) => (
          <option key={f.id} value={f.id}>
            Font: {f.label}
          </option>
        ))}
      </Select>
      <Select
        aria-label={t`Avatar mặc định`}
        icon={<IconUser />}
        value={prefs.avatarStyle}
        onChange={(e) =>
          prefs.setAvatarStyle(e.target.value as "royal" | "classic")
        }
        className={SELECT}
      >
        <option value="royal">{t`Avatar: Hoàng gia`}</option>
        <option value="classic">{t`Avatar: Cổ điển`}</option>
      </Select>
    </div>
  );
}
