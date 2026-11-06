import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Chip } from "@/components/Chip";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { useConfirm } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { IconTile } from "@/components/IconTile";
import {
  IconBuildings,
  IconCalendar,
  IconLock,
  IconMail,
  IconSearch,
  IconShield,
  IconTag,
  IconUser,
  IconUsers,
} from "@/components/icons";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { SidePanel } from "@/components/SidePanel";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReadOnlyFieldset } from "@/components/ui/readonly-fieldset";
import { Select } from "@/components/ui/select";
import { ViewEditActions } from "@/components/ui/view-edit-actions";
import { LIST_PAGE_SIZE_OPTIONS, useClientPaging, useSearchBox } from "@/hooks/useClientPaging";
import { formatDate, formatDateTime } from "@/lib/formatDate";
import {
  adminAction,
  listAllProfiles,
  listClansForUser,
  updateProfileMaxClans,
  type AdminProfileRow,
} from "@/lib/queries/admin";
import { queryKeys } from "@/lib/queries/keys";
import { unaccent } from "@/lib/unaccent";
import { RefreshIconButton } from "@/pages/admin/shared";

type StatusFilter = "" | "admin" | "suspended";

/** Trạng thái ngăn kéo: xem (chỉ đọc) hoặc sửa một tài khoản. */
type PanelState = { mode: "view" | "edit"; profile: AdminProfileRow } | null;

export function UsersTab({ callerId }: { callerId: string }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const { q, text, setText } = useSearchBox();
  const [status, setStatus] = useState<StatusFilter>("");
  const [panel, setPanel] = useState<PanelState>(null);
  const closePanel = () => setPanel(null);

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
    const needle = unaccent(q.trim());
    return (profiles ?? []).filter((p) => {
      if (status === "admin" && !p.is_platform_admin) return false;
      if (status === "suspended" && !p.is_suspended) return false;
      if (!needle) return true;
      return (
        unaccent(p.display_name ?? "").includes(needle) || unaccent(p.email ?? "").includes(needle)
      );
    });
  }, [profiles, q, status]);
  const paging = useClientPaging(filtered, 20);

  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.adminProfiles() });

  const deleteM = useMutation({
    mutationFn: (id: string) => adminAction({ action: "delete", target_user_id: id }),
    onSuccess: () => {
      invalidate();
      closePanel();
      toast.success("Đã xoá tài khoản");
    },
    onError: (e) => toast.error("Không xoá được", { description: (e as Error).message }),
  });

  return (
    <div className="space-y-3">
      {/* Trạng thái nằm trong ngăn kéo của phễu — như Danh bạ. */}
      <CollapsibleFilters
        activeCount={status ? 1 : 0}
        onReset={() => {
          setStatus("");
          paging.patchAndResetPage({});
        }}
        title="Lọc người dùng"
        search={(toggle) => (
          <SearchInput
            label="Tìm người dùng theo tên hoặc email"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tìm theo tên hoặc email"
            className="pr-[4.75rem]"
            rightSlot={
              <>
                {toggle}
                <RefreshIconButton onClick={() => refetch()} busy={isFetching} compact />
              </>
            }
          />
        )}
      >
        <div className="flex flex-col gap-3">
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as StatusFilter);
              paging.patchAndResetPage({});
            }}
            aria-label="Lọc theo trạng thái"
            icon={<IconTag />}
            className="h-11 w-full text-base"
          >
            <option value="">Mọi tài khoản</option>
            <option value="admin">Platform admin</option>
            <option value="suspended">Đã khoá</option>
          </Select>
        </div>
      </CollapsibleFilters>

      {isLoading && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-muted-foreground">Đang tải…</p>
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <EmptyState
          icon={<IconSearch className="h-10 w-10" />}
          title={q || status ? "Không có tài khoản nào khớp" : "Chưa có tài khoản nào"}
          description={q || status ? "Thử bỏ bớt bộ lọc hoặc từ khoá." : undefined}
        />
      )}

      {filtered.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {paging.paged.map((p) => (
            <UserRow
              key={p.id}
              profile={p}
              isSelf={p.id === callerId}
              onOpen={() => setPanel({ mode: "view", profile: p })}
            />
          ))}
        </ul>
      )}

      {filtered.length > 0 && (
        <Pagination
          page={paging.page}
          totalPages={paging.totalPages}
          total={paging.total}
          pageSize={paging.pageSize}
          unit="tài khoản"
          onPageChange={paging.setPage}
          pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
          onPageSizeChange={paging.setPageSize}
        />
      )}

      <SidePanel
        open={panel !== null}
        title={panel?.mode === "edit" ? "Sửa người dùng" : "Người dùng"}
        subtitle={panel?.profile.display_name ?? panel?.profile.email ?? undefined}
        onClose={closePanel}
        guard={panel?.mode === "edit"}
      >
        {panel && (
          <UserForm
            key={`${panel.mode}-${panel.profile.id}`}
            profile={panel.profile}
            isSelf={panel.profile.id === callerId}
            readOnly={panel.mode === "view"}
            onEdit={() => setPanel({ mode: "edit", profile: panel.profile })}
            onCancel={() =>
              setPanel(panel.mode === "edit" ? { mode: "view", profile: panel.profile } : null)
            }
            onSaved={() => {
              closePanel();
              invalidate();
            }}
            onDelete={async () => {
              const ok = await confirm({
                title: `Xoá vĩnh viễn ${panel.profile.display_name ?? panel.profile.email ?? "user này"}?`,
                description: "Mọi clan họ sở hữu sẽ thành owner_id = null. Không khôi phục được.",
                confirmLabel: "Xoá tài khoản",
                destructive: true,
              });
              if (ok) deleteM.mutate(panel.profile.id);
            }}
          />
        )}
      </SidePanel>
    </div>
  );
}

