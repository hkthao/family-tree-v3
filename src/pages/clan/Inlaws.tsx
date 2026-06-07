import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { BackLink } from "@/components/BackLink";
import { useConfirm } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import {
  IconCheck,
  IconCopy,
  IconLink,
  IconPlus,
  IconTrash,
  IconUndo,
} from "@/components/icons";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { isClanAdmin, useClanContext } from "@/hooks/useClanContext";
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
  type LinkPeek,
  type PersonLink,
} from "@/lib/queries/person-links";
import { supabase } from "@/lib/supabase";

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

  const [tab, setTab] = useState<"confirmed" | "pending">("confirmed");

  const { data: links, isLoading } = useQuery({
    queryKey: queryKeys.personLinksForClan(clan.id, userId),
    queryFn: () => listLinksForClan(clan.id),
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
      toast.success("Đã thu hồi liên kết");
      // Fire-and-forget — both sides get an email so the side that
      // didn't revoke learns the link is gone.
      notifyInlaw(id);
    },
    onError: (e) =>
      toast.error("Không thu hồi được", { description: (e as Error).message }),
  });

  const cancelM = useMutation({
    mutationFn: (id: string) => deletePendingLink(id),
    onSuccess: () => {
      qc.invalidateQueries({ predicate: (q) => isInlawCacheKey(q.queryKey) });
      toast.success("Đã huỷ đề nghị");
    },
    onError: (e) =>
      toast.error("Không huỷ được", { description: (e as Error).message }),
  });

  // Incoming-pending actions
  const acceptM = useMutation({
    mutationFn: (id: string) => acceptLinkDirect(id),
    onSuccess: (_void, id) => {
      qc.invalidateQueries({ predicate: (q) => isInlawCacheKey(q.queryKey) });
      toast.success("Đã xác nhận liên kết");
      notifyInlaw(id);
    },
    onError: (e) =>
      toast.error("Không xác nhận được", { description: (e as Error).message }),
  });
  const rejectM = useMutation({
    mutationFn: (id: string) => revokeLink(id),
    onSuccess: (_void, id) => {
      qc.invalidateQueries({ predicate: (q) => isInlawCacheKey(q.queryKey) });
      toast.success("Đã từ chối đề nghị");
      notifyInlaw(id);
    },
    onError: (e) =>
      toast.error("Không từ chối được", { description: (e as Error).message }),
  });

  return (
    <div className="space-y-5">
      <nav>
        <BackLink fallback={`/clans/${clan.id}`} />
      </nav>

      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold inline-flex items-center gap-2">
            <IconLink className="h-6 w-6 text-primary" />
            Liên kết thông gia
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Đề nghị nối dâu/rể của dòng họ này với cùng người đó ở một
            dòng họ khác trên nền tảng. Quyền sở hữu dữ liệu mỗi bên
            không đổi — link chỉ là chú thích, có thể thu hồi.
          </p>
        </div>
        <Button asChild>
          <Link to={`/clans/${clan.id}/inlaws/new`}>
            <IconPlus className="h-4 w-4 mr-1.5" />
            Đề nghị mới
          </Link>
        </Button>
      </header>

      <div
        className="inline-flex rounded-md border bg-card overflow-hidden"
        role="group"
        aria-label="Tab trạng thái"
      >
        <button
          type="button"
          onClick={() => setTab("confirmed")}
          aria-pressed={tab === "confirmed"}
          className={
            "px-4 h-10 text-sm " +
            (tab === "confirmed"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted/50")
          }
        >
          Đã liên kết ({confirmed.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("pending")}
          aria-pressed={tab === "pending"}
          className={
            "px-4 h-10 text-sm border-l " +
            (tab === "pending"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted/50")
          }
        >
          Đang chờ ({pendingTotal})
        </button>
      </div>

      {isLoading && (
        <p className="text-muted-foreground text-sm">Đang tải…</p>
      )}

      {tab === "confirmed" &&
        !isLoading &&
        (confirmed.length === 0 ? (
          <EmptyState
            icon={<IconLink className="h-10 w-10" />}
            title="Chưa có liên kết nào"
            description="Khi đã có thông gia trên nền tảng, đề nghị nối để tra cứu 2 chiều."
          />
        ) : (
          <ul className="divide-y rounded-md border bg-background">
            {confirmed.map((l) => (
              <ConfirmedRow
                key={l.id}
                link={l}
                clanId={clan.id}
                userId={userId}
                onRevoke={async () => {
                  const ok = await confirm({
                    title: "Thu hồi liên kết?",
                    description:
                      "Sau khi thu hồi, không bên nào còn thấy link này. Có thể tạo lại sau.",
                    confirmLabel: "Thu hồi",
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
          title="Không có đề nghị nào đang chờ"
          description="Bấm “Đề nghị mới” để gửi mã mời hoặc đề nghị thẳng tới một dòng họ công khai."
          primary={{
            label: "Đề nghị mới",
            to: `/clans/${clan.id}/inlaws/new`,
            icon: <IconPlus className="h-4 w-4 mr-1.5" />,
          }}
        />
      )}

      {tab === "pending" && !isLoading && pendingIncoming.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-primary">
            Đề nghị đến với bạn ({pendingIncoming.length})
          </h3>
          <ul className="divide-y rounded-md border bg-background">
            {pendingIncoming.map((l) => (
              <IncomingPendingRow
                key={l.id}
                link={l}
                onAccept={async () => {
                  const ok = await confirm({
                    title: "Xác nhận liên kết này?",
                    description:
                      "Cả hai bên sẽ thấy liên kết trên card người. Có thể thu hồi sau.",
                    confirmLabel: "Xác nhận",
                  });
                  if (ok) acceptM.mutate(l.id);
                }}
                onReject={async () => {
                  const ok = await confirm({
                    title: "Từ chối đề nghị này?",
                    description:
                      "Bên đề nghị sẽ thấy đề nghị đã bị thu hồi. Họ có thể đề nghị lại nếu cần.",
                    confirmLabel: "Từ chối",
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
            Đề nghị tôi đã gửi ({pendingOutgoing.length})
          </h3>
          <ul className="divide-y rounded-md border bg-background">
            {pendingOutgoing.map((l) => (
              <PendingRow
                key={l.id}
                link={l}
                clanId={clan.id}
                onCancel={async () => {
                  const ok = await confirm({
                    title: "Huỷ đề nghị này?",
                    description:
                      "Mã mời sẽ không dùng được nữa. Có thể tạo mã mới.",
                    confirmLabel: "Huỷ đề nghị",
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
            {(
              (revokeM.error ??
                cancelM.error ??
                acceptM.error ??
                rejectM.error) as Error
            ).message}
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
    <li className="p-3 space-y-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="text-sm min-w-0 flex-1">
          <p className="font-medium">
            {localPerson?.full_name ?? "—"}{" "}
            <span className="text-muted-foreground">↔</span>{" "}
            {peek?.full_name ?? "(người bên kia)"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {peek ? <PeekMeta peek={peek} /> : "Đang tải…"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {peek && !peek.masked && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/clans/${peek.clan_id}/people/${peek.person_id}`}>
                Xem trang
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={onRevoke}
            disabled={revoking}
          >
            <IconUndo className="h-4 w-4 mr-1.5" />
            Thu hồi
          </Button>
        </div>
      </div>
    </li>
  );
}

function PeekMeta({ peek }: { peek: LinkPeek }) {
  if (peek.masked) {
    return (
      <>
        <span className="text-foreground">{peek.clan_name}</span> · Người
        còn sống, dòng họ này chưa công khai
      </>
    );
  }
  const lifespan =
    peek.birth_year && peek.death_year
      ? `${peek.birth_year}–${peek.death_year}`
      : peek.birth_year
        ? `sinh ${peek.birth_year}`
        : peek.death_year
          ? `mất ${peek.death_year}`
          : "—";
  return (
    <>
      <span className="text-foreground">{peek.clan_name}</span> ·{" "}
      {peek.gender === "M" ? "Nam" : "Nữ"}
      {peek.generation ? ` · Đời ${peek.generation}` : ""} · {lifespan}
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
        ? `sinh ${preview.person_a_birth_year}`
        : preview?.person_a_death_year
          ? `mất ${preview.person_a_death_year}`
          : "";

  return (
    <li className="p-3 space-y-2">
      <div className="text-sm space-y-1">
        <p>
          <span className="text-muted-foreground">Từ </span>
          <span className="font-semibold">
            {preview?.clan_a_name ?? "…"}
          </span>
        </p>
        <p>
          <span className="text-muted-foreground">Người bên họ: </span>
          <span className="font-medium">
            {preview?.person_a_name ?? "…"}
          </span>
          {preview && (
            <span className="text-xs text-muted-foreground ml-1">
              ({preview.person_a_gender === "M" ? "Nam" : "Nữ"}
              {lifespan ? ` · ${lifespan}` : ""})
            </span>
          )}
        </p>
        <p>
          <span className="text-muted-foreground">Đề nghị nối với: </span>
          <span className="font-medium">
            {localPerson?.full_name ?? "…"}
          </span>
        </p>
        {preview?.note && (
          <p className="text-xs text-muted-foreground italic">
            "{preview.note}"
          </p>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button size="sm" onClick={onAccept} disabled={busy}>
          <IconCheck className="h-4 w-4 mr-1.5" />
          Xác nhận
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive"
          onClick={onReject}
          disabled={busy}
        >
          <IconUndo className="h-4 w-4 mr-1.5" />
          Từ chối
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
      toast.success("Đã chép link mời");
    } catch {
      toast.error("Không chép được — hãy chọn và copy thủ công");
    }
  }

  return (
    <li className="p-3 space-y-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="text-sm min-w-0 flex-1">
          <p className="font-medium">{localPerson?.full_name ?? "—"}</p>
          {link.person_b_name_hint && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Gợi ý người bên kia: {link.person_b_name_hint}
            </p>
          )}
          {link.note && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Ghi chú: {link.note}
            </p>
          )}
        </div>
      </div>

      {link.invite_token ? (
        <div className="relative">
          <Input
            readOnly
            value={confirmUrl}
            className="font-mono text-xs pr-10"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? "Đã chép" : "Chép link"}
            title={copied ? "Đã chép" : "Chép link"}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            {copied ? (
              <IconCheck className="h-4 w-4" />
            ) : (
              <IconCopy className="h-4 w-4" />
            )}
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Đề nghị gửi thẳng tới dòng họ công khai — chờ admin bên kia
          xác nhận trong /inlaws của họ.
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          className="text-destructive"
          onClick={onCancel}
          disabled={canceling}
        >
          <IconTrash className="h-4 w-4 mr-1.5" />
          Huỷ đề nghị
        </Button>
      </div>
    </li>
  );
}
