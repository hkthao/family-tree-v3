import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Fab, FAB_POSITION } from "@/components/Fab";
import { IconPlus, IconX } from "@/components/icons";
import { PanelLink } from "@/components/panel/PanelLink";
import type { PanelId, PanelParams } from "@/components/panel/usePanel";

import { t } from "@lingui/core/macro";
export interface FabAction {
  label: string;
  icon: ReactNode;
  to?: string;
  onClick?: () => void;
  panel?: { id: PanelId; params?: PanelParams };
  testId?: string;
}

/**
 * Nhóm nút nổi: màn hình có từ 2 hành động trở lên dùng cái này thay vì xếp
 * nhiều nút nổi. Bấm nút chính (+) sổ các nút chức năng lên phía trên, mỗi nút
 * có nhãn; bấm ra ngoài, Esc hoặc chọn một hành động thì thu lại. Hành động đầu
 * tiên là hành động chính (hiện đầu tiên, sát nút +).
 */
export function FabGroup({
  actions,
  label = t`Thêm`,
}: {
  actions: FabAction[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const single = actions.length === 1 ? actions[0] : null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (single) {
    return (
      <Fab
        to={single.to}
        onClick={single.onClick}
        panel={single.panel}
        label={single.label}
        icon={single.icon}
        testId={single.testId}
      />
    );
  }

  const itemCls =
    "inline-flex h-11 items-center gap-2 rounded-full border bg-card pl-3 pr-4 text-sm font-medium text-foreground shadow-md hover:border-primary";

  return (
    <>
      {open && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={t`Đóng`}
          onClick={() => setOpen(false)}
          className="print-hide fixed inset-0 z-30 cursor-default bg-black/30 animate-in fade-in"
        />
      )}
      <div className={`${FAB_POSITION} flex flex-col items-end gap-2`}>
        {open && (
          <ul
            className="flex flex-col-reverse items-end gap-2 animate-in fade-in slide-in-from-bottom-2"
            role="menu"
            aria-label={label}
          >
            {actions.map((a) => {
              const content = (
                <>
                  <span
                    className="text-primary [&>svg]:h-5 [&>svg]:w-5"
                    aria-hidden="true"
                  >
                    {a.icon}
                  </span>
                  {a.label}
                </>
              );
              const close = () => setOpen(false);
              return (
                <li key={a.label} role="none">
                  {a.to && a.panel ? (
                    <PanelLink
                      to={a.to}
                      panel={a.panel.id}
                      panelParams={a.panel.params}
                      role="menuitem"
                      data-testid={a.testId}
                      className={itemCls}
                      onClick={close}
                    >
                      {content}
                    </PanelLink>
                  ) : a.to ? (
                    <Link
                      to={a.to}
                      role="menuitem"
                      data-testid={a.testId}
                      className={itemCls}
                      onClick={close}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      data-testid={a.testId}
                      className={itemCls}
                      onClick={() => {
                        close();
                        a.onClick?.();
                      }}
                    >
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={open ? t`Đóng` : label}
          title={label}
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {open ? (
            <IconX className="h-6 w-6" />
          ) : (
            <IconPlus className="h-6 w-6" />
          )}
        </button>
      </div>
    </>
  );
}
