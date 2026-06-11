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
  IconPencil,
  IconShield,
  IconTrash,
  IconUnlock,
} from "@/components/icons";
import { SearchInput } from "@/components/SearchInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SegmentedButton,
  SegmentedControl,
} from "@/components/ui/segmented-control";
import { useAuth } from "@/hooks/useAuth";
import {
  adminAction,
  clearFailedNotification,
  getPlatformDbStats,
  listAllClans,
  listAllProfiles,
  listClansForUser,
  updateClanLimits,
  updateProfileMaxClans,
  type AdminClanRow,
  type AdminProfileRow,
  type FailedNotification,
} from "@/lib/queries/admin";
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncementsForAdmin,
  updateAnnouncement,
  type Announcement,
  type AnnouncementLevel,
} from "@/lib/queries/announcements";
import {
  listFeedback,
  updateFeedback,
  type FeedbackCategory,
  type FeedbackRow,
  type FeedbackStatus,
} from "@/lib/queries/feedback";
import { queryKeys } from "@/lib/queries/keys";
import { getMyProfile } from "@/lib/queries/profile";
import { unaccent } from "@/lib/unaccent";

type Tab = "users" | "clans" | "health" | "feedback" | "announcements";

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
          <SegmentedControl
            ariaLabel="Tab quản trị"
            className="flex sm:inline-flex shrink-0"
          >
            <SegmentedButton
              active={tab === "users"}
              onClick={() => setTab("users")}
              className="flex-1 sm:flex-none"
            >
              Người dùng
            </SegmentedButton>
            <SegmentedButton
              active={tab === "clans"}
              onClick={() => setTab("clans")}
              className="flex-1 sm:flex-none"
            >
              Dòng họ
            </SegmentedButton>
            <SegmentedButton
              active={tab === "health"}
              onClick={() => setTab("health")}
              className="flex-1 sm:flex-none"
            >
              Hệ thống
            </SegmentedButton>
            <SegmentedButton
              active={tab === "feedback"}
              onClick={() => setTab("feedback")}
              className="flex-1 sm:flex-none"
            >
              Góp ý
            </SegmentedButton>
            <SegmentedButton
              active={tab === "announcements"}
              onClick={() => setTab("announcements")}
              className="flex-1 sm:flex-none"
            >
              Thông báo
            </SegmentedButton>
          </SegmentedControl>
        </div>

        {tab === "users" && <UsersTab callerId={user.id} />}
        {tab === "clans" && <ClansTab />}
        {tab === "health" && <HealthTab />}
        {tab === "feedback" && <FeedbackTab />}
        {tab === "announcements" && <AnnouncementsAdminTab />}
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

      <FailedNotificationsSection
        rows={data.recent_failed_notifications}
        total={data.states.notifications_failed_total}
        onChanged={() => refetch()}
      />
    </div>
  );
}

