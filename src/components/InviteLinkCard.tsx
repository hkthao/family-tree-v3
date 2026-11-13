import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { IconLink, IconShare2, IconTrash } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createClanInvite,
  listClanInvites,
  revokeClanInvite,
  type InviteRole,
} from "@/lib/queries/clan-invites";

import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { msg } from "@lingui/core/macro";
import { lazyMessages } from "@/lib/i18n/lazy";
const ROLE_LABEL: Record<InviteRole, string> = lazyMessages({
  viewer: msg`Xem & góp ý`,
  editor: msg`Biên tập`,
}) as Record<InviteRole, string>;
const ROLE_DESC: Record<InviteRole, string> = lazyMessages({
  viewer: msg`Xem cây + đề xuất bổ sung (bạn duyệt mới vào cây). An toàn nhất.`,
  editor: msg`Sửa cây trực tiếp. Dùng cho người thân tin cậy.`,
}) as Record<InviteRole, string>;

/**
 * Mời bằng LINK — admin tạo 1 link dùng nhiều lần (chọn quyền), gửi vào
 * nhóm họ Zalo/Facebook. Người thân bấm vào → đăng nhập → tự tham gia.
 */
export function InviteLinkCard({
  clanId,
  clanName,
}: {
  clanId: string;
  clanName: string;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [role, setRole] = useState<InviteRole>("viewer");

  const key = ["clan-invites", clanId];
  const { data: invites } = useQuery({
    queryKey: key,
    queryFn: () => listClanInvites(clanId),
  });

  const createM = useMutation({
    mutationFn: () => createClanInvite(clanId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success(t`Đã tạo link mời`);
    },
    onError: (e) =>
      toast.error(t`Không tạo được`, { description: (e as Error).message }),
  });
  const revokeM = useMutation({
    mutationFn: (id: string) => revokeClanInvite(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success(t`Đã thu hồi link`);
    },
    onError: (e) =>
      toast.error(t`Không thu hồi được`, { description: (e as Error).message }),
  });

  const urlFor = (token: string) => `${window.location.origin}/join/${token}`;
  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(urlFor(token));
      toast.success(t`Đã chép link — dán vào nhóm họ Zalo/Facebook để mời.`);
    } catch {
      toast.error(t`Không chép được link`);
    }
  }
  async function share(token: string) {
    const url = urlFor(token);
    const text = t`Mời bạn tham gia gia phả dòng họ ${clanName}`;
    const nav = navigator as Navigator & {
      share?: (d: unknown) => Promise<void>;
    };
    if (nav.share) {
      try {
        await nav.share({ title: clanName, text, url });
      } catch {
        /* người dùng huỷ — bỏ qua */
      }
    } else {
      copy(token);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t`Mời bằng link`}</CardTitle>
        <CardDescription>
          <Trans>
            <Trans>
              <Trans>
                Tạo 1 link gửi vào nhóm họ (Zalo/Facebook). Người thân bấm vào,
                đăng nhập là tham gia được — không cần biết trước hay đăng ký
                sẵn.
              </Trans>
            </Trans>
          </Trans>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-base font-medium mb-1">{t`Quyền khi tham gia`}</legend>
          {(["viewer", "editor"] as InviteRole[]).map((r) => (
            <label key={r} className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                checked={role === r}
                onChange={() => setRole(r)}
                className="mt-1 h-5 w-5 accent-primary shrink-0"
              />
              <div>
                <p className="font-medium">{ROLE_LABEL[r]}</p>
                <p className="text-sm text-muted-foreground">{ROLE_DESC[r]}</p>
              </div>
            </label>
          ))}
        </fieldset>

        {invites && invites.length > 0 && (
          <ul className="space-y-2 pt-1">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center gap-2 rounded-md border p-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    <Trans>
                    {ROLE_LABEL[inv.role]}{" "}
                    <span className="text-muted-foreground font-normal">
                      · {inv.use_count} lượt tham gia
                    </span>
                    </Trans>
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {urlFor(inv.token)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0 shrink-0"
                  aria-label={t`Chép link`}
                  title={t`Chép link`}
                  onClick={() => copy(inv.token)}
                >
                  <IconLink className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0 shrink-0"
                  aria-label={t`Chia sẻ link`}
                  title={t`Chia sẻ link`}
                  onClick={() => share(inv.token)}
                >
                  <IconShare2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="destructive-outline"
                  size="sm"
                  className="h-9 w-9 p-0 shrink-0"
                  aria-label={t`Thu hồi link`}
                  title={t`Thu hồi link`}
                  disabled={revokeM.isPending}
                  onClick={() => revokeM.mutate(inv.id)}
                >
                  <IconTrash className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter className="justify-end border-t pt-4">
        <Button
          type="button"
          onClick={() => createM.mutate()}
          disabled={createM.isPending}
        >
          <IconLink className="h-4 w-4 mr-1.5" />
          {createM.isPending ? t`Đang tạo…` : t`Tạo link mời`}
        </Button>
      </CardFooter>
    </Card>
  );
}
