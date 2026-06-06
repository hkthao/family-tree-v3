import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import {
  IconCheck,
  IconLink,
  IconSearch,
  IconX,
} from "@/components/icons";
import { PersonAvatar } from "@/components/PersonAvatar";
import { SearchInput } from "@/components/SearchInput";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { listCommunityClans, listMyClans } from "@/lib/queries/clans";
import { queryKeys } from "@/lib/queries/keys";
import { getMyProfile } from "@/lib/queries/profile";
import {
  confirmByToken,
  notifyInlaw,
  resolveTokenPreview,
  type LinkTokenPreview,
} from "@/lib/queries/person-links";
import { listPersons, type PersonRow } from "@/lib/queries/persons";

/**
 * /inlaws/confirm/:token — landing page for admin B after admin A
 * sent them an invite link.
 *
 * Flow:
 *   1. Resolve the token (anon-callable) → show "Họ X đề xuất nối với
 *      <hint>" preview.
 *   2. If not logged in, send to /login then back here.
 *   3. Logged-in: pick which of MY clans this is, search a person,
 *      submit. The confirm RPC re-validates everything server-side.
 *
 * No layout wrapping in ClanLayout because at this point we don't
 * know which clan the user will land in — the page lives at the
 * platform level, alongside /clans.
 */