function FailedNotificationsSection({
  rows,
  total,
  onChanged,
}: {
  rows: FailedNotification[];
  total: number;
  onChanged: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const clearM = useMutation({
    mutationFn: (id: string) => clearFailedNotification(id),
    onSuccess: () => {
      toast.success("Đã xoá — lần cron tới sẽ thử lại");
      onChanged();
    },
    onError: (e) =>
      toast.error("Không xoá được", { description: (e as Error).message }),
  });

  if (total === 0) {
    return (
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Email/SMS thất bại</h2>
        <p className="text-sm text-muted-foreground">
          Không có lượt gửi nào thất bại. 👌
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Email/SMS thất bại</h2>
        <p className="text-xs text-muted-foreground">
          10 lần gần nhất trong tổng {formatNumber(total)} lượt
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Đếm tổng có {formatNumber(total)} nhưng không lấy được context —
          có thể row đã bị cascade xoá.
        </p>
      ) : (
        <ul className="rounded-md border bg-background divide-y">
          {rows.map((n) => (
            <li key={n.id} className="p-3 space-y-1">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 text-sm">
                  <p className="font-medium">
                    {n.user_email ?? "(người dùng đã xoá)"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-foreground">
                      {n.clan_name ?? "(clan đã xoá)"}
                    </span>{" "}
                    · {n.channel} ·{" "}
                    <span className="font-mono">{n.event_key}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(n.sent_at).toLocaleString("vi-VN")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={clearM.isPending}
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Xoá log thất bại?",
                      description:
                        "Sau khi xoá, lần cron tới (mặc định mỗi tối) sẽ thử gửi lại sự kiện này.",
                      confirmLabel: "Xoá để thử lại",
                    });
                    if (ok) clearM.mutate(n.id);
                  }}
                >
                  Xoá để thử lại
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
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

// ───────────── Feedback tab ─────────────────────────────────────────

const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: "Mới",
  seen: "Đã xem",
  resolved: "Đã xử lý",
  spam: "Spam",
};

const FEEDBACK_CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  bug: "Lỗi",
  idea: "Ý kiến",
  question: "Câu hỏi",
  other: "Khác",
};

const FEEDBACK_STATUS_BADGE: Record<FeedbackStatus, string> = {
  new: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  seen: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  resolved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  spam: "bg-muted text-muted-foreground border-border",
};

function FeedbackTab() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.adminFeedback(),
    queryFn: () => listFeedback(),
    staleTime: 30_000,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("new");

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data;
    if (statusFilter !== "all") {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    if (search.trim()) {
      const needle = unaccent(search);
      rows = rows.filter((r) => {
        const hay = unaccent(
          `${r.message} ${r.contact ?? ""} ${r.page_path ?? ""} ${r.admin_note ?? ""}`,
        );
        return hay.includes(needle);
      });
    }
    return rows;
  }, [data, search, statusFilter]);

  if (isLoading) {
    return <p className="text-muted-foreground">Đang tải…</p>;
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  const counts = useMemo(() => {
    const c: Record<FeedbackStatus, number> = {
      new: 0,
      seen: 0,
      resolved: 0,
      spam: 0,
    };
    for (const r of data ?? []) c[r.status]++;
    return c;
  }, [data]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Tổng <strong>{data?.length ?? 0}</strong> phản hồi
          {(data?.length ?? 0) >= 500 && " (đang giới hạn 500 mới nhất)"}
          .
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? "Đang tải…" : "Tải lại"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(["all", "new", "seen", "resolved", "spam"] as const).map((s) => {
          const active = statusFilter === s;
          const label = s === "all" ? "Tất cả" : FEEDBACK_STATUS_LABEL[s];
          const count = s === "all" ? data?.length ?? 0 : counts[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 h-9 rounded-md border text-sm transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted/40"
              }`}
            >
              {label}{" "}
              <span className={active ? "opacity-80" : "text-muted-foreground"}>
                ({count})
              </span>
            </button>
          );
        })}
      </div>
      <SearchInput
        label="Tìm trong nội dung / liên hệ / ghi chú"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Tìm theo nội dung, email/SĐT, hoặc ghi chú admin…"
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          {data?.length === 0
            ? "Chưa có phản hồi nào — chờ early users gửi."
            : "Không khớp bộ lọc hiện tại."}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((row) => (
            <FeedbackRowCard key={row.id} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}

function FeedbackRowCard({ row }: { row: FeedbackRow }) {
  const qc = useQueryClient();
  const [note, setNote] = useState(row.admin_note ?? "");
  const [showNote, setShowNote] = useState(!!row.admin_note);

  const mutation = useMutation({
    mutationFn: (patch: { status?: FeedbackStatus; admin_note?: string | null }) =>
      updateFeedback(row.id, patch),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.adminFeedback() }),
  });

  return (
    <li className="rounded-lg border bg-card p-3 sm:p-4 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${FEEDBACK_STATUS_BADGE[row.status]}`}
          >
            {FEEDBACK_STATUS_LABEL[row.status]}
          </span>
          <span className="text-xs text-muted-foreground">
            {FEEDBACK_CATEGORY_LABEL[row.category]}
          </span>
        </div>
        <time
          className="text-xs text-muted-foreground shrink-0 tabular-nums"
          dateTime={row.created_at}
          title={row.created_at}
        >
          {new Date(row.created_at).toLocaleString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </div>

      <p className="whitespace-pre-wrap text-sm leading-relaxed">
        {row.message}
      </p>

      <dl className="text-xs text-muted-foreground grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5">
        {row.contact && (
          <>
            <dt>Liên lạc:</dt>
            <dd className="break-all">{row.contact}</dd>
          </>
        )}
        {row.user_id ? (
          <>
            <dt>Người gửi:</dt>
            <dd className="font-mono break-all">{row.user_id}</dd>
          </>
        ) : (
          <>
            <dt>Người gửi:</dt>
            <dd className="italic">khách (chưa đăng nhập)</dd>
          </>
        )}
        {row.clan_id && (
          <>
            <dt>Clan:</dt>
            <dd>
              <Link
                to={`/clans/${row.clan_id}`}
                className="text-primary hover:underline font-mono break-all"
              >
                {row.clan_id} ↗
              </Link>
            </dd>
          </>
        )}
        {row.page_path && (
          <>
            <dt>Trang:</dt>
            <dd className="font-mono break-all">{row.page_path}</dd>
          </>
        )}
        {row.app_version && (
          <>
            <dt>Phiên bản:</dt>
            <dd className="font-mono">{row.app_version}</dd>
          </>
        )}
        {row.user_agent && (
          <>
            <dt>UA:</dt>
            <dd className="break-all opacity-70">{row.user_agent}</dd>
          </>
        )}
      </dl>

      <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t">
        {(["seen", "resolved", "spam"] as FeedbackStatus[]).map((s) => {
          const active = row.status === s;
          return (
            <Button
              key={s}
              size="sm"
              variant={active ? "default" : "outline"}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ status: s })}
            >
              {active ? "✓ " : ""}
              {FEEDBACK_STATUS_LABEL[s]}
            </Button>
          );
        })}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowNote((v) => !v)}
        >
          {showNote ? "Ẩn ghi chú" : "Ghi chú"}
        </Button>
      </div>

      {showNote && (
        <div className="space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú nội bộ (chỉ admin xem)…"
            rows={2}
            maxLength={4000}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={mutation.isPending || note === (row.admin_note ?? "")}
            onClick={() =>
              mutation.mutate({ admin_note: note.trim() || null })
            }
          >
            Lưu ghi chú
          </Button>
        </div>
      )}
    </li>
  );
}

