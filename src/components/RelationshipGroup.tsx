import type { ComponentProps } from "react";
import { Link } from "react-router-dom";

import { IconChevronDown, IconChevronUp, IconX } from "@/components/icons";
import { PersonAvatar } from "@/components/PersonAvatar";
import type { Relationship } from "@/lib/queries/families";

import { t } from "@lingui/core/macro";
export type PersonLinkComponent = (
  props: ComponentProps<typeof Link> & { personId: string },
) => JSX.Element;

/** Mặc định: link route thường tới trang người đó. */
function DefaultPersonLink({
  personId: _personId,
  ...rest
}: ComponentProps<typeof Link> & { personId: string }) {
  return <Link {...rest} />;
}

/** Một nhóm người thân (cha mẹ / vợ chồng / con) kèm nút hành động của nhóm. */
export function RelationshipGroup({
  label,
  items,
  clanId,
  emptyHint,
  action,
  reorder,
  onRemove,
  photoUrls,
  LinkComponent = DefaultPersonLink,
}: {
  label: string;
  items: Relationship[];
  clanId: string;
  /** photo_path → URL đã ký; thiếu thì vẽ hình minh hoạ theo giới tính. */
  photoUrls?: Map<string, string>;
  emptyHint: string;
  action?: React.ReactNode;
  /** Có → mỗi dòng có nút gỡ liên kết (nhập nhầm); người không bị xoá khỏi dòng họ. */
  onRemove?: (rel: Relationship) => void;
  /** When set, renders ↑/↓ controls to re-rank the list (vợ cả/hai/ba).
   *  `onMove(index, dir)` swaps the item with its neighbour. */
  reorder?: {
    onMove: (index: number, dir: -1 | 1) => void;
    busy?: boolean;
  };
  /** Cách dựng link tới người thân (trang: route; ngăn kéo: mở ngăn kéo xem người đó). */
  LinkComponent?: PersonLinkComponent;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{label}</h3>
        {action}
      </div>
      {reorder && (
        <p className="text-xs text-muted-foreground">
          {t`Dùng mũi tên để xếp thứ tự (vợ cả lên trên cùng).`}
        </p>
      )}
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
          {emptyHint}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((r, index) => (
            <li key={r.id} className="flex items-stretch gap-1.5">
              <LinkComponent
                to={`/clans/${clanId}/people/${r.id}`}
                personId={r.id}
                className="flex flex-1 min-w-0 items-center gap-3 rounded-md border bg-card px-3 py-2 hover:border-primary transition-colors"
              >
                <PersonAvatar
                  gender={r.gender}
                  photoUrl={
                    r.photo_path ? (photoUrls?.get(r.photo_path) ?? null) : null
                  }
                  size={40}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{r.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {r.gender === "M" ? t`Nam` : t`Nữ`}
                    {!r.is_living &&
                      t` · đã mất${r.death_date ? ` ${r.death_date.slice(0, 4)}` : ""}`}
                    {r.is_living &&
                      r.birth_date &&
                      t` · sinh ${r.birth_date.slice(0, 4)}`}
                  </p>
                </div>
                {!reorder && (
                  <span
                    className="text-muted-foreground shrink-0"
                    aria-hidden="true"
                  >
                    ›
                  </span>
                )}
              </LinkComponent>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(r)}
                  aria-label={t`Gỡ liên kết với ${r.full_name}`}
                  title={t`Gỡ liên kết (nhập nhầm)`}
                  className="flex w-9 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground hover:text-destructive hover:border-destructive"
                >
                  <IconX className="h-4 w-4" />
                </button>
              )}
              {reorder && (
                <div className="flex flex-col justify-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => reorder.onMove(index, -1)}
                    disabled={index === 0 || reorder.busy}
                    aria-label={t`Đưa ${r.full_name} lên`}
                    title={t`Lên`}
                    className="flex h-7 w-8 items-center justify-center rounded-md border bg-card text-muted-foreground hover:text-foreground hover:border-primary disabled:opacity-30 disabled:hover:border-input"
                  >
                    <IconChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => reorder.onMove(index, 1)}
                    disabled={index === items.length - 1 || reorder.busy}
                    aria-label={t`Đưa ${r.full_name} xuống`}
                    title={t`Xuống`}
                    className="flex h-7 w-8 items-center justify-center rounded-md border bg-card text-muted-foreground hover:text-foreground hover:border-primary disabled:opacity-30 disabled:hover:border-input"
                  >
                    <IconChevronDown className="h-4 w-4" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