export default function InlawsConfirm() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? "";

  // Resolve the token regardless of auth state (RPC is anon-callable).
  const { data: preview, isLoading, error } = useQuery({
    queryKey: queryKeys.personLinkTokenPreview(token ?? ""),
    queryFn: () => resolveTokenPreview(token!),
    enabled: !!token,
    retry: false,
  });

  return (
    <div className="min-h-dvh bg-background lg:pl-72">
      <AppHeader />
      <main className="container max-w-2xl py-6 px-4 space-y-5">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold inline-flex items-center gap-2">
            <IconLink className="h-6 w-6 text-primary" />
            Xác nhận liên kết thông gia
          </h1>
          <p className="text-sm text-muted-foreground">
            Có một dòng họ đề nghị nối với người trong dòng họ của bạn.
            Xem trước, rồi chọn đúng người.
          </p>
        </header>

        {isLoading && <p className="text-muted-foreground">Đang kiểm tra mã…</p>}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              Mã mời không hợp lệ hoặc đã được dùng. Hãy hỏi lại bên gửi.
            </AlertDescription>
          </Alert>
        )}

        {preview && (
          <>
            <PreviewCard preview={preview} />
            {!user ? (
              <LoginPrompt token={token!} />
            ) : (
              <ConfirmForm token={token!} userId={userId} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ─── Preview card (always shown) ─────────────────────────────────────

function PreviewCard({ preview }: { preview: LinkTokenPreview }) {
  const lifespan =
    preview.person_a_birth_year && preview.person_a_death_year
      ? `${preview.person_a_birth_year}–${preview.person_a_death_year}`
      : preview.person_a_birth_year
        ? `sinh ${preview.person_a_birth_year}`
        : preview.person_a_death_year
          ? `mất ${preview.person_a_death_year}`
          : "";

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <p className="text-sm text-muted-foreground">Từ dòng họ:</p>
      <p className="text-lg font-semibold">{preview.clan_a_name}</p>

      <div className="border-t pt-3 space-y-1">
        <p className="text-sm text-muted-foreground">Người được đề nghị nối:</p>
        <p className="font-medium">
          {preview.person_a_name}
          <span className="ml-2 text-sm text-muted-foreground">
            ({preview.person_a_gender === "M" ? "Nam" : "Nữ"}
            {lifespan ? ` · ${lifespan}` : ""})
          </span>
        </p>
      </div>

      {preview.person_b_name_hint && (
        <div className="border-t pt-3">
          <p className="text-sm text-muted-foreground">
            Gợi ý: ai trong dòng họ của bạn?
          </p>
          <p className="font-medium">{preview.person_b_name_hint}</p>
        </div>
      )}

      {preview.note && (
        <div className="border-t pt-3">
          <p className="text-sm text-muted-foreground">Ghi chú:</p>
          <p className="whitespace-pre-wrap text-sm">{preview.note}</p>
        </div>
      )}
    </div>
  );
}

// ─── Login prompt ────────────────────────────────────────────────────

function LoginPrompt({ token }: { token: string }) {
  // Round-trip via a redirect param so /login returns the user here.
  const redirect = `/inlaws/confirm/${token}`;
  return (
    <div className="rounded-md border bg-primary/5 p-4 space-y-3">
      <p className="text-sm">
        Bạn cần đăng nhập (với tài khoản admin của dòng họ bên này) để
        xác nhận liên kết.
      </p>
      <Button asChild>
        <Link to={`/login?redirect=${encodeURIComponent(redirect)}`}>
          Đăng nhập để xác nhận
        </Link>
      </Button>
    </div>
  );
}

// ─── Confirm form (logged-in) ────────────────────────────────────────

function ConfirmForm({
  token,
  userId,
}: {
  token: string;
  userId: string;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

  // Detect platform admin — they confirm as admin on any clan, even
  // ones without a clan_members row. RLS helper is_clan_admin()
  // returns true for them everywhere; the UI list just has to surface
  // those clans here.
  const { data: profile } = useQuery({
    queryKey: queryKeys.myProfile(userId),
    queryFn: () => getMyProfile(userId),
    enabled: !!userId,
  });
  const isPA = !!profile?.is_platform_admin;

  // Membership-based admin clans (everyone) + community clans (platform
  // admin only). Drop the proposer-side filter — the server enforces
  // clan_a != clan_b and we don't expose clan_a_id here.
  const { data: myClans } = useQuery({
    queryKey: ["inlaws-confirm-my-clans", userId],
    queryFn: () => listMyClans(userId, { page: 1, pageSize: 200 }),
    enabled: !!userId,
  });
  const { data: communityClans } = useQuery({
    queryKey: ["inlaws-confirm-community-clans", userId],
    queryFn: () => listCommunityClans(userId, { page: 1, pageSize: 200 }),
    enabled: !!userId && isPA,
  });

  const adminClans = useMemo(() => {
    const mine = (myClans?.rows ?? []).filter((c) =>
      isPA ? true : c.role === "admin",
    );
    const community = isPA ? (communityClans?.rows ?? []) : [];
    return [...mine, ...community].sort((a, b) =>
      a.name.localeCompare(b.name, "vi"),
    );
  }, [myClans, communityClans, isPA]);

  const [clanBId, setClanBId] = useState<string>("");
  const [picked, setPicked] = useState<PersonRow | null>(null);

  const confirmM = useMutation({
    mutationFn: () =>
      confirmByToken({
        token,
        clanBId,
        personBId: picked!.id,
      }),
    onSuccess: (linkId) => {
      qc.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === "person-links",
      });
      toast.success("Đã xác nhận liên kết");
      // Fire-and-forget — proposer (clan A) gets an email about the
      // confirmation. Don't block navigation on it.
      notifyInlaw(linkId);
      navigate(`/clans/${clanBId}/inlaws`);
    },
    onError: (e) =>
      toast.error("Không xác nhận được", { description: (e as Error).message }),
  });

  if (adminClans.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {isPA
            ? "Hệ thống chưa có dòng họ nào để gắn liên kết."
            : "Tài khoản này không phải admin của dòng họ nào. Để xác nhận liên kết, đăng nhập bằng tài khoản admin của dòng họ bên nhận."}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="clan-b">Dòng họ của bạn</Label>
        <select
          id="clan-b"
          value={clanBId}
          onChange={(e) => {
            setClanBId(e.target.value);
            setPicked(null);
          }}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">— Chọn —</option>
          {adminClans.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {clanBId && (
        <PickPerson
          clanId={clanBId}
          picked={picked}
          onPick={setPicked}
        />
      )}

      {confirmM.error && (
        <Alert variant="destructive">
          <AlertDescription>{(confirmM.error as Error).message}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button
          onClick={() => confirmM.mutate()}
          disabled={!clanBId || !picked || confirmM.isPending}
        >
          {confirmM.isPending ? (
            "Đang xác nhận…"
          ) : (
            <>
              <IconCheck className="h-4 w-4 mr-1.5" />
              Xác nhận liên kết
            </>
          )}
        </Button>
        <Button asChild variant="outline">
          <Link to="/clans">
            <IconX className="h-4 w-4 mr-1.5" />
            Để sau
          </Link>
        </Button>
      </div>
    </div>
  );
}

function PickPerson({
  clanId,
  picked,
  onPick,
}: {
  clanId: string;
  picked: PersonRow | null;
  onPick: (p: PersonRow | null) => void;
}) {
  const [search, setSearch] = useState("");
  const { data, isFetching } = useQuery({
    queryKey: ["inlaws-confirm-search", clanId, search],
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

  if (picked) {
    return (
      <div className="rounded-md border bg-card p-3 flex items-center gap-3">
        <PersonAvatar gender={picked.gender} photoUrl={null} size={44} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{picked.full_name}</p>
          <p className="text-xs text-muted-foreground">
            {picked.gender === "M" ? "Nam" : "Nữ"}
            {picked.generation !== null ? ` · Đời ${picked.generation}` : ""}
            {picked.birth_date
              ? ` · sinh ${picked.birth_date.slice(0, 4)}`
              : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => onPick(null)}>
          Đổi
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Chọn người trong dòng họ này</Label>
      <SearchInput
        label="Tìm theo tên"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Gõ tên đầy đủ hoặc một phần…"
      />
      {isFetching && (
        <p className="text-sm text-muted-foreground">Đang tìm…</p>
      )}
      {search.trim() && !isFetching && rows.length === 0 && (
        <div className="rounded-md border bg-card px-4 py-3 text-sm text-muted-foreground inline-flex items-start gap-2">
          <IconSearch className="h-4 w-4 mt-0.5 shrink-0" />
          <p>Không tìm thấy ai khớp tên.</p>
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
    </div>
  );
}
