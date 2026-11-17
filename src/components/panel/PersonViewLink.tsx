import { Link, type LinkProps } from "react-router-dom";

import { PanelLink } from "./PanelLink";

/**
 * Link tới một người. Đang hiện trong ngăn kéo (`inPanel`) thì bấm mở ngăn kéo xem người đó (không rời trang đang
 * xem phía sau); ngoài ngăn kéo là link trang thường.
 */
export function PersonViewLink({ inPanel, personId, ...rest }: LinkProps & { inPanel: boolean; personId: string }) {
  if (inPanel) return <PanelLink {...rest} panel="person-view" panelParams={{ pid: personId }} />;
  return <Link {...rest} />;
}
