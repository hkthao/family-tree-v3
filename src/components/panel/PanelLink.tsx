import { Link, type LinkProps } from "react-router-dom";

import { usePanel, type PanelId, type PanelParams } from "./usePanel";

/**
 * Link vào trang đầy đủ (giữ deep link, mở tab mới, chuột giữa) nhưng bấm
 * thường thì mở ngăn kéo tương ứng thay vì chuyển trang.
 */
export function PanelLink({
  panel,
  panelParams,
  onClick,
  ...rest
}: LinkProps & { panel: PanelId; panelParams?: PanelParams }) {
  const { open } = usePanel();
  return (
    <Link
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        // Ctrl/Cmd/Shift/Alt hoặc chuột giữa → để trình duyệt mở như link thường.
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
          return;
        e.preventDefault();
        open(panel, panelParams);
      }}
    />
  );
}