function UserRow({
  profile,
  isSelf,
  onOpen,
}: {
  profile: AdminProfileRow;
  isSelf: boolean;
  onOpen: () => void;
}) {
  const registered = formatDate(profile.created_at);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-stretch gap-3 p-3 text-left transition-colors hover:bg-muted/40"
      >
        <IconTile
          icon={profile.is_suspended ? IconLock : profile.is_platform_admin ? IconShield : IconUser}
          tone={profile.is_suspended ? "danger" : profile.is_platform_admin ? "primary" : "neutral"}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {profile.display_name ?? profile.email ?? profile.id}
          </p>
          <p className="truncate text-sm text-muted-foreground">{profile.email ?? "—"}</p>
          {registered && (
            <p
              className="mt-0.5 text-xs text-muted-foreground/80"
              title={formatDateTime(profile.created_at) ?? undefined}
            >
              Đăng ký {registered}
            </p>
          )}
          <div className="mt-2 flex flex-wrap justify-end gap-1.5">
            {profile.is_platform_admin && (
              <Chip tone="primary" icon={<IconShield />}>
                Platform admin
              </Chip>
            )}
            {profile.is_suspended && (
              <Chip tone="danger" icon={<IconLock />}>
                Đã khoá
              </Chip>
            )}
            {isSelf && (
              <Chip tone="neutral" icon={<IconUser />}>
                Bạn
              </Chip>
            )}
            <Chip tone="teal" icon={<IconBuildings />}>
              Tối đa {profile.max_clans} dòng họ
            </Chip>
          </div>
        </div>
      </button>
    </li>
  );
}

