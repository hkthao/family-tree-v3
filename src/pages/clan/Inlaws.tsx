import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { Fab } from "@/components/Fab";
import { Breadcrumb } from "@/components/Breadcrumb";
import { PageHeader } from "@/components/PageHeader";
import { useConfirm } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import {
  IconCheck,
  IconCopy,
  IconLink,
  IconPlus,
  IconTrash,
  IconUndo,
  IconUser,
} from "@/components/icons";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SegmentedButton,
  SegmentedControl,
} from "@/components/ui/segmented-control";
import { useAuth } from "@/hooks/useAuth";
import { isClanAdmin, useClanContext } from "@/hooks/useClanContext";
import { track } from "@/lib/analytics";
import { queryKeys } from "@/lib/queries/keys";
import {
  acceptLinkDirect,
  deletePendingLink,
  getInlawProposalPreview,
  listLinksForClan,
  notifyInlaw,
  peekLink,
  revokeLink,
  type InlawProposalPreview,
  isInlawCacheKey,
  linkTypeFromSide,
  type LinkPeek,
  type PersonLink,
} from "@/lib/queries/person-links";
import { supabase } from "@/lib/supabase";
import { useUrlState } from "@/hooks/useUrlState";

import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
/**
 * Cross-clan in-law links manager. Two tabs:
 *   - Đã liên kết (confirmed): show both sides with a peek of the
 *     peer person, plus a revoke action.
 *   - Đang chờ (pending): tokens admin A has generated, ready to share
 *     out-of-band. Copy / open-link / cancel actions.
 *
 * Read-only sub-views for non-admin members are not implemented yet —
 * an admin gate at the top redirects everyone else away.
 */
