import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { PageHeader } from "@/components/PageHeader";
import { useConfirm } from "@/components/ConfirmDialog";
import { InviteLinkCard } from "@/components/InviteLinkCard";
import { useToast } from "@/components/Toast";
import { IconCheck, IconMail, IconShield, IconTrash, IconUserPlus } from "@/components/icons";
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
import { useAuth } from "@/hooks/useAuth";
import { useClanContext } from "@/hooks/useClanContext";
import { queryKeys } from "@/lib/queries/keys";
import {
  changeMemberRole,
  inviteMemberByEmail,
  listClanMembers,
  removeMember,
  setMemberSelfVerified,
  type ClanRole,
} from "@/lib/queries/members";

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

  const verifySelfMutation = useMutation({
    mutationFn: (args: { uid: string; verified: boolean }) =>
      setMemberSelfVerified(clanId!, args.uid, args.verified),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.clanMembers(clanId ?? "", userId),
      });
    },
    onError: (e) =>
      toast.error("Không cập nhật được", { description: (e as Error).message }),
  });

  const inviteMutation = useMutation({
    mutationFn: () => inviteMemberByEmail(clanId!, inviteEmail.trim(), inviteRole),
    onSuccess: async (res) => {
      if (res.ok) {
        setInviteMessage({
          kind: "success",
          text: `Đã thêm ${inviteEmail} với vai trò ${ROLE_LABEL[inviteRole]}.`,
        });
        toast.success("Đã thêm thành viên", {
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
              ? `Không tìm thấy tài khoản có email ${inviteEmail}. Họ cần đăng ký trước.`
              : `${inviteEmail} đã là thành viên.`,
        });
      }
    },
    onError: (e) => {
      setInviteMessage({ kind: "error", text: (e as Error).message });
      toast.error("Không thêm được", { description: (e as Error).message });
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ uid, role }: { uid: string; role: ClanRole }) =>
      changeMemberRole(clanId!, uid, role),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.clanMembers(clanId!, userId),
      });
      toast.success(`Đã đổi vai trò sang ${ROLE_LABEL[vars.role]}`);
    },
    onError: (e) =>
      toast.error("Không đổi được", { description: (e as Error).message }),
  });

  const removeMutation = useMutation({
    mutationFn: (uid: string) => removeMember(clanId!, uid),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.clanMembers(clanId!, userId),
      });
      toast.success("Đã xoá thành viên");
    },
    onError: (e) =>
      toast.error("Không xoá được", { description: (e as Error).message }),
  });

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
          { label: "Thành viên" },
        ]}
      />

      <PageHeader
        icon={<IconUserPlus className="h-7 w-7" />}
        title="Thành viên"
        description="Mời người, đổi vai trò, gỡ thành viên."
      />

        <InviteLinkCard clanId={clanId} clanName={clan.name} />

        <Card>
          <CardHeader>
            <CardTitle>Mời bằng email</CardTitle>
            <CardDescription>
              Người được mời cần có sẵn tài khoản (đã đăng ký bằng email
              tương ứng). Chưa có cơ chế gửi mail mời tự động.
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
                <legend className="text-base font-medium mb-2">Vai trò</legend>
                <div className="flex flex-wrap gap-3">
                  {(["viewer", "editor", "admin"] as ClanRole[]).map((r) => (
                    <label key={r} className="flex items-center gap-3 cursor-pointer">
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
                  "Đang mời…"
                ) : (
                  <>
                    <IconUserPlus className="h-4 w-4 mr-1.5" />
                    Mời
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Danh sách thành viên</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <p className="text-muted-foreground">Đang tải…</p>}
            {members && members.length === 0 && (
              <p className="text-muted-foreground">
                Chưa có ai khác. Dùng ô email phía trên để mời thành viên — họ
                cần đăng ký tài khoản trước, sau đó bạn gõ đúng email để gửi
                lời mời.
              </p>
            )}
            {members && members.length > 0 && (
              <ul className="divide-y">
                {members.map((m) => (
                  <li key={m.user_id} className="py-3 space-y-2">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {m.display_name ?? "(chưa đặt tên)"}
                          {m.user_id === userId && (
                            <span className="ml-2 text-sm text-muted-foreground">
                              (bạn)
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Tham gia: {new Date(m.created_at).toLocaleDateString("vi-VN")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={m.role}
                          disabled={m.user_id === userId}
                          onChange={(e) =>
                            roleMutation.mutate({
                              uid: m.user_id,
                              role: e.target.value as ClanRole,
                            })
                          }
                          icon={<IconShield />}
                          className="h-10 w-auto text-sm"
                          aria-label={`Vai trò của ${m.display_name ?? m.user_id}`}
                        >
                          <option value="viewer">Xem</option>
                          <option value="editor">Biên tập</option>
                          <option value="admin">Quản trị</option>
                        </Select>
                        {m.user_id !== userId && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={async () => {
                              const ok = await confirm({
                                title: `Xoá ${m.display_name ?? "thành viên"} khỏi clan?`,
                                description:
                                  "Tài khoản người đó vẫn tồn tại trên hệ thống, chỉ bị gỡ khỏi dòng họ này.",
                                confirmLabel: "Xoá",
                                destructive: true,
                              });
                              if (ok) removeMutation.mutate(m.user_id);
                            }}
                            disabled={removeMutation.isPending}
                            aria-label="Xoá thành viên"
                          >
                            <IconTrash className="h-4 w-4 sm:mr-1.5" />
                            <span className="hidden sm:inline">Xoá</span>
                          </Button>
                        )}
                      </div>
                    </div>
                    {/* Self-person claim — shown when the member has
                        picked themselves in the tree. Admin gets a
                        verify toggle so the ✓ admin-confirmed badge
                        on the lineage page is meaningful. */}
                    {m.self_person_id && (
                      <div className="flex items-center justify-between gap-2 flex-wrap text-sm pl-1 border-l-2 border-muted ml-1">
                        <div className="min-w-0">
                          <span className="text-muted-foreground mr-1">Tự xưng:</span>
                          <Link
                            to={`/clans/${clanId}/people/${m.self_person_id}`}
                            className="font-medium hover:text-primary"
                          >
                            {m.self_person_full_name ?? "(người đã xoá)"}
                          </Link>
                          {m.self_person_verified ? (
                            <span className="ml-2 inline-flex items-center gap-1 text-xs text-accent">
                              <IconCheck className="h-3.5 w-3.5" />
                              Đã xác nhận
                            </span>
                          ) : (
                            <span className="ml-2 text-xs text-muted-foreground">
                              Chờ xác nhận
                            </span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant={m.self_person_verified ? "outline" : "default"}
                          onClick={() =>
                            verifySelfMutation.mutate({
                              uid: m.user_id,
                              verified: !m.self_person_verified,
                            })
                          }
                          disabled={verifySelfMutation.isPending}
                        >
                          <IconCheck className="h-4 w-4 mr-1.5" />
                          {m.self_person_verified ? "Bỏ xác nhận" : "Xác nhận"}
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

const ROLE_LABEL: Record<ClanRole, string> = {
  admin: "Quản trị",
  editor: "Biên tập",
  viewer: "Xem",
};