// ───────────── Announcements admin tab (§32.2) ──────────────────────

const ANNOUNCEMENT_LEVELS: Array<{ value: AnnouncementLevel; label: string }> = [
  { value: "info", label: "Tin" },
  { value: "update", label: "Cập nhật" },
  { value: "warning", label: "Cảnh báo" },
  { value: "critical", label: "Quan trọng" },
];

function AnnouncementsAdminTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();

  const listQ = useQuery({
    queryKey: queryKeys.adminAnnouncements(),
    queryFn: () => listAnnouncementsForAdmin(),
    staleTime: 30_000,
  });

  const [editing, setEditing] = useState<Announcement | "new" | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.adminAnnouncements() });
    qc.invalidateQueries({ queryKey: queryKeys.announcements() });
    qc.invalidateQueries({ queryKey: queryKeys.publicAnnouncements() });
    qc.invalidateQueries({
      queryKey: queryKeys.announcementsUnreadCount(),
    });
  };

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: () => {
      invalidate();
      toast.success("Đã xoá tin");
    },
    onError: (e) =>
      toast.error("Không xoá được", { description: (e as Error).message }),
  });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Tổng <strong>{listQ.data?.length ?? 0}</strong> tin
          {listQ.data && ` (gồm nháp/đã hết hạn)`}.
        </p>
        <Button size="sm" onClick={() => setEditing("new")}>
          + Tin mới
        </Button>
      </div>

      {listQ.isLoading && (
        <p className="text-muted-foreground">Đang tải…</p>
      )}
      {listQ.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {(listQ.error as Error).message}
          </AlertDescription>
        </Alert>
      )}

      {editing && (
        <AnnouncementEditor
          row={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            invalidate();
            setEditing(null);
          }}
        />
      )}

      <ul className="space-y-3">
        {(listQ.data ?? []).map((row) => (
          <AnnouncementAdminCard
            key={row.id}
            row={row}
            onEdit={() => setEditing(row)}
            onDelete={async () => {
              const ok = await confirm({
                title: `Xoá "${row.title}"?`,
                description: "Hành động này không thể hoàn tác.",
                confirmLabel: "Xoá",
                destructive: true,
              });
              if (ok) deleteM.mutate(row.id);
            }}
          />
        ))}
      </ul>
    </section>
  );
}