export default function Inlaws() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  if (!isClanAdmin(clan)) {
    return <Navigate to={`/clans/${clan.id}`} replace />;
  }

  const [tabRaw, setTab] = useUrlState("tab", "confirmed");
  const tab: "confirmed" | "pending" =
    tabRaw === "pending" ? "pending" : "confirmed";

  const { data: links, isLoading } = useQuery({
    queryKey: queryKeys.personLinksForClan(clan.id, userId),
    queryFn: () => listLinksForClan(clan.id, undefined, "all"),
    enabled: !!userId,
  });

  const confirmed = useMemo(
    () => (links ?? []).filter((l) => l.status === "confirmed"),
    [links],
  );
  // Outgoing pending = we're the proposer (A side). These show the
  // invite URL (token mode) or peer hint (direct mode).
  const pendingOutgoing = useMemo(
    () =>
      (links ?? []).filter(
        (l) => l.status === "pending" && l.clan_a_id === clan.id,
      ),
    [links, clan.id],
  );
  // Incoming pending = direct-mode invite from another clan. Only
  // possible in public-discovery mode (clan_b_id set at propose
  // time). Token-mode pendings have clan_b_id NULL, so they never
  // appear in B's list until they confirm.
  const pendingIncoming = useMemo(
    () =>
      (links ?? []).filter(
        (l) => l.status === "pending" && l.clan_b_id === clan.id,
      ),
    [links, clan.id],
  );
  const pendingTotal = pendingOutgoing.length + pendingIncoming.length;

  const revokeM = useMutation({
    mutationFn: (id: string) => revokeLink(id),
    onSuccess: (_void, id) => {
      qc.invalidateQueries({ predicate: (q) => isInlawCacheKey(q.queryKey) });
      track("inlaw_revoked");
      toast.success(t`Đã thu hồi liên kết`);
      // Fire-and-forget — both sides get an email so the side that
      // didn't revoke learns the link is gone.
      notifyInlaw(id);
    },
    onError: (e) =>
      toast.error(t`Không thu hồi được`, { description: (e as Error).message }),
  });

  const cancelM = useMutation({
    mutationFn: (id: string) => deletePendingLink(id),
    onSuccess: () => {
      qc.invalidateQueries({ predicate: (q) => isInlawCacheKey(q.queryKey) });
      toast.success(t`Đã huỷ đề nghị`);
    },
    onError: (e) =>
      toast.error(t`Không huỷ được`, { description: (e as Error).message }),
  });

  // Incoming-pending actions
  const acceptM = useMutation({
    mutationFn: (id: string) => acceptLinkDirect(id),
    onSuccess: (_void, id) => {
      qc.invalidateQueries({ predicate: (q) => isInlawCacheKey(q.queryKey) });
      track("inlaw_confirmed");
      toast.success(t`Đã xác nhận liên kết`);
      notifyInlaw(id);
    },
    onError: (e) =>
      toast.error(t`Không xác nhận được`, {
        description: (e as Error).message,
      }),
  });
  const rejectM = useMutation({
    mutationFn: (id: string) => revokeLink(id),
    onSuccess: (_void, id) => {
      qc.invalidateQueries({ predicate: (q) => isInlawCacheKey(q.queryKey) });
      toast.success(t`Đã từ chối đề nghị`);
      notifyInlaw(id);
    },
    onError: (e) =>
      toast.error(t`Không từ chối được`, { description: (e as Error).message }),
  });

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: t`Liên kết dòng họ` },
        ]}
      />

      <PageHeader
        icon={<IconLink className="h-7 w-7" />}
        title={t`Liên kết dòng họ`}
        description={t`Nối dòng họ này với dòng họ khác qua một thành viên: thông gia, tổ tiên – hậu duệ, họ hàng. Quyền sở hữu mỗi bên không đổi — link chỉ là chú thích, có thể thu hồi.`}
        actionsBelow
        actions={
          <Fab
            to={`/clans/${clan.id}/inlaws/new`}
            panel={{ id: "inlaw-new" }}
            label={t`Đề nghị mới`}
          />
        }
      />

      <SegmentedControl ariaLabel={t`Tab trạng thái`}>
        <SegmentedButton
          active={tab === "confirmed"}
          onClick={() => setTab("confirmed")}
        >
          {t`Đã liên kết (${confirmed.length})`}
        </SegmentedButton>
        <SegmentedButton
          active={tab === "pending"}
          onClick={() => setTab("pending")}
        >
          {t`Đang chờ (${pendingTotal})`}
        </SegmentedButton>
      </SegmentedControl>

      {isLoading && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-muted-foreground">{t`Đang tải…`}</p>
        </div>
      )}

      {tab === "confirmed" &&
        !isLoading &&
        (confirmed.length === 0 ? (
          <EmptyState
            icon={<IconLink className="h-10 w-10" />}
            title={t`Chưa có liên kết nào`}
            description={t`Nối với dòng họ khác (thông gia, cùng tổ tiên, họ hàng) để tra cứu 2 chiều.`}
          />
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
            {confirmed.map((l) => (
              <ConfirmedRow
                key={l.id}
                link={l}
                clanId={clan.id}
                userId={userId}
                onRevoke={async () => {
                  const ok = await confirm({
                    title: t`Thu hồi liên kết?`,
                    description: t`Sau khi thu hồi, không bên nào còn thấy link này. Có thể tạo lại sau.`,
                    confirmLabel: t`Thu hồi`,
                    destructive: true,
                  });
                  if (ok) revokeM.mutate(l.id);
                }}
                revoking={revokeM.isPending}
              />
            ))}
          </ul>
        ))}

      {tab === "pending" && !isLoading && pendingTotal === 0 && (
        <EmptyState
          icon={<IconLink className="h-10 w-10" />}
          title={t`Không có đề nghị nào đang chờ`}
          description={t`Bấm “Đề nghị mới” để gửi mã mời hoặc đề nghị thẳng tới một dòng họ công khai.`}
          primary={{
            label: t`Đề nghị mới`,
            to: `/clans/${clan.id}/inlaws/new`,
            panel: { id: "inlaw-new" },
            icon: <IconPlus className="h-4 w-4 mr-1.5" />,
          }}
        />
      )}

      {tab === "pending" && !isLoading && pendingIncoming.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-primary">
            <Trans>
            Đề nghị đến với bạn ({pendingIncoming.length})
            </Trans>
          </h3>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
            {pendingIncoming.map((l) => (
              <IncomingPendingRow
                key={l.id}
                link={l}
                onAccept={async () => {
                  const ok = await confirm({
                    title: t`Xác nhận liên kết này?`,
                    description: t`Cả hai bên sẽ thấy liên kết trên card người. Có thể thu hồi sau.`,
                    confirmLabel: t`Xác nhận`,
                  });
                  if (ok) acceptM.mutate(l.id);
                }}
                onReject={async () => {
                  const ok = await confirm({
                    title: t`Từ chối đề nghị này?`,
                    description: t`Bên đề nghị sẽ thấy đề nghị đã bị thu hồi. Họ có thể đề nghị lại nếu cần.`,
                    confirmLabel: t`Từ chối`,
                    destructive: true,
                  });
                  if (ok) rejectM.mutate(l.id);
                }}
                busy={acceptM.isPending || rejectM.isPending}
              />
            ))}
          </ul>
        </section>
      )}

      {tab === "pending" && !isLoading && pendingOutgoing.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            <Trans>
            Đề nghị tôi đã gửi ({pendingOutgoing.length})
            </Trans>
          </h3>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
            {pendingOutgoing.map((l) => (
              <PendingRow
                key={l.id}
                link={l}
                clanId={clan.id}
                onCancel={async () => {
                  const ok = await confirm({
                    title: t`Huỷ đề nghị này?`,
                    description: t`Mã mời sẽ không dùng được nữa. Có thể tạo mã mới.`,
                    confirmLabel: t`Huỷ đề nghị`,
                    destructive: true,
                  });
                  if (ok) cancelM.mutate(l.id);
                }}
                canceling={cancelM.isPending}
              />
            ))}
          </ul>
        </section>
      )}

      {(revokeM.error || cancelM.error || acceptM.error || rejectM.error) && (
        <Alert variant="destructive">
          <AlertDescription>
            {
              (
                (revokeM.error ??
                  cancelM.error ??
                  acceptM.error ??
                  rejectM.error) as Error
              ).message
            }
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// ─── Confirmed row ───────────────────────────────────────────────────

function ConfirmedRow({
  link,
  clanId,
  userId,
  onRevoke,
  revoking,
}: {
  link: PersonLink;
  clanId: string;
  userId: string;
  onRevoke: () => void;
  revoking: boolean;
}) {
  const localPersonId =
    link.clan_a_id === clanId ? link.person_a_id : link.person_b_id;

  // Person names — we already have RLS-allowed access to our own clan's
  // persons; the peer name comes through get_link_peek (security
  // definer). Fetch both in parallel.
  const { data: localPerson } = useQuery({
    queryKey: ["person-link-local-name", localPersonId, userId],
    queryFn: async () => {
      if (!localPersonId) return null;
      const { data, error } = await supabase
        .from("persons")
        .select("id, full_name, gender")
        .eq("id", localPersonId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!localPersonId,
  });
  const { data: peek } = useQuery({
    queryKey: queryKeys.personLinkPeek(link.id, userId),
    queryFn: () => peekLink(link.id),
    enabled: !!userId,
  });

  return (
    <li className="p-3 space-y-3">
      {/* Identity — full row width so long Vietnamese names don't
          wrap character-per-line when squeezed by sibling buttons. */}
      <div className="text-sm min-w-0">
        <p className="mb-1">
          <span className="inline-flex rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary">
            {linkTypeFromSide(link.link_type, link.clan_a_id === clanId)}
          </span>
        </p>
        <p className="font-medium">
          {localPerson?.full_name ?? "—"}{" "}
          <span className="text-muted-foreground">↔</span>{" "}
          {peek?.full_name ?? t`(người bên kia)`}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {peek ? <PeekMeta peek={peek} /> : t`Đang tải…`}
        </p>
      </div>
      {/* Actions — 50/50 split on mobile, hug content on sm+. */}
      <div className="flex gap-2 flex-wrap">
        {peek && !peek.masked && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none"
          >
            <Link to={`/clans/${peek.clan_id}/people/${peek.person_id}`}>
              <IconUser className="h-4 w-4 mr-1.5" />
              Xem trang
            </Link>
          </Button>
        )}
        <Button
          variant="destructive-outline"
          size="sm"
          className="flex-1 sm:flex-none"
          onClick={onRevoke}
          disabled={revoking}
        >
          <IconUndo className="h-4 w-4 mr-1.5" />
          {t`Thu hồi`}
        </Button>
      </div>
    </li>
  );
}

function PeekMeta({ peek }: { peek: LinkPeek }) {
  if (peek.masked) {
    return (
      <>
        <span className="text-foreground">{peek.clan_name}</span> · Người còn
        sống, dòng họ này chưa công khai
      </>
    );
  }
  const lifespan =
    peek.birth_year && peek.death_year
      ? `${peek.birth_year}–${peek.death_year}`
      : peek.birth_year
        ? t`sinh ${peek.birth_year}`
        : peek.death_year
          ? t`mất ${peek.death_year}`
          : "—";
  return (
    <>
      <span className="text-foreground">{peek.clan_name}</span> ·{" "}
      {peek.gender === "M" ? t`Nam` : t`Nữ`}
      {peek.generation !== null && peek.generation !== undefined
        ? t` · Đời ${peek.generation - (peek.generation_offset ?? 0)}`
        : ""}{" "}
      · {lifespan}
    </>
  );
}

// ─── Pending row ─────────────────────────────────────────────────────

// ─── Incoming pending row (direct-mode proposal from another clan) ──

function IncomingPendingRow({
  link,
  onAccept,
  onReject,
  busy,
}: {
  link: PersonLink;
  onAccept: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const { data: preview } = useQuery<InlawProposalPreview>({
    queryKey: ["inlaw-proposal-preview", link.id],
    queryFn: () => getInlawProposalPreview(link.id),
  });

  // Local person name comes from a normal SELECT — admin B is a
  // member of clan_b, so RLS lets them read their own clan's persons.
  const localPersonId = link.person_b_id;
  const { data: localPerson } = useQuery({
    queryKey: ["inlaw-local-person", localPersonId],
    queryFn: async () => {
      if (!localPersonId) return null;
      const { data, error } = await supabase
        .from("persons")
        .select("full_name")
        .eq("id", localPersonId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!localPersonId,
  });

  const lifespan =
    preview && preview.person_a_birth_year && preview.person_a_death_year
      ? `${preview.person_a_birth_year}–${preview.person_a_death_year}`
      : preview?.person_a_birth_year
        ? t`sinh ${preview.person_a_birth_year}`
        : preview?.person_a_death_year
          ? t`mất ${preview.person_a_death_year}`
          : "";

  return (
    <li className="p-3 space-y-2">
      <div className="text-sm space-y-1">
        <p>
          <span className="text-muted-foreground">Từ </span>
          <span className="font-semibold">{preview?.clan_a_name ?? "…"}</span>
          {link.link_type !== "same_person" && (
            <span className="ml-2 inline-flex rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary">
              {linkTypeFromSide(link.link_type, false)}
            </span>
          )}
        </p>
        <p>
          <span className="text-muted-foreground">Người bên họ: </span>
          <span className="font-medium">{preview?.person_a_name ?? "…"}</span>
          {preview && (
            <span className="text-xs text-muted-foreground ml-1">
              ({preview.person_a_gender === "M" ? t`Nam` : t`Nữ`}
              {lifespan ? ` · ${lifespan}` : ""})
            </span>
          )}
        </p>
        <p>
          <span className="text-muted-foreground">Đề nghị nối với: </span>
          <span className="font-medium">{localPerson?.full_name ?? "…"}</span>
        </p>
        {preview?.note && (
          <p className="text-xs text-muted-foreground italic">
            "{preview.note}"
          </p>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          onClick={onAccept}
          disabled={busy}
          className="flex-1 sm:flex-none"
        >
          <IconCheck className="h-4 w-4 mr-1.5" />
          {t`Xác nhận`}
        </Button>
        <Button
          size="sm"
          variant="destructive-outline"
          className="flex-1 sm:flex-none"
          onClick={onReject}
          disabled={busy}
        >
          <IconUndo className="h-4 w-4 mr-1.5" />
          {t`Từ chối`}
        </Button>
      </div>
    </li>
  );
}

function PendingRow({
  link,
  clanId,
  onCancel,
  canceling,
}: {
  link: PersonLink;
  clanId: string;
  onCancel: () => void;
  canceling: boolean;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const localPersonId = link.person_a_id;
  const { data: localPerson } = useQuery({
    queryKey: ["person-link-local-name", localPersonId, clanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("persons")
        .select("id, full_name")
        .eq("id", localPersonId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const confirmUrl = `${window.location.origin}/inlaws/confirm/${link.invite_token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(confirmUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(t`Đã chép link mời`);
    } catch {
      toast.error(t`Không chép được — hãy chọn và copy thủ công`);
    }
  }

  return (
    <li className="p-3 space-y-3">
      <div className="text-sm min-w-0">
        <p className="font-medium">{localPerson?.full_name ?? "—"}</p>
        {link.person_b_name_hint && (
          <p className="text-xs text-muted-foreground mt-0.5">
            <Trans>
            Gợi ý người bên kia: {link.person_b_name_hint}
            </Trans>
          </p>
        )}
        {link.note && (
          <p className="text-xs text-muted-foreground mt-0.5">
            <Trans>
            Ghi chú: {link.note}
            </Trans>
          </p>
        )}
      </div>

      {link.invite_token ? (
        <Input
          readOnly
          icon={<IconLink />}
          value={confirmUrl}
          className="font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
          action={
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={copy}
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
      ) : (
        <p className="text-xs text-muted-foreground">
          <Trans>
            <Trans>
              <Trans>
                Đề nghị gửi thẳng tới dòng họ công khai — chờ admin bên kia xác
                nhận trong /inlaws của họ.
              </Trans>
            </Trans>
          </Trans>
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          variant="destructive-outline"
          className="flex-1 sm:flex-none"
          onClick={onCancel}
          disabled={canceling}
        >
          <IconTrash className="h-4 w-4 mr-1.5" />
          {t`Huỷ đề nghị`}
        </Button>
      </div>
    </li>
  );
}
