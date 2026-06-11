import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { PageHeader } from "@/components/PageHeader";
import {
  IconBuildings,
  IconCheck,
  IconCopy,
  IconLink,
  IconSearch,
  IconX,
} from "@/components/icons";
import { PersonAvatar } from "@/components/PersonAvatar";
import { SearchInput } from "@/components/SearchInput";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { isClanAdmin, useClanContext } from "@/hooks/useClanContext";
import {
  listCommunityClans,
  type ClanSummary,
} from "@/lib/queries/clans";
import {
  SegmentedButton,
  SegmentedControl,
} from "@/components/ui/segmented-control";
import { track } from "@/lib/analytics";
import { listPersons, type PersonRow } from "@/lib/queries/persons";
import {
  notifyInlaw,
  proposeLink,
  proposeLinkDirect,
  isInlawCacheKey,
  type PersonLink,
} from "@/lib/queries/person-links";

/**
 * Propose-link page. Two modes:
 *
 *   1. Token  — admin A creates a pending row with an invite_token,
 *               shares the URL out-of-band with admin B. Works for
 *               private clans (B is who A talks to).
 *   2. Direct — admin A searches the community of public clans, picks
 *               clan B + person B directly. The row has both sides
 *               filled, no token, and notify-inlaw emails admin B
 *               about the new pending invite. Works only for public
 *               clans.
 *
 * Step 1 (pick local person) is shared. Step 2 forks by mode.
 */
type Mode = "token" | "direct";

export default function InlawsNew() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  if (!isClanAdmin(clan)) {
    return <Navigate to={`/clans/${clan.id}`} replace />;
  }

  const [picked, setPicked] = useState<PersonRow | null>(null);
  const [mode, setMode] = useState<Mode>("token");
  // Token-mode inputs
  const [hint, setHint] = useState("");
  const [note, setNote] = useState("");
  // Direct-mode picks
  const [peerClan, setPeerClan] = useState<ClanSummary | null>(null);
  const [peerPerson, setPeerPerson] = useState<PersonRow | null>(null);

  const [createdLink, setCreatedLink] = useState<PersonLink | null>(null);

  const tokenM = useMutation({
    mutationFn: () =>
      proposeLink({
        clanAId: clan.id,
        personAId: picked!.id,
        personBNameHint: hint,
        note,
        createdBy: userId,
      }),
    onSuccess: (link) => {
      setCreatedLink(link);
      qc.invalidateQueries({ predicate: (q) => isInlawCacheKey(q.queryKey) });
      track("inlaw_proposed", { mode: "token" });
      toast.success("Đã tạo mã mời");
    },
    onError: (e) =>
      toast.error("Không tạo được", { description: (e as Error).message }),
  });

  const directM = useMutation({
    mutationFn: () =>
      proposeLinkDirect({
        clanAId: clan.id,
        personAId: picked!.id,
        clanBId: peerClan!.id,
        personBId: peerPerson!.id,
        note,
        createdBy: userId,
      }),
    onSuccess: (link) => {
      qc.invalidateQueries({ predicate: (q) => isInlawCacheKey(q.queryKey) });
      track("inlaw_proposed", { mode: "direct" });
      toast.success("Đã gửi đề nghị tới " + (peerClan?.name ?? ""), {
        description: "Bên kia sẽ nhận email và xem trong /inlaws.",
      });
      notifyInlaw(link.id);
      navigate(`/clans/${clan.id}/inlaws`);
    },
    onError: (e) =>
      toast.error("Không gửi được", { description: (e as Error).message }),
  });

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: "Liên kết thông gia", to: `/clans/${clan.id}/inlaws` },
          { label: "Đề nghị mới" },
        ]}
      />

      <PageHeader
        icon={<IconLink className="h-7 w-7" />}
        title="Đề nghị liên kết thông gia"
        description="Chọn dâu/rể trong dòng họ này, rồi chọn cách đề nghị: gửi mã mời cho admin bên kia, hoặc tìm thẳng dòng họ công khai."
      />

      {createdLink ? (
        <CreatedTokenView
          link={createdLink}
          clanId={clan.id}
          navigate={navigate}
        />
      ) : !picked ? (
        <PickLocalPersonStep clanId={clan.id} onPick={setPicked} />
      ) : (
        <ModeStep
          mode={mode}
          setMode={setMode}
          local={picked}
          onBackToPick={() => setPicked(null)}
          // token mode
          hint={hint}
          setHint={setHint}
          note={note}
          setNote={setNote}
          submitToken={() => tokenM.mutate()}
          submittingToken={tokenM.isPending}
          tokenError={tokenM.error as Error | null}
          // direct mode
          ownClanId={clan.id}
          peerClan={peerClan}
          setPeerClan={setPeerClan}
          peerPerson={peerPerson}
          setPeerPerson={setPeerPerson}
          submitDirect={() => directM.mutate()}
          submittingDirect={directM.isPending}
          directError={directM.error as Error | null}
        />
      )}
    </div>
  );
}

