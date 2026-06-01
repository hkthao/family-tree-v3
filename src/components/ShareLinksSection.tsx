import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import {
  IconCheck,
  IconCopy,
  IconPlus,
  IconTrash,
  IconUndo,
} from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queries/keys";
import {
  createShareLink,
  deleteShareLink,
  listShareLinks,
  revokeShareLink,
  type ShareLink,
} from "@/lib/queries/share-links";

interface Props {
  clanId: string;
}

const DEFAULT_TTL = 30;

export function ShareLinksSection({ clanId }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const qc = useQueryClient();
  const toast = useToast();

  const { data: links, isLoading } = useQuery({
    queryKey: queryKeys.shareLinks(clanId, userId),
    queryFn: () => listShareLinks(clanId),
    enabled: !!userId,
  });

  const [ttl, setTtl] = useState(String(DEFAULT_TTL));

  const createM = useMutation({
    mutationFn: () =>
      createShareLink({
        clan_id: clanId,
        ttlDays: Math.max(1, Math.min(365, Number(ttl) || DEFAULT_TTL)),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.shareLinks(clanId, userId) });
      toast.success("Đã tạo link chia sẻ");
    },
    onError: (e) =>
      toast.error("Không tạo được", { description: (e as Error).message }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="ttl">Số ngày link còn hiệu lực</Label>
          <Input
            id="ttl"
            type="number"
            min={1}
            max={365}
            value={ttl}
            onChange={(e) => setTtl(e.target.value)}
            className="max-w-[140px]"
          />
        </div>
        <Button
          onClick={() => createM.mutate()}
          disabled={createM.isPending || !ttl}
        >
          {createM.isPending ? (
            "Đang tạo…"
          ) : (
            <>
              <IconPlus className="h-4 w-4 mr-1.5" />
              Tạo link mới
            </>
          )}
        </Button>
      </div>

      {createM.error && (
        <Alert variant="destructive">
          <AlertDescription>{(createM.error as Error).message}</AlertDescription>
        </Alert>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Đang tải…</p>}

      {links && links.length === 0 && (
        <p className="text-sm text-muted-foreground">Chưa có link chia sẻ nào.</p>
      )}

      {links && links.length > 0 && (
        <ul className="space-y-3">
          {links.map((l) => (
            <ShareLinkItem key={l.id} link={l} clanId={clanId} userId={userId} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ShareLinkItem({
  link,
  clanId,
  userId,
}: {
  link: ShareLink;
  clanId: string;
  userId: string;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [copied, setCopied] = useState(false);

  const revokeM = useMutation({
    mutationFn: () => revokeShareLink(link.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.shareLinks(clanId, userId) });
      toast.success("Đã thu hồi link");
    },
    onError: (e) =>
      toast.error("Không thu hồi được", { description: (e as Error).message }),
  });
  const deleteM = useMutation({
    mutationFn: () => deleteShareLink(link.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.shareLinks(clanId, userId) });
      toast.success("Đã xoá link");
    },
    onError: (e) =>
      toast.error("Không xoá được", { description: (e as Error).message }),
  });

  const expired = new Date(link.expires_at) < new Date();
  const status = link.is_revoked
    ? { label: "Đã thu hồi", tone: "destructive" as const }
    : expired
      ? { label: "Đã hết hạn", tone: "muted" as const }
      : { label: "Hoạt động", tone: "accent" as const };

  const shareUrl = `${window.location.origin}/share/${link.token}`;

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — fall back to manual copy
    }
  }

  return (
    <li className="rounded-md border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span
          className={`text-xs font-medium ${
            status.tone === "destructive"
              ? "text-destructive"
              : status.tone === "muted"
                ? "text-muted-foreground"
                : "text-accent"
          }`}
        >
          {status.label}
        </span>
        <span className="text-xs text-muted-foreground">
          Hết hạn {new Date(link.expires_at).toLocaleDateString("vi-VN")}
        </span>
      </div>
      <div className="flex gap-2 items-stretch">
        <Input
          readOnly
          value={shareUrl}
          className="font-mono text-sm"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button size="sm" variant="outline" onClick={copyToClipboard}>
          {copied ? (
            <>
              <IconCheck className="h-4 w-4 mr-1.5" />
              Đã chép
            </>
          ) : (
            <>
              <IconCopy className="h-4 w-4 mr-1.5" />
              Chép
            </>
          )}
        </Button>
      </div>
      <div className="flex gap-2">
        {!link.is_revoked && !expired && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => revokeM.mutate()}
            disabled={revokeM.isPending}
          >
            <IconUndo className="h-4 w-4 mr-1.5" />
            Thu hồi
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="text-destructive"
          onClick={async () => {
            const ok = await confirm({
              title: "Xoá link này vĩnh viễn?",
              description: "Sau khi xoá không khôi phục lại được.",
              confirmLabel: "Xoá",
              destructive: true,
            });
            if (ok) deleteM.mutate();
          }}
          disabled={deleteM.isPending}
        >
          <IconTrash className="h-4 w-4 mr-1.5" />
          Xoá
        </Button>
      </div>
    </li>
  );
}
