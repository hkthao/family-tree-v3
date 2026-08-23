import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { IconHome, IconLogIn, IconUserPlus, IconUsers } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { peekClanInvite, redeemClanInvite } from "@/lib/queries/clan-invites";

const ROLE_LABEL: Record<string, string> = {
  viewer: "Xem & góp ý",
  editor: "Biên tập",
};

/**
 * `/join/:token` — trang tham gia dòng họ bằng link mời. Người chưa đăng
 * nhập được mời đăng nhập/đăng ký (mang theo ?next để quay lại tự tham
 * gia). Đã đăng nhập → bấm Tham gia → redeem_clan_invite → vào dòng họ.
 */
export default function JoinClan() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);

  const peekQ = useQuery({
    queryKey: ["invite-peek", token],
    queryFn: () => peekClanInvite(token!),
    enabled: !!token,
  });

  const joinM = useMutation({
    mutationFn: () => redeemClanInvite(token!),
    onSuccess: (clanId) => navigate(`/clans/${clanId}?welcome=1`),
    onError: (e) => setErr((e as Error).message),
  });

  const next = `/join/${token}`;
  const peek = peekQ.data;

  return (
    <div className="min-h-dvh bg-background grid place-items-center px-4 py-10">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm space-y-5 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
          <IconUsers className="h-7 w-7" />
        </span>

        {peekQ.isLoading && (
          <p className="text-muted-foreground">Đang kiểm tra link mời…</p>
        )}

        {!peekQ.isLoading && (!peek || !peek.valid) && (
          <div className="space-y-3">
            <h1 className="text-xl font-semibold">Link mời không hợp lệ</h1>
            <p className="text-muted-foreground">
              Link có thể đã hết hạn hoặc bị thu hồi. Hãy xin người trong họ
              gửi lại link mới.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/">
                <IconHome className="h-4 w-4 mr-1.5" />
                Về trang chủ
              </Link>
            </Button>
          </div>
        )}

        {peek && peek.valid && (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Lời mời tham gia</p>
              <h1 className="text-2xl font-semibold clan-name">
                {peek.clan_name}
              </h1>
              <p className="text-sm text-muted-foreground">
                Quyền: {ROLE_LABEL[peek.role ?? "viewer"] ?? "Thành viên"}
              </p>
            </div>

            {err && (
              <Alert variant="destructive">
                <AlertDescription>{err}</AlertDescription>
              </Alert>
            )}

            {user ? (
              <Button
                className="w-full"
                disabled={joinM.isPending}
                onClick={() => {
                  setErr(null);
                  joinM.mutate();
                }}
              >
                <IconUserPlus className="h-4 w-4 mr-1.5" />
                {joinM.isPending ? "Đang tham gia…" : "Tham gia dòng họ"}
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Đăng nhập hoặc tạo tài khoản để tham gia.
                </p>
                <Button asChild className="w-full">
                  <Link to={`/signup?next=${encodeURIComponent(next)}`}>
                    <IconUserPlus className="h-4 w-4 mr-1.5" />
                    Tạo tài khoản
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to={`/login?next=${encodeURIComponent(next)}`}>
                    <IconLogIn className="h-4 w-4 mr-1.5" />
                    Tôi đã có tài khoản
                  </Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