// ─── Step 1: pick a person from this clan ────────────────────────────

function PickLocalPersonStep({
  clanId,
  onPick,
}: {
  clanId: string;
  onPick: (p: PersonRow) => void;
}) {
  const [search, setSearch] = useState("");

  const { data, isFetching } = useQuery({
    queryKey: ["inlaws-people-search", clanId, search],
    queryFn: () =>
      listPersons(clanId, {
        page: 1,
        pageSize: 15,
        search: search.trim(),
        branchId: null,
        generation: null,
        sort: "name",
        source: "persons",
      }),
    enabled: search.trim().length > 0,
    staleTime: 30_000,
  });

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <StepHeader
          number={1}
          title="Chọn người trong dòng họ này"
          description="Đây là người đi lấy chồng/vợ vào dòng họ khác — dâu/rể của bên kia."
        />
        <SearchInput
          label="Tìm theo tên"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Gõ tên đầy đủ hoặc một phần…"
        />
      </div>

      {isFetching && (
        <p className="text-sm text-muted-foreground">Đang tìm…</p>
      )}

      {search.trim() && !isFetching && rows.length === 0 && (
        <div className="rounded-md border bg-card px-4 py-3 text-sm text-muted-foreground inline-flex items-start gap-2">
          <IconSearch className="h-4 w-4 mt-0.5 shrink-0" />
          <p>Không tìm thấy ai khớp tên. Thử từ khoá ngắn hơn.</p>
        </div>
      )}

      {rows.length > 0 && (
        <ul className="divide-y rounded-md border bg-background">
          {rows.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPick(p)}
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40"
              >
                <PersonAvatar
                  gender={p.gender}
                  photoUrl={null}
                  size={40}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.gender === "M" ? "Nam" : "Nữ"}
                    {p.generation !== null ? ` · Đời ${p.generation}` : ""}
                    {p.birth_date
                      ? ` · sinh ${p.birth_date.slice(0, 4)}`
                      : ""}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Step 2: mode + per-mode body ────────────────────────────────────

interface ModeStepProps {
  mode: Mode;
  setMode: (m: Mode) => void;
  local: PersonRow;
  onBackToPick: () => void;
  // token mode
  hint: string;
  setHint: (s: string) => void;
  note: string;
  setNote: (s: string) => void;
  submitToken: () => void;
  submittingToken: boolean;
  tokenError: Error | null;
  // direct mode
  ownClanId: string;
  peerClan: ClanSummary | null;
  setPeerClan: (c: ClanSummary | null) => void;
  peerPerson: PersonRow | null;
  setPeerPerson: (p: PersonRow | null) => void;
  submitDirect: () => void;
  submittingDirect: boolean;
  directError: Error | null;
}

function ModeStep(props: ModeStepProps) {
  const { mode, setMode, local, onBackToPick } = props;

  return (
    <div className="space-y-5">
      {/* Local-person summary card */}
      <div className="rounded-md border bg-card p-3 flex items-center gap-3">
        <PersonAvatar gender={local.gender} photoUrl={null} size={48} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{local.full_name}</p>
          <p className="text-xs text-muted-foreground">
            {local.gender === "M" ? "Nam" : "Nữ"}
            {local.generation !== null ? ` · Đời ${local.generation}` : ""}
            {local.birth_date
              ? ` · sinh ${local.birth_date.slice(0, 4)}`
              : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onBackToPick}>
          Đổi
        </Button>
      </div>

      {/* Step 2 header — rendered as a block heading so the inline-flex
          SegmentedControl below doesn't sit on the same row as the
          label (previous issue). */}
      <div className="space-y-3">
        <StepHeader number={2} title="Cách đề nghị" />
        <SegmentedControl
          ariaLabel="Cách đề nghị"
          className="w-full sm:w-auto"
        >
          <SegmentedButton
            active={mode === "token"}
            onClick={() => setMode("token")}
            className="flex-1 sm:flex-none"
          >
            Gửi mã mời
          </SegmentedButton>
          <SegmentedButton
            active={mode === "direct"}
            onClick={() => setMode("direct")}
            className="flex-1 sm:flex-none"
          >
            Tìm dòng họ công khai
          </SegmentedButton>
        </SegmentedControl>
        <p className="text-xs text-muted-foreground">
          {mode === "token"
            ? "Sinh link mời, bạn gửi cho admin bên kia qua Zalo/email. Hoạt động kể cả khi clan bên kia đặt riêng tư."
            : "Chỉ áp dụng cho clan bên kia đặt công khai. App tự email admin bên đó."}
        </p>
      </div>

      {mode === "token" ? <TokenBody {...props} /> : <DirectBody {...props} />}
    </div>
  );
}

// ─── Mode A: token ───────────────────────────────────────────────────

function TokenBody(props: ModeStepProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="hint">Người bên kia là ai (gợi ý)</Label>
        <Input
          id="hint"
          maxLength={200}
          value={props.hint}
          onChange={(e) => props.setHint(e.target.value)}
          placeholder="Vd: Đỗ Thị B, sinh 1975, quê Hà Nội"
        />
        <p className="text-xs text-muted-foreground">
          Tuỳ chọn. Admin bên kia thấy khi nhập mã mời.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Ghi chú</Label>
        <textarea
          id="note"
          rows={3}
          maxLength={500}
          value={props.note}
          onChange={(e) => props.setNote(e.target.value)}
          placeholder="Tuỳ chọn. Ghi chú thêm về quan hệ."
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {props.tokenError && (
        <Alert variant="destructive">
          <AlertDescription>{props.tokenError.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button
          onClick={props.submitToken}
          disabled={props.submittingToken}
        >
          {props.submittingToken ? (
            "Đang tạo…"
          ) : (
            <>
              <IconCheck className="h-4 w-4 mr-1.5" />
              Tạo mã mời
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={props.onBackToPick}
          disabled={props.submittingToken}
        >
          <IconX className="h-4 w-4 mr-1.5" />
          Huỷ
        </Button>
      </div>
    </div>
  );
}

// ─── Mode B: public-discovery ────────────────────────────────────────

function DirectBody(props: ModeStepProps) {
  const { ownClanId, peerClan, setPeerClan, peerPerson, setPeerPerson } = props;
  return (
    <div className="space-y-5">
      {!peerClan ? (
        <PickPeerClanStep ownClanId={ownClanId} onPick={setPeerClan} />
      ) : !peerPerson ? (
        <PickPeerPersonStep
          peerClan={peerClan}
          onPick={setPeerPerson}
          onBack={() => setPeerClan(null)}
        />
      ) : (
        <PeerConfirmStep
          peerClan={peerClan}
          peerPerson={peerPerson}
          note={props.note}
          setNote={props.setNote}
          onChangePerson={() => setPeerPerson(null)}
          onChangeClan={() => {
            setPeerPerson(null);
            setPeerClan(null);
          }}
          onSubmit={props.submitDirect}
          submitting={props.submittingDirect}
          error={props.directError}
        />
      )}
    </div>
  );
}

function PickPeerClanStep({
  ownClanId,
  onPick,
}: {
  ownClanId: string;
  onPick: (c: ClanSummary) => void;
}) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [q, setQ] = useState("");

  const { data, isFetching } = useQuery({
    queryKey: ["inlaws-peer-clans", userId, q],
    queryFn: () =>
      listCommunityClans(userId, {
        page: 1,
        pageSize: 15,
        search: q.trim() || undefined,
      }),
    enabled: !!userId,
    staleTime: 60_000,
  });
  const rows = (data?.rows ?? []).filter((c) => c.id !== ownClanId);

  return (
    <div className="space-y-3">
      <Label>Tìm dòng họ công khai</Label>
      <SearchInput
        label="Tìm theo tên dòng họ"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Tên dòng họ bên kia…"
      />
      {isFetching && (
        <p className="text-sm text-muted-foreground">Đang tìm…</p>
      )}
      {rows.length > 0 && (
        <ul className="divide-y rounded-md border bg-background">
          {rows.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPick(c)}
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40"
              >
                <IconBuildings className="h-5 w-5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.person_count} người
                    {c.description ? ` · ${c.description}` : ""}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!isFetching && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Không có dòng họ công khai nào khớp. Nếu dòng họ bên kia
          đang đặt riêng tư, dùng tab "Gửi mã mời".
        </p>
      )}
    </div>
  );
}

function PickPeerPersonStep({
  peerClan,
  onPick,
  onBack,
}: {
  peerClan: ClanSummary;
  onPick: (p: PersonRow) => void;
  onBack: () => void;
}) {
  const [q, setQ] = useState("");
  const { data, isFetching } = useQuery({
    queryKey: ["inlaws-peer-persons", peerClan.id, q],
    queryFn: () =>
      // Non-members read through the masked view; the persons table
      // itself rejects them. Switch source so search works even when
      // the caller is just browsing a public clan.
      listPersons(peerClan.id, {
        page: 1,
        pageSize: 15,
        search: q.trim(),
        branchId: null,
        generation: null,
        sort: "name",
        source: "persons_public_safe",
      }),
    enabled: q.trim().length > 0,
    staleTime: 30_000,
  });
  const rows = data?.rows ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Chọn người trong {peerClan.name}</Label>
        <Button variant="outline" size="sm" onClick={onBack}>
          Đổi dòng họ
        </Button>
      </div>
      <SearchInput
        label="Tìm theo tên"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Gõ tên đầy đủ hoặc một phần…"
      />
      {isFetching && (
        <p className="text-sm text-muted-foreground">Đang tìm…</p>
      )}
      {rows.length > 0 && (
        <ul className="divide-y rounded-md border bg-background">
          {rows.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPick(p)}
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40"
              >
                <PersonAvatar gender={p.gender} photoUrl={null} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.gender === "M" ? "Nam" : "Nữ"}
                    {p.generation !== null ? ` · Đời ${p.generation}` : ""}
                    {p.birth_date
                      ? ` · sinh ${p.birth_date.slice(0, 4)}`
                      : ""}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim() && !isFetching && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Không tìm thấy ai khớp tên (lưu ý: clan công khai có thể ẩn
          người còn sống — chỉ liệt kê người đã mất nếu bạn không phải
          thành viên).
        </p>
      )}
    </div>
  );
}

function PeerConfirmStep({
  peerClan,
  peerPerson,
  note,
  setNote,
  onChangePerson,
  onChangeClan,
  onSubmit,
  submitting,
  error,
}: {
  peerClan: ClanSummary;
  peerPerson: PersonRow;
  note: string;
  setNote: (s: string) => void;
  onChangePerson: () => void;
  onChangeClan: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error: Error | null;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-sm">
            <IconBuildings className="h-4 w-4 text-primary" />
            <span className="font-medium">{peerClan.name}</span>
          </div>
          <Button variant="outline" size="sm" onClick={onChangeClan}>
            Đổi
          </Button>
        </div>
        <div className="flex items-center justify-between gap-3 pt-2 border-t">
          <div className="flex items-center gap-3 min-w-0">
            <PersonAvatar
              gender={peerPerson.gender}
              photoUrl={null}
              size={40}
            />
            <div className="min-w-0">
              <p className="font-medium">{peerPerson.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {peerPerson.gender === "M" ? "Nam" : "Nữ"}
                {peerPerson.generation !== null
                  ? ` · Đời ${peerPerson.generation}`
                  : ""}
                {peerPerson.birth_date
                  ? ` · sinh ${peerPerson.birth_date.slice(0, 4)}`
                  : ""}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onChangePerson}>
            Đổi
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Ghi chú (tuỳ chọn)</Label>
        <textarea
          id="note"
          rows={3}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Vd: Cưới năm 2010, có 2 con."
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <Alert>
        <AlertDescription>
          Đề nghị sẽ ở trạng thái <strong>Đang chờ</strong> cho tới khi
          admin bên kia mở <code>/clans/&lt;id&gt;/inlaws</code> → tab
          "Đang chờ" → Xác nhận hoặc Từ chối.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button onClick={onSubmit} disabled={submitting}>
          {submitting ? (
            "Đang gửi…"
          ) : (
            <>
              <IconCheck className="h-4 w-4 mr-1.5" />
              Gửi đề nghị
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Token created — show URL ────────────────────────────────────────

function CreatedTokenView({
  link,
  clanId,
  navigate,
}: {
  link: PersonLink;
  clanId: string;
  navigate: (to: string) => void;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const confirmUrl = useMemo(
    () => `${window.location.origin}/inlaws/confirm/${link.invite_token}`,
    [link.invite_token],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(confirmUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Đã chép link mời");
    } catch {
      toast.error("Không chép được — chọn và copy thủ công");
    }
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription>
          <strong>Đã tạo mã mời.</strong> Gửi link dưới cho admin của
          dòng họ bên kia (qua Zalo, email, tin nhắn…). Họ mở link →
          chọn người → liên kết được xác nhận.
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <Label>Link mời</Label>
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
        <p className="text-xs text-muted-foreground">
          Link chỉ dùng được một lần — sau khi bên kia xác nhận, mã tự
          huỷ.
        </p>
      </div>

      <div className="flex gap-3">
        <Button onClick={() => navigate(`/clans/${clanId}/inlaws`)}>
          Về danh sách liên kết
        </Button>
        <Button asChild variant="outline">
          <Link to={`/clans/${clanId}/inlaws/new`}>Tạo thêm</Link>
        </Button>
      </div>
    </div>
  );
}

// ─── StepHeader ─────────────────────────────────────────────────────
// Block-level step heading used by Bước 1 + Bước 2. A small numeric
// pill on the left + bold title; optional one-line description below.
// Replaces the previous bare `<Label>Bước N: …</Label>` which rendered
// inline (since radix Label is a `<label>` element) and collided with
// any sibling inline-flex control on the same row.
function StepHeader({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2.5">
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold shrink-0"
        >
          {number}
        </span>
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      {description && (
        <p className="text-sm text-muted-foreground mt-1.5 ml-8">
          {description}
        </p>
      )}
    </div>
  );
}
