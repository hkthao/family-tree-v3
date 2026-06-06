import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { BackLink } from "@/components/BackLink";
import {
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
import { listPersons, type PersonRow } from "@/lib/queries/persons";
import {
  proposeLink,
  type PersonLink,
} from "@/lib/queries/person-links";

/**
 * Propose-link page. The flow has 3 stages tracked by local state:
 *
 *   1. pick-person — search the local clan, click a result.
 *   2. fill-details — hint + note about the person on the other side.
 *   3. show-token — copy / share the invite URL with admin B.
 *
 * Token mode is the only mode supported in this MVP. Public-discovery
 * mode (admin A picks a public clan + person directly) lands later.
 */
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
  const [hint, setHint] = useState("");
  const [note, setNote] = useState("");
  const [createdLink, setCreatedLink] = useState<PersonLink | null>(null);

  const createM = useMutation({
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
      qc.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === "person-links",
      });
      toast.success("Đã tạo mã mời");
    },
    onError: (e) =>
      toast.error("Không tạo được", { description: (e as Error).message }),
  });

  return (
    <div className="space-y-6">
      <nav>
        <BackLink fallback={`/clans/${clan.id}/inlaws`} />
      </nav>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold inline-flex items-center gap-2">
          <IconLink className="h-6 w-6 text-primary" />
          Đề nghị liên kết thông gia
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          Chọn dâu/rể trong dòng họ này, mô tả ngắn để bên kia nhận ra
          đúng người, rồi gửi mã mời cho admin của dòng họ bên kia.
        </p>
      </header>

      {createdLink ? (
        <CreatedView link={createdLink} clanId={clan.id} navigate={navigate} />
      ) : !picked ? (
        <PickPersonStep clanId={clan.id} onPick={setPicked} />
      ) : (
        <DetailsStep
          person={picked}
          hint={hint}
          setHint={setHint}
          note={note}
          setNote={setNote}
          onBack={() => setPicked(null)}
          onSubmit={() => createM.mutate()}
          submitting={createM.isPending}
          error={createM.error as Error | null}
        />
      )}
    </div>
  );
}

// ─── Step 1: pick a person from this clan ────────────────────────────

function PickPersonStep({
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
      <div className="space-y-2">
        <Label>Bước 1: Chọn người trong dòng họ này</Label>
        <p className="text-sm text-muted-foreground">
          Đây là người được sinh ra ở dòng họ bên kia rồi kết hôn về —
          tức "dâu" hoặc "rể" của bên này.
        </p>
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
        <EmptyHint />
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

function EmptyHint() {
  return (
    <div className="rounded-md border bg-card px-4 py-3 text-sm text-muted-foreground inline-flex items-start gap-2">
      <IconSearch className="h-4 w-4 mt-0.5 shrink-0" />
      <p>Không tìm thấy ai khớp tên. Hãy thử từ khoá ngắn hơn.</p>
    </div>
  );
}

// ─── Step 2: hint + note + submit ────────────────────────────────────

function DetailsStep({
  person,
  hint,
  setHint,
  note,
  setNote,
  onBack,
  onSubmit,
  submitting,
  error,
}: {
  person: PersonRow;
  hint: string;
  setHint: (s: string) => void;
  note: string;
  setNote: (s: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error: Error | null;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-md border bg-card p-3 flex items-center gap-3">
        <PersonAvatar gender={person.gender} photoUrl={null} size={48} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{person.full_name}</p>
          <p className="text-xs text-muted-foreground">
            {person.gender === "M" ? "Nam" : "Nữ"}
            {person.generation !== null ? ` · Đời ${person.generation}` : ""}
            {person.birth_date
              ? ` · sinh ${person.birth_date.slice(0, 4)}`
              : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onBack}>
          Đổi
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="hint">Người bên kia là ai (gợi ý)</Label>
        <Input
          id="hint"
          maxLength={200}
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          placeholder="Vd: Đỗ Thị B, sinh 1975, quê Hà Nội"
        />
        <p className="text-xs text-muted-foreground">
          Tuỳ chọn. Admin bên kia sẽ thấy gợi ý này khi nhập mã mời, để
          chọn đúng người trong dòng họ của họ.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Ghi chú</Label>
        <textarea
          id="note"
          rows={3}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Tuỳ chọn. Ghi chú thêm về quan hệ (cưới năm nào, ai giới thiệu…)."
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button onClick={onSubmit} disabled={submitting}>
          {submitting ? (
            "Đang tạo…"
          ) : (
            <>
              <IconCheck className="h-4 w-4 mr-1.5" />
              Tạo mã mời
            </>
          )}
        </Button>
        <Button variant="outline" onClick={onBack} disabled={submitting}>
          <IconX className="h-4 w-4 mr-1.5" />
          Huỷ
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: show generated token ────────────────────────────────────

function CreatedView({
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
      toast.error("Không chép được — hãy chọn và copy thủ công");
    }
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription>
          <strong>Đã tạo mã mời.</strong> Gửi link dưới cho admin của
          dòng họ bên kia (qua Zalo, email, tin nhắn…). Họ mở link →
          chọn người trong dòng họ của họ → liên kết được xác nhận và 2
          bên cùng thấy.
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
          Link chỉ dùng được một lần — sau khi bên kia xác nhận, mã sẽ
          tự huỷ. Có thể tạo lại nếu cần.
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
