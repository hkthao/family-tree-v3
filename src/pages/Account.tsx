import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { QrSignInButton } from "@/components/QrSignInButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/components/Toast";
import {
  IconCheck,
  IconLogOut,
  IconShield,
  IconTrash,
  IconX,
} from "@/components/icons";
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
import { clearAllCache } from "@/lib/queryClient";
import { signOutAndClearCache } from "@/lib/auth-actions";
import { queryKeys } from "@/lib/queries/keys";
import {
  countMyBlockingClans,
  deleteMyAccount,
  getMyProfile,
  updateMyDisplayName,
  updateMyMonthlyLunarPref,
} from "@/lib/queries/profile";
import { supabase } from "@/lib/supabase";

export default function Account() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: queryKeys.myProfile(userId),
    queryFn: () => getMyProfile(userId),
    enabled: !!userId,
  });

  return (
    <div className="min-h-dvh bg-background lg:pl-72">
      <AppHeader />
      <main className="container max-w-4xl py-6 px-4 space-y-6">
        <h1 className="clan-name text-3xl font-semibold">Tài khoản</h1>

        {profile?.is_platform_admin && (
          <Card className="border-accent/40">
            <CardHeader>
              <CardTitle className="text-accent">Quản trị nền tảng</CardTitle>
              <CardDescription>
                Bạn có quyền platform admin: chỉnh giới hạn user/clan, khoá
                tài khoản, gán quyền.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link to="/admin">
                  <IconShield className="h-4 w-4 mr-1.5" />
                  Mở trang quản trị
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <DisplayNameCard
          userId={userId}
          current={profile?.display_name ?? null}
          queryClient={queryClient}
        />

        <MonthlyLunarCard
          userId={userId}
          enabled={profile?.notify_monthly_lunar ?? false}
          queryClient={queryClient}
        />

        <EmailCard currentEmail={user?.email ?? null} />

        <PasswordCard />

        <Card>
          <CardHeader>
            <CardTitle>Giao diện</CardTitle>
            <CardDescription>
              Chế độ màu cho riêng tài khoản này trên thiết bị hiện tại.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeToggle />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Đăng nhập trên điện thoại</CardTitle>
            <CardDescription>
              Hiện mã QR — mở camera điện thoại, quét để đăng nhập cùng
              tài khoản, không phải gõ mật khẩu. Mã hiệu lực ~5 phút và
              chỉ dùng được một lần.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QrSignInButton />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Đăng xuất</CardTitle>
            <CardDescription>
              Sẽ xoá cache cục bộ trên máy này (an toàn khi dùng chung máy).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={signOutAndClearCache}
              className="w-full sm:w-auto"
            >
              <IconLogOut className="h-4 w-4 mr-1.5" />
              Đăng xuất
            </Button>
          </CardContent>
        </Card>

        <DeleteAccountCard
          userId={userId}
          onDeleted={async () => {
            await clearAllCache();
            navigate("/login", { replace: true });
          }}
        />
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface DisplayNameProps {
  userId: string;
  current: string | null;
  queryClient: ReturnType<typeof useQueryClient>;
}

function DisplayNameCard({ userId, current, queryClient }: DisplayNameProps) {
  const [name, setName] = useState(current ?? "");

  useEffect(() => {
    setName(current ?? "");
  }, [current]);

  const toast = useToast();
  const m = useMutation({
    mutationFn: () => updateMyDisplayName(userId, name.trim()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.myProfile(userId) });
      toast.success("Đã đổi tên hiển thị");
    },
    onError: (e) =>
      toast.error("Không lưu được", { description: (e as Error).message }),
  });

  const changed = name.trim() !== (current ?? "").trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tên hiển thị</CardTitle>
        <CardDescription>
          Tên hiển thị trong dòng họ và các sự kiện. Không phải email.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (changed && name.trim()) m.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="display-name">Tên hiển thị</Label>
            <Input
              id="display-name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {m.error && (
            <Alert variant="destructive">
              <AlertDescription>{(m.error as Error).message}</AlertDescription>
            </Alert>
          )}
          {m.isSuccess && !changed && (
            <Alert>
              <AlertDescription>Đã lưu.</AlertDescription>
            </Alert>
          )}
          <Button
            type="submit"
            variant="outline"
            disabled={!changed || !name.trim() || m.isPending}
            className="w-full sm:w-auto"
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
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function EmailCard({ currentEmail }: { currentEmail: string | null }) {
  const toast = useToast();
  const [newEmail, setNewEmail] = useState("");

  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setNewEmail("");
      toast.success("Đã gửi email xác nhận", {
        description: "Bấm link trong email để hoàn tất.",
      });
    },
    onError: (e) =>
      toast.error("Không đổi được email", {
        description: (e as Error).message,
      }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email</CardTitle>
        <CardDescription>
          Email hiện tại: <span className="font-medium">{currentEmail ?? "—"}</span>.
          Đổi email sẽ gửi liên kết xác nhận đến địa chỉ mới (kiểm tra
          Mailpit ở local).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newEmail.trim()) m.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="new-email">Email mới</Label>
            <Input
              id="new-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="ten@vidu.com"
            />
          </div>
          {m.error && (
            <Alert variant="destructive">
              <AlertDescription>{(m.error as Error).message}</AlertDescription>
            </Alert>
          )}
          {m.isSuccess && (
            <Alert>
              <AlertDescription>
                Đã gửi email xác nhận. Mở liên kết trong email để hoàn tất đổi
                địa chỉ.
              </AlertDescription>
            </Alert>
          )}
          <Button
            type="submit"
            variant="outline"
            disabled={!newEmail.trim() || m.isPending}
            className="w-full sm:w-auto"
          >
            {m.isPending ? (
              "Đang gửi…"
            ) : (
              <>
                <IconCheck className="h-4 w-4 mr-1.5" />
                Đổi email
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function PasswordCard() {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= 8 && password === confirm;

  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setPassword("");
      setConfirm("");
      toast.success("Đã đổi mật khẩu");
    },
    onError: (e) =>
      toast.error("Không đổi được", { description: (e as Error).message }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mật khẩu</CardTitle>
        <CardDescription>Ít nhất 8 ký tự.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) m.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="pw">Mật khẩu mới</Label>
            <Input
              id="pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            {tooShort && (
              <p className="text-sm text-destructive">Tối thiểu 8 ký tự.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw2">Xác nhận mật khẩu mới</Label>
            <Input
              id="pw2"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
            {mismatch && (
              <p className="text-sm text-destructive">Không khớp.</p>
            )}
          </div>
          {m.error && (
            <Alert variant="destructive">
              <AlertDescription>{(m.error as Error).message}</AlertDescription>
            </Alert>
          )}
          {m.isSuccess && (
            <Alert>
              <AlertDescription>Đã đổi mật khẩu.</AlertDescription>
            </Alert>
          )}
          <Button
            type="submit"
            variant="outline"
            disabled={!canSubmit || m.isPending}
            className="w-full sm:w-auto"
          >
            {m.isPending ? (
              "Đang đổi…"
            ) : (
              <>
                <IconCheck className="h-4 w-4 mr-1.5" />
                Đổi mật khẩu
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

interface DeleteProps {
  userId: string;
  onDeleted: () => Promise<void> | void;
}

function DeleteAccountCard({ userId, onDeleted }: DeleteProps) {
  const toast = useToast();
  const [confirmText, setConfirmText] = useState("");
  const [expanded, setExpanded] = useState(false);

  const { data: blocking } = useQuery({
    queryKey: queryKeys.myBlockingClans(userId),
    queryFn: () => countMyBlockingClans(),
    enabled: !!userId && expanded,
  });

  const m = useMutation({
    mutationFn: () => deleteMyAccount(),
    onSuccess: () => {
      toast.success("Đã xoá tài khoản");
      onDeleted();
    },
    onError: (e) =>
      toast.error("Không xoá được", { description: (e as Error).message }),
  });

  const blockingCount = blocking ?? 0;
  const blocked = blockingCount > 0;
  const canSubmit = !blocked && confirmText === "XOA";

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Xoá tài khoản</CardTitle>
        <CardDescription>
          Hành động này không thể hoàn tác. Nếu bạn đang sở hữu dòng họ có
          thành viên, hãy chuyển quyền hoặc xoá dòng họ trước.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!expanded ? (
          <Button
            variant="outline"
            onClick={() => setExpanded(true)}
            className="w-full sm:w-auto"
          >
            <IconTrash className="h-4 w-4 mr-1.5 text-destructive" />
            Tôi muốn xoá tài khoản
          </Button>
        ) : (
          <>
            {blocked && (
              <Alert variant="destructive">
                <AlertDescription>
                  Bạn còn sở hữu {blockingCount} dòng họ có thành viên. Phải
                  chuyển quyền hoặc xoá dòng họ trước khi xoá tài khoản.
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="confirm">
                Gõ <code className="font-bold">XOA</code> để xác nhận
              </Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={blocked}
              />
            </div>
            {m.error && (
              <Alert variant="destructive">
                <AlertDescription>{(m.error as Error).message}</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-3">
              <Button
                variant="destructive"
                disabled={!canSubmit || m.isPending}
                onClick={() => m.mutate()}
              >
                {m.isPending ? (
                  "Đang xoá…"
                ) : (
                  <>
                    <IconTrash className="h-4 w-4 mr-1.5" />
                    Xoá tài khoản vĩnh viễn
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setExpanded(false);
                  setConfirmText("");
                }}
              >
                <IconX className="h-4 w-4 mr-1.5" />
                Hủy
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Mùng 1 / Rằm reminder toggle ─────────────────────────────────

function MonthlyLunarCard({
  userId,
  enabled,
  queryClient,
}: {
  userId: string;
  enabled: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const toast = useToast();
  const m = useMutation({
    mutationFn: (next: boolean) => updateMyMonthlyLunarPref(userId, next),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.myProfile(userId),
      });
    },
    onError: (e) =>
      toast.error("Không lưu được", { description: (e as Error).message }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nhắc mùng 1 / rằm âm lịch</CardTitle>
        <CardDescription>
          Mỗi ngày 1 và ngày 15 âm lịch, app gửi email nhắc thắp hương.
          Áp dụng cho tài khoản này, không phụ thuộc dòng họ nào.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => m.mutate(e.target.checked)}
            disabled={m.isPending}
            className="mt-1 h-5 w-5 accent-primary shrink-0"
          />
          <div>
            <p className="font-medium">
              {enabled ? "Đang bật — nhận email mùng 1 và rằm" : "Tắt"}
            </p>
            <p className="text-sm text-muted-foreground">
              Email gửi vào sáng sớm (cron chạy 1 lần/ngày). Bỏ tích để
              dừng.
            </p>
          </div>
        </label>
      </CardContent>
    </Card>
  );
}
