import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  IconCheck,
  IconLock,
  IconShield,
  IconTrash,
  IconUnlock,
} from "@/components/icons";
import { SearchInput } from "@/components/SearchInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import {
  adminAction,
  listAllClans,
  listAllProfiles,
  listClansForUser,
  updateClanLimits,
  updateProfileMaxClans,
  type AdminClanRow,
  type AdminProfileRow,
} from "@/lib/queries/admin";
import { queryKeys } from "@/lib/queries/keys";
import { getMyProfile } from "@/lib/queries/profile";
import { unaccent } from "@/lib/unaccent";

type Tab = "users" | "clans";

export default function Admin() {
  const { user, loading } = useAuth();
  const userId = user?.id ?? "";

  // Self-profile gate — only platform admins reach the body of this page.
  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: queryKeys.myProfile(userId),
    queryFn: () => getMyProfile(userId),
    enabled: !!userId,
  });

  const [tab, setTab] = useState<Tab>("users");

  if (loading || meLoading) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <p className="text-muted-foreground">Đang tải…</p>
      </main>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!me?.is_platform_admin) return <Navigate to="/clans" replace />;

  return (
    <div className="min-h-dvh bg-background lg:pl-72">
      <AppHeader />
      <main className="container max-w-5xl py-6 px-4 space-y-6">
        <h1 className="clan-name text-3xl font-semibold">Quản trị nền tảng</h1>

        <div className="inline-flex rounded-md border bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => setTab("users")}
            className={`px-4 h-10 text-sm ${
              tab === "users" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
            }`}
          >
            Người dùng
          </button>
          <button
            type="button"
            onClick={() => setTab("clans")}
            className={`px-4 h-10 text-sm border-l ${
              tab === "clans" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
            }`}
          >
            Dòng họ
          </button>
        </div>

        {tab === "users" ? <UsersTab callerId={user.id} /> : <ClansTab />}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------

function UsersTab({ callerId }: { callerId: string }) {
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const { data: profiles, isLoading } = useQuery({
    queryKey: queryKeys.adminProfiles(),
    queryFn: () => listAllProfiles(),
  });

  const filtered = useMemo(() => {
    if (!profiles) return [];
    if (!search.trim()) return profiles;
    const needle = unaccent(search);
    return profiles.filter((p) => {
      const name = unaccent(p.display_name ?? "");
      const email = unaccent(p.email ?? "");
      return name.includes(needle) || email.includes(needle);
    });
  }, [profiles, search]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Người dùng</CardTitle>
        <CardDescription>
          {profiles?.length ?? 0} tài khoản. Khoá / mở khoá, đổi giới hạn,
          gán quyền platform admin, xoá tài khoản từ đây.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SearchInput
          label="Tìm người dùng theo tên hoặc email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên hoặc email"
        />

        {isLoading && <p className="text-muted-foreground">Đang tải…</p>}

        <ul className="space-y-3">
          {filtered.map((p) => (
            <UserRow
              key={p.id}
              profile={p}
              isSelf={p.id === callerId}
              onChange={() =>
                qc.invalidateQueries({ queryKey: queryKeys.adminProfiles() })
              }
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function UserRow({
  profile,
  isSelf,
  onChange,
}: {
  profile: AdminProfileRow;
  isSelf: boolean;
  onChange: () => void;
}) {
  const confirm = useConfirm();
  const [expanded, setExpanded] = useState(false);
  const [maxClans, setMaxClans] = useState(String(profile.max_clans));

  const updateLimits = useMutation({
    mutationFn: () => updateProfileMaxClans(profile.id, Number(maxClans)),
    onSuccess: () => onChange(),
  });

  const suspendM = useMutation({
    mutationFn: (suspend: boolean) =>
      adminAction({
        action: suspend ? "suspend" : "unsuspend",
        target_user_id: profile.id,
      }),
    onSuccess: () => onChange(),
  });

  const grantM = useMutation({
    mutationFn: (grant: boolean) =>
      adminAction({
        action: "grant_platform_admin",
        target_user_id: profile.id,
        grant,
      }),
    onSuccess: () => onChange(),
  });

  const deleteM = useMutation({
    mutationFn: () =>
      adminAction({ action: "delete", target_user_id: profile.id }),
    onSuccess: () => onChange(),
  });

  const { data: clans } = useQuery({
    queryKey: queryKeys.adminUserClans(profile.id),
    queryFn: () => listClansForUser(profile.id),
    enabled: expanded,
  });

  const lastError =
    suspendM.error ?? grantM.error ?? deleteM.error ?? updateLimits.error;

  return (
    <li className="rounded-md border bg-card p-3 space-y-2">
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="w-full text-left flex items-center justify-between gap-3 flex-wrap"
      >
        <div className="min-w-0">
          <p className="font-medium truncate">
            {profile.display_name ?? profile.email ?? profile.id}
            {profile.is_platform_admin && (
              <span className="ml-2 text-xs text-accent">platform admin</span>
            )}
            {profile.is_suspended && (
              <span className="ml-2 text-xs text-destructive">đã khoá</span>
            )}
            {isSelf && (
              <span className="ml-2 text-xs text-muted-foreground">(bạn)</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {profile.email ?? "—"} • max clans: {profile.max_clans}
          </p>
        </div>
        <span className="text-sm text-muted-foreground">
          {expanded ? "▴" : "▾"}
        </span>
      </button>

      {expanded && (
        <div className="space-y-4 pt-2 border-t">
          <div className="space-y-2">
            <p className="text-sm font-medium">Thuộc dòng họ:</p>
            {clans === undefined ? (
              <p className="text-xs text-muted-foreground">Đang tải…</p>
            ) : clans.length === 0 ? (
              <p className="text-xs text-muted-foreground">Không thuộc dòng họ nào.</p>
            ) : (
              <ul className="text-sm space-y-0.5">
                {clans.map((c) => (
                  <li key={c.clan_id}>
                    <Link to={`/clans/${c.clan_id}`} className="hover:underline">
                      {c.clan_name}
                    </Link>{" "}
                    <span className="text-xs text-muted-foreground">({c.role})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor={`maxc-${profile.id}`} className="text-xs">
                Giới hạn dòng họ
              </Label>
              <Input
                id={`maxc-${profile.id}`}
                type="number"
                min={0}
                max={100}
                value={maxClans}
                onChange={(e) => setMaxClans(e.target.value)}
                className="w-24"
              />
            </div>
            <Button
              size="sm"
              onClick={() => updateLimits.mutate()}
              disabled={
                updateLimits.isPending ||
                String(profile.max_clans) === maxClans
              }
            >
              <IconCheck className="h-4 w-4 mr-1.5" />
              Lưu
            </Button>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              disabled={isSelf || suspendM.isPending}
              onClick={() => suspendM.mutate(!profile.is_suspended)}
            >
              {profile.is_suspended ? (
                <>
                  <IconUnlock className="h-4 w-4 mr-1.5" />
                  Mở khoá
                </>
              ) : (
                <>
                  <IconLock className="h-4 w-4 mr-1.5" />
                  Khoá tài khoản
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isSelf || grantM.isPending}
              onClick={() => grantM.mutate(!profile.is_platform_admin)}
            >
              <IconShield className="h-4 w-4 mr-1.5" />
              {profile.is_platform_admin
                ? "Thu quyền platform admin"
                : "Cấp quyền platform admin"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              disabled={isSelf || deleteM.isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: `Xoá vĩnh viễn ${profile.display_name ?? profile.email ?? "user này"}?`,
                  description:
                    "Mọi clan họ sở hữu sẽ thành owner_id = null. Không khôi phục được.",
                  confirmLabel: "Xoá tài khoản",
                  destructive: true,
                });
                if (ok) deleteM.mutate();
              }}
            >
              <IconTrash className="h-4 w-4 mr-1.5" />
              Xoá tài khoản
            </Button>
          </div>

          {lastError && (
            <Alert variant="destructive">
              <AlertDescription>{(lastError as Error).message}</AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------

function ClansTab() {
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const { data: clans, isLoading } = useQuery({
    queryKey: queryKeys.adminClans(),
    queryFn: () => listAllClans(),
  });

  const filtered = useMemo(() => {
    if (!clans) return [];
    if (!search.trim()) return clans;
    const needle = unaccent(search);
    return clans.filter((c) => unaccent(c.name).includes(needle));
  }, [clans, search]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dòng họ</CardTitle>
        <CardDescription>
          {clans?.length ?? 0} dòng họ. Chỉnh giới hạn số người / tài khoản
          tại đây.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SearchInput
          label="Tìm dòng họ theo tên"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm dòng họ theo tên — gõ không dấu cũng được"
        />

        {isLoading && <p className="text-muted-foreground">Đang tải…</p>}

        <ul className="space-y-3">
          {filtered.map((c) => (
            <ClanRow
              key={c.id}
              clan={c}
              onChange={() =>
                qc.invalidateQueries({ queryKey: queryKeys.adminClans() })
              }
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ClanRow({
  clan,
  onChange,
}: {
  clan: AdminClanRow;
  onChange: () => void;
}) {
  const [maxPersons, setMaxPersons] = useState(String(clan.max_persons));
  const [maxUsers, setMaxUsers] = useState(String(clan.max_users));

  const m = useMutation({
    mutationFn: () =>
      updateClanLimits(clan.id, {
        max_persons: Number(maxPersons),
        max_users: Number(maxUsers),
      }),
    onSuccess: () => onChange(),
  });

  const changed =
    String(clan.max_persons) !== maxPersons ||
    String(clan.max_users) !== maxUsers;

  return (
    <li className="rounded-md border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          to={`/clans/${clan.id}`}
          className="font-medium hover:underline truncate"
        >
          {clan.name}
        </Link>
        <span className="text-xs text-muted-foreground">
          {clan.visibility === "public" ? "Công khai" : "Riêng tư"}
        </span>
      </div>
      {clan.description && (
        <p className="text-xs text-muted-foreground">{clan.description}</p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor={`mp-${clan.id}`} className="text-xs">
            max_persons
          </Label>
          <Input
            id={`mp-${clan.id}`}
            type="number"
            min={1}
            value={maxPersons}
            onChange={(e) => setMaxPersons(e.target.value)}
            className="w-28"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`mu-${clan.id}`} className="text-xs">
            max_users
          </Label>
          <Input
            id={`mu-${clan.id}`}
            type="number"
            min={1}
            value={maxUsers}
            onChange={(e) => setMaxUsers(e.target.value)}
            className="w-28"
          />
        </div>
        <Button
          size="sm"
          onClick={() => m.mutate()}
          disabled={m.isPending || !changed}
        >
          {m.isPending ? (
            "Đang lưu…"
          ) : (
            <>
              <IconCheck className="h-4 w-4 mr-1.5" />
              Lưu
            </>
          )}
        </Button>
      </div>
      {m.error && (
        <Alert variant="destructive">
          <AlertDescription>{(m.error as Error).message}</AlertDescription>
        </Alert>
      )}
    </li>
  );
}
