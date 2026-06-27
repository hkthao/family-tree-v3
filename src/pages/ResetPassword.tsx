import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AuthLayout } from "@/components/AuthLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Recovery session: supabase-js parses the token from the email link's
  // URL on load and fires PASSWORD_RECOVERY. We gate the form on having a
  // session so a direct visit (no link) shows guidance instead.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) {
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Mật khẩu tối thiểu 8 ký tự.");
      return;
    }
    if (password !== confirm) {
      setError("Mật khẩu nhập lại không khớp.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) setError(error.message);
      else setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Đặt lại mật khẩu" subtitle="Nhập mật khẩu mới cho tài khoản">
      {done ? (
        <div className="space-y-5">
          <Alert>
            <AlertDescription>
              Đã đổi mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.
            </AlertDescription>
          </Alert>
          <Button className="w-full" onClick={() => navigate("/")}>
            Vào ứng dụng
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="password" required>
              Mật khẩu mới
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm" required>
              Nhập lại mật khẩu
            </Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          {!ready && (
            <Alert>
              <AlertDescription>
                Đang xác thực liên kết… Nếu bạn mở trực tiếp trang này, hãy bấm
                vào liên kết trong email "Đặt lại mật khẩu Dòng Họ Việt".
              </AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={busy || !ready}>
            {busy ? "Đang lưu…" : "Đổi mật khẩu"}
          </Button>

          <Link
            to="/login"
            className="block text-center text-base text-primary hover:underline"
          >
            ← Về đăng nhập
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
