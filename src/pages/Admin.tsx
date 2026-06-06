import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconLock,
  IconShield,
  IconTrash,
  IconUnlock,
} from "@/components/icons";
import { SearchInput } from "@/components/SearchInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import {
  adminAction,
  getPlatformDbStats,
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

type Tab = "users" | "clans" | "health";

const PAGE_SIZE = 20;

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
      <main className="container max-w-4xl py-6 px-4 space-y-6">
        {/* Title + tab switcher on one row at sm+ (tabs right-aligned)
            — saves a row of vertical space on desktop. Stacked on
            mobile so the tabs still get full width. */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <h1 className="clan-name text-2xl sm:text-3xl font-semibold sm:flex-1">
            Quản trị nền tảng
          </h1>
          <div className="flex sm:inline-flex rounded-md border bg-card overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => setTab("users")}
              className={`flex-1 sm:flex-none px-4 h-10 text-sm ${
                tab === "users" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
              }`}
            >
              Người dùng
            </button>
            <button
              type="button"
              onClick={() => setTab("clans")}
              className={`flex-1 sm:flex-none px-4 h-10 text-sm border-l ${
                tab === "clans" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
              }`}
            >
              Dòng họ
            </button>
            <button
              type="button"
              onClick={() => setTab("health")}
              className={`flex-1 sm:flex-none px-4 h-10 text-sm border-l ${
                tab === "health" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
              }`}
            >
              Hệ thống
            </button>
          </div>
        </div>

        {tab === "users" && <UsersTab callerId={user.id} />}
        {tab === "clans" && <ClansTab />}
        {tab === "health" && <HealthTab />}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------

function UsersTab({ callerId }: { callerId: string }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
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

  useEffect(() => {
    setPage(1);
  }, [search]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <CollapsibleHint>
        {profiles?.length ?? 0} tài khoản. Khoá / mở khoá, đổi giới hạn,
        gán quyền platform admin, xoá tài khoản từ đây.
      </CollapsibleHint>

      <SearchInput
        label="Tìm người dùng theo tên hoặc email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Tìm theo tên hoặc email"
      />

      {isLoading && <p className="text-muted-foreground">Đang tải…</p>}

      <ul className="space-y-2">
        {pageRows.map((p) => (
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

      {total > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onChange={setPage}
        />
      )}
    </div>
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
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [maxClans, setMaxClans] = useState(String(profile.max_clans));

  const updateLimits = useMutation({
    mutationFn: () => updateProfileMaxClans(profile.id, Number(maxClans)),
    onSuccess: () => {
      onChange();
      toast.success("Đã cập nhật giới hạn");
    },
    onError: (e) =>
      toast.error("Không lưu được", { description: (e as Error).message }),
  });

  const suspendM = useMutation({
    mutationFn: (suspend: boolean) =>
      adminAction({
        action: suspend ? "suspend" : "unsuspend",
        target_user_id: profile.id,
      }),
    onSuccess: (_data, suspend) => {
      onChange();
      toast.success(suspend ? "Đã khoá tài khoản" : "Đã mở khoá");
    },
    onError: (e) =>
      toast.error("Thất bại", { description: (e as Error).message }),
  });

  const grantM = useMutation({
    mutationFn: (grant: boolean) =>
      adminAction({
        action: "grant_platform_admin",
        target_user_id: profile.id,
        grant,
      }),
    onSuccess: (_data, grant) => {
      onChange();
      toast.success(grant ? "Đã cấp quyền admin" : "Đã thu hồi quyền admin");
    },
    onError: (e) =>
      toast.error("Thất bại", { description: (e as Error).message }),
  });

  const deleteM = useMutation({
    mutationFn: () =>
      adminAction({ action: "delete", target_user_id: profile.id }),
    onSuccess: () => {
      onChange();
      toast.success("Đã xoá tài khoản");
    },
    onError: (e) =>
      toast.error("Không xoá được", { description: (e as Error).message }),
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
                  Khoá
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
              {profile.is_platform_admin ? "Thu quyền" : "Cấp quyền"}
              <span className="hidden sm:inline">&nbsp;platform admin</span>
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
              Xoá
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
  const [page, setPage] = useState(1);
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

  useEffect(() => {
    setPage(1);
  }, [search]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <CollapsibleHint>
        {clans?.length ?? 0} dòng họ. Chỉnh giới hạn số người / tài khoản
        tại đây.
      </CollapsibleHint>

      <SearchInput
        label="Tìm dòng họ theo tên"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Tìm dòng họ theo tên — gõ không dấu cũng được"
      />

      {isLoading && <p className="text-muted-foreground">Đang tải…</p>}

      <ul className="space-y-2">
        {pageRows.map((c) => (
          <ClanRow
            key={c.id}
            clan={c}
            onChange={() =>
              qc.invalidateQueries({ queryKey: queryKeys.adminClans() })
            }
          />
        ))}
      </ul>

      {total > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onChange={setPage}
        />
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="text-muted-foreground">
        {`${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} / ${total}`}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Trang trước"
        >
          <IconArrowLeft className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Trước</span>
        </Button>
        <span className="px-2">
          {page}/{totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="Trang sau"
        >
          <span className="hidden sm:inline">Sau</span>
          <IconArrowRight className="h-4 w-4 sm:ml-1" />
        </Button>
      </div>
    </div>
  );
}

function ClanRow({
  clan,
  onChange,
}: {
  clan: AdminClanRow;
  onChange: () => void;
}) {
  const toast = useToast();
  const [maxPersons, setMaxPersons] = useState(String(clan.max_persons));
  const [maxUsers, setMaxUsers] = useState(String(clan.max_users));

  const m = useMutation({
    mutationFn: () =>
      updateClanLimits(clan.id, {
        max_persons: Number(maxPersons),
        max_users: Number(maxUsers),
      }),
    onSuccess: () => {
      onChange();
      toast.success("Đã cập nhật giới hạn clan");
    },
    onError: (e) =>
      toast.error("Không lưu được", { description: (e as Error).message }),
  });

  const changed =
    String(clan.max_persons) !== maxPersons ||
    String(clan.max_users) !== maxUsers;

  const isPublic = clan.visibility === "public";

  return (
    <li className="rounded-lg border bg-card p-4 space-y-3">
      {/* Header: clan name + visibility pill on top row, description
          (if any) wraps below the name on its own line. */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            to={`/clans/${clan.id}`}
            className="font-semibold hover:underline truncate block"
          >
            {clan.name}
          </Link>
          {clan.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {clan.description}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${
            isPublic
              ? "bg-accent/20 text-accent"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {isPublic ? "Công khai" : "Riêng tư"}
        </span>
      </div>

      {/* Limits — grid: 2 inputs share width, button sits on its own
          row at mobile and inline-right at sm+. */}
      <div className="border-t pt-3 grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <div className="space-y-1 min-w-0">
          <Label htmlFor={`mp-${clan.id}`} className="text-xs">
            Giới hạn người
          </Label>
          <Input
            id={`mp-${clan.id}`}
            type="number"
            min={1}
            value={maxPersons}
            onChange={(e) => setMaxPersons(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="space-y-1 min-w-0">
          <Label htmlFor={`mu-${clan.id}`} className="text-xs">
            Giới hạn tài khoản
          </Label>
          <Input
            id={`mu-${clan.id}`}
            type="number"
            min={1}
            value={maxUsers}
            onChange={(e) => setMaxUsers(e.target.value)}
            className="w-full"
          />
        </div>
        <Button
          onClick={() => m.mutate()}
          disabled={m.isPending || !changed}
          className="col-span-2 sm:col-span-1"
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

/**
 * Help-text block that clamps to 1 line on mobile + offers a "Xem
 * thêm / Thu gọn" toggle. On sm+ it shows the full text — there's
 * enough vertical room there that hiding it is overkill.
 */
function CollapsibleHint({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <p
        className={`text-sm text-muted-foreground ${
          expanded ? "" : "line-clamp-1 sm:line-clamp-none"
        }`}
      >
        {children}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="mt-1 text-xs text-primary hover:underline sm:hidden"
      >
        {expanded ? "Thu gọn" : "Xem thêm"}
      </button>
    </div>
  );
}

// ───────────── Health (Hệ thống) tab ─────────────────────────────────

function HealthTab() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.platformDbStats(),
    queryFn: () => getPlatformDbStats(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Đang tải…</p>;
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Cập nhật lúc {new Date(data.generated_at).toLocaleString("vi-VN")}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? "Đang tải…" : "Làm mới"}
        </Button>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Cần chú ý</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <StateTile
            label="Đóng góp chờ duyệt"
            value={data.states.contributions_pending}
            highlight={data.states.contributions_pending > 0}
          />
          <StateTile
            label="Liên kết thông gia chờ"
            value={data.states.person_links_pending}
            highlight={data.states.person_links_pending > 0}
          />
          <StateTile
            label="Share-link đang hoạt động"
            value={data.states.share_links_active}
          />
          <StateTile
            label="Notify thất bại (tổng)"
            value={data.states.notifications_failed_total}
            highlight={data.states.notifications_failed_total > 0}
          />
          <StateTile
            label="Tài khoản tổng"
            value={data.states.users_total}
          />
          <StateTile
            label="Bị khoá"
            value={data.states.users_suspended}
            highlight={data.states.users_suspended > 0}
          />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Hoạt động gần đây</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <RateTile label="Người mới (24h)" value={data.rates.persons_24h ?? 0} />
          <RateTile label="Người mới (7 ngày)" value={data.rates.persons_7d ?? 0} />
          <RateTile label="Người mới (30 ngày)" value={data.rates.persons_30d ?? 0} />
          <RateTile label="Dòng họ mới (7d)" value={data.rates.clans_7d ?? 0} />
          <RateTile label="Dòng họ mới (30d)" value={data.rates.clans_30d ?? 0} />
          <RateTile label="Tài khoản mới (7d)" value={data.rates.users_7d ?? 0} />
          <RateTile label="Tài khoản mới (30d)" value={data.rates.users_30d ?? 0} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Số dòng + dung lượng</h2>
        <div className="rounded-md border bg-background overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Bảng</th>
                <th className="text-right px-3 py-2 font-medium">Số dòng</th>
                <th className="text-right px-3 py-2 font-medium">Dung lượng</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.rows)
                .sort(([, a], [, b]) => b - a)
                .map(([table, count]) => (
                  <tr key={table} className="border-t">
                    <td className="px-3 py-1.5 font-mono text-xs">{table}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {formatNumber(count)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                      {table === "auth_users"
                        ? "—"
                        : formatBytes(data.sizes_bytes[table] ?? 0)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Lịch chạy nền (cron)</h2>
        {data.cron.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            pg_cron chưa cài hoặc chưa có job nào — local dev là bình thường.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.cron.map((job) => (
              <CronRow key={job.jobname} job={job} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StateTile({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "rounded-md border p-3 " +
        (highlight ? "border-primary bg-primary/5" : "bg-card")
      }
    >
      <p
        className={
          "text-2xl font-semibold tabular-nums " +
          (highlight ? "text-primary" : "")
        }
      >
        {formatNumber(value)}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function RateTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-xl font-semibold tabular-nums">
        {formatNumber(value)}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function CronRow({ job }: { job: { jobname: string; schedule: string; active: boolean; last_run: { status: string; start_time: string; end_time: string | null; return_message: string | null } | null } }) {
  const ok = job.last_run?.status === "succeeded";
  return (
    <li className="rounded-md border bg-card p-3 space-y-1">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="font-mono text-xs">{job.jobname}</p>
        <span
          className={
            "text-xs px-2 py-0.5 rounded " +
            (ok
              ? "bg-accent/15 text-accent"
              : job.last_run
                ? "bg-destructive/15 text-destructive"
                : "bg-muted text-muted-foreground")
          }
        >
          {job.last_run ? (ok ? "Thành công" : job.last_run.status) : "Chưa chạy"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Schedule: <span className="font-mono">{job.schedule}</span>
        {!job.active && " · tạm tắt"}
      </p>
      {job.last_run && (
        <p className="text-xs text-muted-foreground">
          Lần cuối: {new Date(job.last_run.start_time).toLocaleString("vi-VN")}
        </p>
      )}
    </li>
  );
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
