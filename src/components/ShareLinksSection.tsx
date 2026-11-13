import { currentIntlTag } from "@/lib/i18n";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { useConfirm } from "@/components/ConfirmDialog";
import { QrCodeModal } from "@/components/QrCodeModal";
import { useToast } from "@/components/Toast";
import {
  IconCheck,
  IconClock,
  IconCopy,
  IconLink,
  IconPlus,
  IconQrCode,
  IconTrash,
  IconUndo,
} from "@/components/icons";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queries/keys";
import {
  createShareLink,
  deleteShareLink,
  listShareLinksPage,
  revokeShareLink,
  type ShareLink,
} from "@/lib/queries/share-links";
import { supabase } from "@/lib/supabase";

import { t } from "@lingui/core/macro";
interface Props {
  clanId: string;
}

const DEFAULT_TTL = 30;
const PAGE_SIZE = 15;

export function ShareLinksSection({ clanId }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const qc = useQueryClient();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const params = { page, pageSize: PAGE_SIZE };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.shareLinksPage(clanId, userId, params),
    queryFn: () => listShareLinksPage(clanId, params),
    enabled: !!userId,
    placeholderData: keepPreviousData,
  });

  const links = data?.rows;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Resolve names for the focal person of each personal QR link, so the
  // list shows "QR cá nhân · Nguyễn Văn A" instead of a bare token.
  const personIds = useMemo(
    () =>
      Array.from(
        new Set(
          (links ?? [])
            .filter((l) => l.scope === "single_person" && l.root_person_id)
            .map((l) => l.root_person_id as string),
        ),
      ),
    [links],
  );
  const { data: personNames } = useQuery({
    queryKey: [
      "share-link-person-names",
      clanId,
      personIds.slice().sort().join(","),
    ],
    queryFn: async () => {
      if (personIds.length === 0) return new Map<string, string>();
      const { data, error } = await supabase
        .from("persons")
        .select("id, full_name")
        .in("id", personIds);
      if (error) throw new Error(error.message);
      return new Map(
        (data ?? []).map((p) => [p.id as string, p.full_name as string]),
      );
    },
    enabled: personIds.length > 0,
  });

  const [ttl, setTtl] = useState(String(DEFAULT_TTL));

  function invalidateAllPages() {
    qc.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        q.queryKey[0] === "share-links-page" &&
        q.queryKey[1] === clanId,
    });
  }

  const createM = useMutation({
    mutationFn: () =>
      createShareLink({
        clan_id: clanId,
        ttlDays: Math.max(1, Math.min(365, Number(ttl) || DEFAULT_TTL)),
      }),
    onSuccess: () => {
      setPage(1);
      invalidateAllPages();
      toast.success(t`Đã tạo link chia sẻ`);
    },
    onError: (e) =>
      toast.error(t`Không tạo được`, { description: (e as Error).message }),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ttl">{t`Hiệu lực (ngày)`}</Label>
          <Input
            id="ttl"
            icon={<IconClock />}
            type="number"
            min={1}
            max={365}
            value={ttl}
            onChange={(e) => setTtl(e.target.value)}
            className="h-10 w-[120px]"
          />
        </div>
        <Button
          size="sm"
          onClick={() => createM.mutate()}
          disabled={createM.isPending || !ttl}
        >
          {createM.isPending ? (
            t`Đang tạo…`
          ) : (
            <>
              <IconPlus className="h-4 w-4 mr-1.5" />
              {t`Tạo link mới`}
            </>
          )}
        </Button>
      </div>

      {createM.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {(createM.error as Error).message}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t`Đang tải…`}</p>
      ) : links && links.length === 0 ? (
        <EmptyState
          icon={<IconLink className="h-10 w-10" />}
          title={t`Chưa có link chia sẻ`}
          description={t`Bấm “Tạo link mới” để tạo link công khai cho cây gia phả.`}
        />
      ) : links && links.length > 0 ? (
        <ul className="divide-y border-t">
          {links.map((l) => (
            <ShareLinkItem
              key={l.id}
              link={l}
              clanId={clanId}
              onChanged={invalidateAllPages}
              personName={
                l.root_person_id
                  ? (personNames?.get(l.root_person_id) ?? null)
                  : null
              }
            />
          ))}
        </ul>
      ) : null}

      {total > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={PAGE_SIZE}
          unit="link"
          isFetching={isFetching}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

function ShareLinkItem({
  link,
  clanId,
  onChanged,
  personName,
}: {
  link: ShareLink;
  clanId: string;
  onChanged: () => void;
  personName: string | null;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  // Drop the stale-link compile-time check: ESLint won't catch this prop
  // anyway, and reusing onChanged keeps the parent in charge of cache.
  void clanId;

  const revokeM = useMutation({
    mutationFn: () => revokeShareLink(link.id),
    onSuccess: () => {
      onChanged();
      toast.success(t`Đã thu hồi link`);
    },
    onError: (e) =>
      toast.error(t`Không thu hồi được`, { description: (e as Error).message }),
  });
  const deleteM = useMutation({
    mutationFn: () => deleteShareLink(link.id),
    onSuccess: () => {
      onChanged();
      toast.success(t`Đã xoá link`);
    },
    onError: (e) =>
      toast.error(t`Không xoá được`, { description: (e as Error).message }),
  });

  const expired = new Date(link.expires_at) < new Date();
  const status = link.is_revoked
    ? { label: t`Đã thu hồi`, tone: "destructive" as const }
    : expired
      ? { label: t`Đã hết hạn`, tone: "muted" as const }
      : { label: t`Hoạt động`, tone: "accent" as const };

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

  const isPersonScope = link.scope === "single_person";
  const scopeLabel = isPersonScope
    ? t`QR cá nhân · ${personName ?? "—"}`
    : t`Link cây gia phả`;

  const active = !link.is_revoked && !expired;
  return (
    <li className="py-2.5 space-y-1.5">
      <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap text-xs">
        <span
          className={`font-medium ${
            status.tone === "destructive"
              ? "text-destructive"
              : status.tone === "muted"
                ? "text-muted-foreground"
                : "text-accent"
          }`}
        >
          {status.label}
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="font-medium text-foreground">{scopeLabel}</span>
        <span className="text-muted-foreground">
          · hết hạn {new Date(link.expires_at).toLocaleDateString(currentIntlTag())}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Input
          readOnly
          icon={<IconLink />}
          value={shareUrl}
          className="h-10 font-mono text-xs flex-1"
          onFocus={(e) => e.currentTarget.select()}
          action={
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={copyToClipboard}
              aria-label={copied ? t`Đã chép` : t`Chép link`}
              title={copied ? t`Đã chép` : t`Chép link`}
              className="h-10 w-10"
            >
              {copied ? (
                <IconCheck className="h-4 w-4" />
              ) : (
                <IconCopy className="h-4 w-4" />
              )}
            </Button>
          }
        />
        {active && (
          <>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => setQrOpen(true)}
              aria-label={t`Hiện mã QR`}
              title={t`Hiện mã QR`}
              className="h-10 w-10 shrink-0"
            >
              <IconQrCode className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => revokeM.mutate()}
              disabled={revokeM.isPending}
              aria-label={t`Thu hồi link`}
              title={t`Thu hồi link`}
              className="h-10 w-10 shrink-0"
            >
              <IconUndo className="h-4 w-4" />
            </Button>
          </>
        )}
        <Button
          type="button"
          size="icon"
          variant="destructive-outline"
          aria-label={t`Xoá link`}
          title={t`Xoá link`}
          className="h-10 w-10 shrink-0"
          onClick={async () => {
            const ok = await confirm({
              title: t`Xoá link này vĩnh viễn?`,
              description: t`Sau khi xoá không khôi phục lại được.`,
              confirmLabel: t`Xoá`,
              destructive: true,
            });
            if (ok) deleteM.mutate();
          }}
          disabled={deleteM.isPending}
        >
          <IconTrash className="h-4 w-4" />
        </Button>
      </div>
      <QrCodeModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        url={shareUrl}
        title={
          isPersonScope
            ? t`QR · ${personName ?? "Trang cá nhân"}`
            : t`Quét để xem cây gia phả`
        }
        description={
          isPersonScope
            ? t`Quét để mở trang cá nhân (chỉ-đọc). Có thể in lên bia, sổ gia phả, danh thiếp.`
            : t`Mở camera điện thoại, hướng vào mã QR. Link sẽ mở trang xem chỉ-đọc.`
        }
      />
    </li>
  );
}