function UserForm({
  profile,
  isSelf,
  readOnly,
  onEdit,
  onCancel,
  onSaved,
  onDelete,
}: {
  profile: AdminProfileRow;
  isSelf: boolean;
  readOnly: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const toast = useToast();
  const [maxClans, setMaxClans] = useState(String(profile.max_clans));
  const [isAdmin, setIsAdmin] = useState(profile.is_platform_admin);
  const [suspended, setSuspended] = useState(profile.is_suspended);

  const { data: clans } = useQuery({
    queryKey: queryKeys.adminUserClans(profile.id),
    queryFn: () => listClansForUser(profile.id),
  });

  const changed =
    String(profile.max_clans) !== maxClans ||
    isAdmin !== profile.is_platform_admin ||
    suspended !== profile.is_suspended;

  const saveM = useMutation({
    // Chỉ gọi những thao tác thật sự đổi; dừng ở lỗi đầu tiên để không ghi dở dang âm thầm.
    mutationFn: async () => {
      if (String(profile.max_clans) !== maxClans) {
        await updateProfileMaxClans(profile.id, Number(maxClans));
      }
      if (isAdmin !== profile.is_platform_admin) {
        await adminAction({
          action: "grant_platform_admin",
          target_user_id: profile.id,
          grant: isAdmin,
        });
      }
      if (suspended !== profile.is_suspended) {
        await adminAction({
          action: suspended ? "suspend" : "unsuspend",
          target_user_id: profile.id,
        });
      }
    },
    onSuccess: () => {
      toast.success("Đã cập nhật tài khoản");
      onSaved();
    },
    onError: (e) => toast.error("Không lưu được", { description: (e as Error).message }),
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (changed) saveM.mutate();
      }}
    >
      <ReadOnlyFieldset readOnly={readOnly}>
        <div className="space-y-1.5">
          <Label htmlFor="u-name">Tên hiển thị</Label>
          <Input id="u-name" icon={<IconUser />} value={profile.display_name ?? ""} readOnly />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="u-email">Email</Label>
          <Input id="u-email" icon={<IconMail />} value={profile.email ?? ""} readOnly />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="u-created">Ngày đăng ký</Label>
          <Input
            id="u-created"
            icon={<IconCalendar />}
            value={formatDateTime(profile.created_at) ?? ""}
            readOnly
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="u-max">Giới hạn số dòng họ</Label>
          <Input
            id="u-max"
            icon={<IconBuildings />}
            type="number"
            min={0}
            max={100}
            value={maxClans}
            onChange={(e) => setMaxClans(e.target.value)}
          />
        </div>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={isAdmin}
            disabled={isSelf}
            onChange={(e) => setIsAdmin(e.target.checked)}
            className="mt-1 h-4 w-4 accent-primary"
          />
          <span>
            <span className="font-medium">Platform admin</span>
            <span className="block text-sm text-muted-foreground">
              Toàn quyền quản trị nền tảng.
              {isSelf && " Không tự đổi quyền của chính mình."}
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={suspended}
            disabled={isSelf}
            onChange={(e) => setSuspended(e.target.checked)}
            className="mt-1 h-4 w-4 accent-primary"
          />
          <span>
            <span className="font-medium">Khoá tài khoản</span>
            <span className="block text-sm text-muted-foreground">
              Tài khoản bị khoá không đăng nhập được.
              {isSelf && " Không tự khoá chính mình."}
            </span>
          </span>
        </label>
      </ReadOnlyFieldset>

      <div className="space-y-1">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <IconUsers className="h-4 w-4 text-muted-foreground" />
          Thuộc dòng họ
        </p>
        {clans === undefined ? (
          <p className="text-sm text-muted-foreground">Đang tải…</p>
        ) : clans.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không thuộc dòng họ nào.</p>
        ) : (
          <ul className="space-y-0.5 text-sm">
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

      {saveM.error && (
        <Alert variant="destructive">
          <AlertDescription>{(saveM.error as Error).message}</AlertDescription>
        </Alert>
      )}

      <ViewEditActions
        readOnly={readOnly}
        onEdit={onEdit}
        onCancel={onCancel}
        onDelete={onDelete}
        deleteDisabled={isSelf}
        saving={saveM.isPending}
        canSave={changed}
      />
    </form>
  );
}
