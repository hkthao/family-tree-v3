import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { Chip, type ChipTone } from "@/components/Chip";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { EmptyState } from "@/components/EmptyState";
import { FilterableSelect } from "@/components/FilterableSelect";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { SidePanel } from "@/components/SidePanel";
import { useConfirm } from "@/components/ConfirmDialog";
import { InviteLinkCard } from "@/components/InviteLinkCard";
import { useToast } from "@/components/Toast";
import {
  IconCalendar,
  IconCheck,
  IconMail,
  IconPencil,
  IconSearch,
  IconShield,
  IconTag,
  IconUser,
  IconUserPlus,
} from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReadOnlyFieldset } from "@/components/ui/readonly-fieldset";
import { ViewEditActions } from "@/components/ui/view-edit-actions";
import { useAuth } from "@/hooks/useAuth";
import { useClanContext } from "@/hooks/useClanContext";
import {
  LIST_PAGE_SIZE_OPTIONS,
  useClientPaging,
  useSearchBox,
  useUrlFilter,
} from "@/hooks/useClientPaging";
import { unaccent } from "@/lib/unaccent";
import { queryKeys } from "@/lib/queries/keys";
import { getKinshipIndex } from "@/lib/queries/kinship";
import {
  adminSetMemberDisplayName,
  adminSetMemberSelfPerson,
  changeMemberRole,
  inviteMemberByEmail,
  listClanMembers,
  removeMember,
  setMemberSelfVerified,
  type ClanMember,
  type ClanRole,
} from "@/lib/queries/members";