function AnnouncementAdminCard({
  row,
  onEdit,
  onDelete,
}: {
  row: Announcement;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const now = Date.now();
  const isDraft = row.published_at === null;
  const isExpired = row.expires_at !== null && new Date(row.expires_at).getTime() < now;
  const isFuture =
    row.published_at !== null && new Date(row.published_at).getTime() > now;
  const statusLabel = isDraft
    ? "Nháp"
    : isExpired
      ? "Hết hạn"
      : isFuture
        ? "Lên lịch"
        : "Đang đăng";
  const statusClass = isDraft
    ? "bg-muted text-muted-foreground"
    : isExpired
      ? "bg-muted/40 text-muted-foreground line-through"
      : isFuture
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

  return (
    <li className="rounded-lg border bg-card p-3 sm:p-4 space-y-2">
      <h3 className="font-semibold">{row.title}</h3>
      <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-3">
        {row.body}
      </p>
      <dl className="text-xs text-muted-foreground grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5">
        {row.published_at && (
          <>
            <dt>Đăng:</dt>
            <dd>{new Date(row.published_at).toLocaleString("vi-VN")}</dd>
          </>
        )}
        {row.expires_at && (
          <>
            <dt>Hết hạn:</dt>
            <dd>{new Date(row.expires_at).toLocaleString("vi-VN")}</dd>
          </>
        )}
      </dl>

      <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${statusClass}`}
          >
            {statusLabel}
          </span>
          <span className="text-xs text-muted-foreground">
            {ANNOUNCEMENT_LEVELS.find((l) => l.value === row.level)?.label ??
              row.level}
          </span>
          {row.is_public && (
            <span className="text-xs text-primary">Public</span>
          )}
        </div>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={onEdit}
            aria-label="Sửa tin"
            title="Sửa"
            className="h-9 w-9 p-0"
          >
            <IconPencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onDelete}
            aria-label="Xoá tin"
            title="Xoá"
            className="h-9 w-9 p-0 text-destructive hover:text-destructive"
          >
            <IconTrash className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </li>
  );
}

function AnnouncementEditor({
  row,
  onClose,
  onSaved,
}: {
  row: Announcement | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(row?.title ?? "");
  const [body, setBody] = useState(row?.body ?? "");
  const [level, setLevel] = useState<AnnouncementLevel>(row?.level ?? "info");
  const [isPublic, setIsPublic] = useState(row?.is_public ?? false);
  const [publishedAt, setPublishedAt] = useState<string>(
    row?.published_at ? toLocalInput(row.published_at) : "",
  );
  const [expiresAt, setExpiresAt] = useState<string>(
    row?.expires_at ? toLocalInput(row.expires_at) : "",
  );
  const [publishNow, setPublishNow] = useState(false);

  const saveM = useMutation({
    mutationFn: async () => {
      const draft = {
        title: title.trim(),
        body: body.trim(),
        level,
        is_public: isPublic,
        published_at: publishNow
          ? new Date().toISOString()
          : publishedAt
            ? new Date(publishedAt).toISOString()
            : null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      };
      if (row) {
        await updateAnnouncement(row.id, draft);
      } else {
        await createAnnouncement(draft);
      }
    },
    onSuccess: () => {
      toast.success(row ? "Đã cập nhật tin" : "Đã tạo tin");
      onSaved();
    },
    onError: (e) =>
      toast.error("Không lưu được", { description: (e as Error).message }),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim() && body.trim()) saveM.mutate();
      }}
      className="rounded-lg border bg-card p-4 space-y-4"
    >
      <h3 className="font-semibold">{row ? "Sửa tin" : "Tin mới"}</h3>

      <div className="space-y-2">
        <Label htmlFor="ann-title" required>
          Tiêu đề
        </Label>
        <Input
          id="ann-title"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ann-body" required>
          Nội dung
        </Label>
        <textarea
          id="ann-body"
          required
          maxLength={20000}
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-base font-medium">Mức độ</legend>
        <div className="flex flex-wrap gap-2">
          {ANNOUNCEMENT_LEVELS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 rounded-md border px-3 py-1.5 cursor-pointer text-sm ${
                level === opt.value
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/40"
              }`}
            >
              <input
                type="radio"
                name="ann-level"
                checked={level === opt.value}
                onChange={() => setLevel(opt.value)}
                className="h-4 w-4 accent-primary"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="mt-1 h-4 w-4 accent-primary shrink-0"
        />
        <span>
          <span className="font-medium">Public — hiện ở /changelog</span>
          <span className="block text-sm text-muted-foreground">
            Anon đọc được. Bật khi đây là cập nhật muốn quảng bá ra ngoài.
          </span>
        </span>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="ann-published">Lịch đăng</Label>
          <Input
            id="ann-published"
            type="datetime-local"
            value={publishedAt}
            onChange={(e) => {
              setPublishedAt(e.target.value);
              setPublishNow(false);
            }}
            disabled={publishNow}
          />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={publishNow}
              onChange={(e) => setPublishNow(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Đăng ngay
          </label>
          <p className="text-xs text-muted-foreground">
            Để trống và bỏ check "Đăng ngay" = lưu nháp.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ann-expires">Hết hạn (tuỳ chọn)</Label>
          <Input
            id="ann-expires"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t">
        <Button type="submit" disabled={saveM.isPending || !title.trim() || !body.trim()}>
          <IconCheck className="h-4 w-4 mr-1.5" />
          {saveM.isPending ? "Đang lưu…" : row ? "Cập nhật" : "Tạo"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Huỷ
        </Button>
      </div>
    </form>
  );
}

function toLocalInput(iso: string): string {
  // YYYY-MM-DDTHH:mm — datetime-local input. Drop seconds + tz.
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
