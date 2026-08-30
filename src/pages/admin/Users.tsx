import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import {
  IconBuildings,
  IconCheck,
  IconLock,
  IconShield,
  IconTrash,
  IconUnlock,
} from "@/components/icons";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDate, formatDateTime } from "@/lib/formatDate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUrlPatch } from "@/hooks/useUrlState";
import {
  adminAction,
  listAllProfiles,
  listClansForUser,
  updateProfileMaxClans,
  type AdminProfileRow,
} from "@/lib/queries/admin";
import { queryKeys } from "@/lib/queries/keys";
import { unaccent } from "@/lib/unaccent";
import { CollapsibleHint, RefreshIconButton } from "@/pages/admin/shared";

const PAGE_SIZE = 15;

export function UsersTab({ callerId }: { callerId: string }) {
  const [sp] = useSearchParams();
  const patch = useUrlPatch();
  const search = sp.get("q") ?? "";
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const setSearch = (v: string) => patch({ q: v || null, page: null });
  const setPage = (n: number) => patch({ page: n <= 1 ? null : String(n) });
  const qc = useQueryClient();

  const { data: profiles, isLoading, refetch, isFetching } = useQuery({
    queryKey: queryKeys.adminProfiles(),
    queryFn: () => listAllProfiles(),
    // Admin cần dữ liệu mới nhất; ghi đè staleTime dài toàn cục để PWA
    // không hiển thị danh sách cũ (kéo theo tìm kiếm sai vì lọc trên
    // tập dữ liệu cũ). Vẫn có nút Tải lại để chủ động fetch.
    staleTime: 0,
    refetchOnMount: "always",
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

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <CollapsibleHint>
          {profiles?.length ?? 0} tài khoản. Khoá / mở khoá, đổi giới hạn,
          gán quyền platform admin, xoá tài khoản từ đây.
        </CollapsibleHint>
        <RefreshIconButton onClick={() => refetch()} busy={isFetching} />
      </div>

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
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
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
    <li className="rounded-lg border bg-card p-3 sm:p-4 space-y-2">
      {/* Header: tên + email, click toggle expand */}
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="w-full text-left flex items-start justify-between gap-3"
      >
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold truncate">
            {profile.display_name ?? profile.email ?? profile.id}
          </h3>
          <p className="text-sm text-muted-foreground truncate">
            {profile.email ?? "—"}
          </p>
        </div>
        <span className="text-sm text-muted-foreground shrink-0 mt-0.5">
          {expanded ? "▴" : "▾"}
        </span>
      </button>

      {/* Status badges — luôn hiển thị (cả lúc collapsed) */}
      <div className="flex items-center gap-2 flex-wrap">
        {profile.is_platform_admin && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-accent/10 text-accent">
            Platform admin
          </span>
        )}
        {profile.is_suspended && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-destructive/10 text-destructive">
            Đã khoá
          </span>
        )}
        {isSelf && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-muted text-muted-foreground">
            Bạn
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          Max clan: {profile.max_clans}
        </span>
        {formatDate(profile.created_at) && (
          <span
            className="text-xs text-muted-foreground"
            title={formatDateTime(profile.created_at) ?? undefined}
          >
            Đăng ký {formatDate(profile.created_at)}
          </span>
        )}
      </div>

      {expanded && (
        <div className="space-y-3 pt-2 border-t">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Thuộc dòng họ
            </p>
            {clans === undefined ? (
              <p className="text-xs text-muted-foreground">Đang tải…</p>
            ) : clans.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Không thuộc dòng họ nào.
              </p>
            ) : (
              <ul className="text-sm space-y-0.5">
                {clans.map((c) => (
                  <li key={c.clan_id}>
                    <Link
                      to={`/clans/${c.clan_id}`}
                      className="hover:underline"
                    >
                      {c.clan_name}
                    </Link>{" "}
                    <span className="text-xs text-muted-foreground">
                      ({c.role})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor={`maxc-${profile.id}`} className="text-xs">
              Giới hạn dòng họ
            </Label>
            <div className="relative">
              <Input
                id={`maxc-${profile.id}`}
                icon={<IconBuildings />}
                type="number"
                min={0}
                max={100}
                value={maxClans}
                onChange={(e) => setMaxClans(e.target.value)}
                className="w-full pr-12"
              />
              <button
                type="button"
                onClick={() => updateLimits.mutate()}
                disabled={
                  updateLimits.isPending ||
                  String(profile.max_clans) === maxClans
                }
                aria-label="Lưu giới hạn"
                title="Lưu"
                className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <IconCheck className="h-4 w-4" />
              </button>
            </div>
          </div>

          {lastError && (
            <Alert variant="destructive">
              <AlertDescription>
                {(lastError as Error).message}
              </AlertDescription>
            </Alert>
          )}

          {/* Footer: icon + text ngắn (1-2 chữ) — giống AnnouncementAdminCard */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={isSelf || suspendM.isPending}
                onClick={() => suspendM.mutate(!profile.is_suspended)}
                title={profile.is_suspended ? "Mở khoá" : "Khoá tài khoản"}
              >
                {profile.is_suspended ? (
                  <>
                    <IconUnlock className="h-4 w-4 mr-1" />
                    Mở khoá
                  </>
                ) : (
                  <>
                    <IconLock className="h-4 w-4 mr-1" />
                    Khoá
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isSelf || grantM.isPending}
                onClick={() => grantM.mutate(!profile.is_platform_admin)}
                title={
                  profile.is_platform_admin
                    ? "Thu hồi quyền platform admin"
                    : "Cấp quyền platform admin"
                }
              >
                <IconShield className="h-4 w-4 mr-1" />
                Quyền
              </Button>
              <Button
                size="sm"
                variant="outline"
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
                title="Xoá tài khoản"
                className="text-destructive hover:text-destructive"
              >
                <IconTrash className="h-4 w-4 mr-1" />
                Xoá
              </Button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