import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
export default function Members() {
  const { clanId } = useParams<{ clanId: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();

  const { clan } = useClanContext();

  const { data: members, isLoading } = useQuery({
    queryKey: queryKeys.clanMembers(clanId ?? "", userId),
    queryFn: () => listClanMembers(clanId!),
    enabled: !!clanId && !!userId,
  });

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<ClanRole>("viewer");
  const [inviteMessage, setInviteMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const inviteMutation = useMutation({
    mutationFn: () =>
      inviteMemberByEmail(clanId!, inviteEmail.trim(), inviteRole),
    onSuccess: async (res) => {
      if (res.ok) {
        setInviteMessage({
          kind: "success",
          text: t`Đã thêm ${inviteEmail} với vai trò ${ROLE_LABEL[inviteRole]}.`,
        });
        toast.success(t`Đã thêm thành viên`, {
          description: `${inviteEmail} — ${ROLE_LABEL[inviteRole]}`,
        });
        setInviteEmail("");
        await queryClient.invalidateQueries({
          queryKey: queryKeys.clanMembers(clanId!, userId),
        });
      } else {
        setInviteMessage({
          kind: "error",
          text:
            res.error === "user_not_found"
              ? t`Không tìm thấy tài khoản có email ${inviteEmail}. Họ cần đăng ký trước.`
              : t`${inviteEmail} đã là thành viên.`,
        });
      }
    },
    onError: (e) => {
      setInviteMessage({ kind: "error", text: (e as Error).message });
      toast.error(t`Không thêm được`, { description: (e as Error).message });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (uid: string) => removeMember(clanId!, uid),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.clanMembers(clanId!, userId),
      });
      setPanel(null);
      toast.success(t`Đã xoá thành viên`);
    },
    onError: (e) =>
      toast.error(t`Không xoá được`, { description: (e as Error).message }),
  });

  const [panel, setPanel] = useState<PanelState>(null);
  // Từ khoá + vai trò nằm trên URL nên bấm Back vẫn giữ nguyên.
  const {
    q: memberSearch,
    text: memberSearchText,
    setText: setMemberSearchText,
  } = useSearchBox();
  const [roleFilter, setRoleFilter] = useUrlFilter<ClanRole | "">("vai", "");
  const filteredMembers = useMemo(() => {
    const q = unaccent(memberSearch.trim()).toLowerCase();
    return (members ?? []).filter(
      (m) =>
        (!roleFilter || m.role === roleFilter) &&
        (!q ||
          unaccent(m.display_name ?? "")
            .toLowerCase()
            .includes(q)),
    );
  }, [members, memberSearch, roleFilter]);
  const paging = useClientPaging(filteredMembers, 20);

  if (!clanId) return null;
  // Treat platform admin as clan admin everywhere.
  if (clan.myRole !== "admin" && !clan.isPlatformAdmin) {
    return <Navigate to={`/clans/${clanId}/people`} replace />;
  }

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clanId}` },
          { label: t`Thành viên` },
        ]}
      />

      <PageHeader
        icon={<IconUserPlus className="h-7 w-7" />}
        title={t`Thành viên`}
        description={t`Mời người, đổi vai trò, gỡ thành viên.`}
      />

      <InviteLinkCard clanId={clanId} clanName={clan.name} />

      <Card>
        <CardHeader>
          <CardTitle>{t`Mời bằng email`}</CardTitle>
          <CardDescription>
            <Trans>
              <Trans>
                <Trans>
                  Người được mời cần có sẵn tài khoản (đã đăng ký bằng email
                  tương ứng). Chưa có cơ chế gửi mail mời tự động.
                </Trans>
              </Trans>
            </Trans>
          </CardDescription>
        </CardHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (inviteEmail.trim()) {
              setInviteMessage(null);
              inviteMutation.mutate();
            }
          }}
        >
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite_email">Email</Label>
              <Input
                id="invite_email"
                icon={<IconMail />}
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="vd: anh@example.com"
              />
            </div>

            <fieldset>
              <legend className="text-base font-medium mb-2">{t`Vai trò`}</legend>
              <div className="flex flex-wrap gap-3">
                {(["viewer", "editor", "admin"] as ClanRole[]).map((r) => (
                  <label
                    key={r}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <input
                      type="radio"
                      checked={inviteRole === r}
                      onChange={() => setInviteRole(r)}
                      className="h-5 w-5 accent-primary shrink-0"
                    />
                    <span>{ROLE_LABEL[r]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {inviteMessage && (
              <Alert
                variant={
                  inviteMessage.kind === "error" ? "destructive" : "default"
                }
              >
                <AlertDescription>{inviteMessage.text}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="justify-end border-t pt-4">
            <Button
              type="submit"
              disabled={inviteMutation.isPending || !inviteEmail.trim()}
            >
              {inviteMutation.isPending ? (
                t`Đang mời…`
              ) : (
                <>
                  <IconUserPlus className="h-4 w-4 mr-1.5" />
                  {t`Mời`}
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Vai trò nằm trong ngăn kéo của phễu — như Danh bạ. */}
      <CollapsibleFilters
        activeCount={roleFilter ? 1 : 0}
        onReset={() => {
          paging.patchAndResetPage({ vai: null });
        }}
        title={t`Lọc thành viên`}
        search={(toggle) => (
          <SearchInput
            label={t`Tìm thành viên`}
            value={memberSearchText}
            onChange={(e) => {
              setMemberSearchText(e.target.value);
            }}
            placeholder={t`Tìm theo tên…`}
            rightSlot={toggle}
          />
        )}
      >
        <div className="flex flex-col gap-3">
          <Select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as ClanRole | "");
            }}
            aria-label={t`Lọc theo vai trò`}
            icon={<IconTag />}
            className="h-11 w-full text-base"
          >
            <option value="">{t`Mọi vai trò`}</option>
            {(Object.keys(ROLE_LABEL) as ClanRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </div>
      </CollapsibleFilters>

      {isLoading && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-muted-foreground">{t`Đang tải…`}</p>
        </div>
      )}

      {!isLoading && filteredMembers.length === 0 && (
        <EmptyState
          icon={<IconSearch className="h-10 w-10" />}
          title={
            memberSearch.trim() || roleFilter
              ? t`Không có thành viên nào khớp`
              : t`Chưa có ai khác`
          }
          description={
            memberSearch.trim() || roleFilter
              ? t`Thử bỏ bớt bộ lọc hoặc từ khoá.`
              : t`Dùng ô email phía trên để mời thành viên — họ cần đăng ký tài khoản trước.`
          }
        />
      )}

      {filteredMembers.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {paging.paged.map((m) => (
            <MemberRow
              key={m.user_id}
              member={m}
              isSelf={m.user_id === userId}
              onOpen={() => setPanel({ mode: "view", member: m })}
            />
          ))}
        </ul>
      )}

      {filteredMembers.length > 0 && (
        <Pagination
          page={paging.page}
          totalPages={paging.totalPages}
          total={paging.total}
          pageSize={paging.pageSize}
          unit={t`thành viên`}
          onPageChange={paging.setPage}
          pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
          onPageSizeChange={paging.setPageSize}
        />
      )}

      <SidePanel
        open={panel !== null}
        title={panel?.mode === "edit" ? t`Sửa thành viên` : t`Thành viên`}
        subtitle={panel?.member.display_name ?? undefined}
        onClose={() => setPanel(null)}
        guard={panel?.mode === "edit"}
      >
        {panel && (
          <MemberForm
            key={`${panel.mode}-${panel.member.user_id}`}
            clanId={clanId}
            member={panel.member}
            isSelf={panel.member.user_id === userId}
            readOnly={panel.mode === "view"}
            onEdit={() => setPanel({ mode: "edit", member: panel.member })}
            onCancel={() =>
              setPanel(
                panel.mode === "edit"
                  ? { mode: "view", member: panel.member }
                  : null,
              )
            }
            onSaved={() => {
              setPanel(null);
              queryClient.invalidateQueries({
                queryKey: queryKeys.clanMembers(clanId, userId),
              });
            }}
            onRemove={async () => {
              const ok = await confirm({
                title: t`Xoá ${panel.member.display_name ?? "thành viên"} khỏi clan?`,
                description: t`Tài khoản người đó vẫn tồn tại trên hệ thống, chỉ bị gỡ khỏi dòng họ này.`,
                confirmLabel: t`Xoá`,
                destructive: true,
              });
              if (ok) removeMutation.mutate(panel.member.user_id);
            }}
          />
        )}
      </SidePanel>
    </div>
  );
}

/** Trạng thái ngăn kéo: xem (chỉ đọc) hoặc sửa vai trò / xác nhận tự xưng của một thành viên. */
type PanelState = { mode: "view" | "edit"; member: ClanMember } | null;

/** Vai trò: quản trị = chính; biên tập = xanh dương; xem = xám. */
const ROLE_STYLE: Record<
  ClanRole,
  { tone: ChipTone; icon: React.ComponentType<{ className?: string }> }
> = {
  admin: { tone: "primary", icon: IconShield },
  editor: { tone: "info", icon: IconPencil },
  viewer: { tone: "neutral", icon: IconUser },
};

function MemberRow({
  member: m,
  isSelf,
  onOpen,
}: {
  member: ClanMember;
  isSelf: boolean;
  onOpen: () => void;
}) {
  const role = ROLE_STYLE[m.role];
  const RoleIcon = role.icon;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-stretch gap-3 p-3 text-left transition-colors hover:bg-muted/40"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {m.display_name ?? "(chưa đặt tên)"}
          </p>
          <p className="text-xs text-muted-foreground/80">
            Tham gia {new Date(m.created_at).toLocaleDateString("vi-VN")}
          </p>
          {m.self_person_id && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              Tự xưng: {m.self_person_full_name ?? "(người đã xoá)"}
            </p>
          )}
          <div className="mt-2 flex flex-wrap justify-end gap-1.5">
            {isSelf && (
              <Chip tone="neutral" icon={<IconUser />}>
                {t`Bạn`}
              </Chip>
            )}
            {m.self_person_id && (
              <Chip
                tone={m.self_person_verified ? "success" : "warning"}
                icon={<IconCheck />}
              >
                {m.self_person_verified ? t`Đã xác nhận` : t`Chờ xác nhận`}
              </Chip>
            )}
            <Chip tone={role.tone} icon={<RoleIcon />}>
              {ROLE_LABEL[m.role]}
            </Chip>
          </div>
        </div>
      </button>
    </li>
  );
}

function MemberForm({
  clanId,
  member: m,
  isSelf,
  readOnly,
  onEdit,
  onCancel,
  onSaved,
  onRemove,
}: {
  clanId: string;
  member: ClanMember;
  isSelf: boolean;
  readOnly: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
  onRemove: () => void;
}) {
  const toast = useToast();
  const [role, setRole] = useState<ClanRole>(m.role);
  const [verified, setVerified] = useState(m.self_person_verified);
  const [name, setName] = useState(m.display_name ?? "");
  const [selfId, setSelfId] = useState(m.self_person_id ?? "");
  const nameChanged = name.trim() !== (m.display_name ?? "");
  const selfChanged = selfId !== (m.self_person_id ?? "");
  const changed =
    role !== m.role ||
    verified !== m.self_person_verified ||
    nameChanged ||
    selfChanged;

  // Danh sách người trong cây để chọn "Tự xưng là" — chỉ tải khi đang sửa.
  const { data: kin } = useQuery({
    queryKey: ["kinship-index", clanId, "member-form"],
    queryFn: () => getKinshipIndex(clanId),
    enabled: !readOnly,
    staleTime: 5 * 60_000,
  });
  const personOptions = useMemo(
    () =>
      (kin?.ordered ?? []).map((p) => ({
        value: p.id,
        label: p.birth_year ? `${p.full_name} (${p.birth_year})` : p.full_name,
      })),
    [kin],
  );

  const saveM = useMutation({
    // Chỉ gọi những thao tác thật sự đổi; dừng ở lỗi đầu tiên.
    mutationFn: async () => {
      if (nameChanged) await adminSetMemberDisplayName(clanId, m.user_id, name);
      if (role !== m.role) await changeMemberRole(clanId, m.user_id, role);
      if (selfChanged) {
        await adminSetMemberSelfPerson(
          clanId,
          m.user_id,
          selfId || null,
          verified,
        );
      } else if (verified !== m.self_person_verified) {
        await setMemberSelfVerified(clanId, m.user_id, verified);
      }
    },
    onSuccess: () => {
      toast.success(t`Đã cập nhật thành viên`);
      onSaved();
    },
    onError: (e) =>
      toast.error(t`Không lưu được`, { description: (e as Error).message }),
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
          <Label htmlFor="mem-name">{t`Tên hiển thị`}</Label>
          <Input
            id="mem-name"
            icon={<IconUser />}
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
          />
          {!readOnly && (
            <p className="text-xs text-muted-foreground">
              {t`Tên này là tên tài khoản của người ấy, hiện ở mọi dòng họ họ tham gia.`}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mem-joined">{t`Ngày tham gia`}</Label>
          <Input
            id="mem-joined"
            icon={<IconCalendar />}
            value={new Date(m.created_at).toLocaleDateString("vi-VN")}
            readOnly
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mem-role">{t`Vai trò`}</Label>
          <Select
            id="mem-role"
            icon={<IconShield />}
            value={role}
            disabled={isSelf}
            onChange={(e) => setRole(e.target.value as ClanRole)}
          >
            <option value="viewer">Xem</option>
            <option value="editor">{t`Biên tập`}</option>
            <option value="admin">{t`Quản trị`}</option>
          </Select>
          {isSelf && (
            <p className="text-xs text-muted-foreground">{t`Không tự đổi vai trò của chính mình.`}</p>
          )}
        </div>
        {/* Tự xưng: hiện khi thành viên đã chọn mình trong cây. Admin xác nhận để huy hiệu
            "admin đã xác nhận" ở trang phả hệ có ý nghĩa. */}
        {(m.self_person_id || !readOnly) && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="mem-self">{t`Tự xưng là`}</Label>
              {readOnly ? (
                <Input
                  id="mem-self"
                  icon={<IconUser />}
                  value={m.self_person_full_name ?? "(người đã xoá)"}
                  readOnly
                />
              ) : (
                <FilterableSelect
                  id="mem-self"
                  icon={<IconUser />}
                  value={selfId}
                  onChange={setSelfId}
                  options={personOptions}
                  emptyLabel={t`(Chưa gắn với người nào)`}
                  filterLabel={t`Tìm người trong cây`}
                />
              )}
              {selfId && (
                <Link
                  to={`/clans/${clanId}/people/${selfId}`}
                  className="inline-block text-sm text-primary hover:underline"
                >
                  {t`Mở trang người này →`}
                </Link>
              )}
            </div>
            {selfId && (
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={verified}
                  onChange={(e) => setVerified(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-primary"
                />
                <span>
                  <span className="font-medium">{t`Đã xác nhận tự xưng`}</span>
                  <span className="block text-sm text-muted-foreground">
                    {t`Bật khi bạn chắc người này đúng là người trong cây.`}
                  </span>
                </span>
              </label>
            )}
          </>
        )}
      </ReadOnlyFieldset>

      <ViewEditActions
        readOnly={readOnly}
        onEdit={onEdit}
        onCancel={onCancel}
        onDelete={isSelf ? undefined : onRemove}
        saving={saveM.isPending}
        canSave={changed}
      />
    </form>
  );
}

const ROLE_LABEL: Record<ClanRole, string> = {
  admin: "Quản trị",
  editor: "Biên tập",
  viewer: "Xem",
};
