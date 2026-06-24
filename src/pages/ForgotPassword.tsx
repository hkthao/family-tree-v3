import { useState } from "react";
import { Link } from "react-router-dom";

import { AuthLayout } from "@/components/AuthLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) setError(error.message);
      else setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Quên mật khẩu"
      subtitle="Nhập email để nhận liên kết đặt lại mật khẩu"
    >
      {sent ? (
        <div className="space-y-5">
          <Alert>
            <AlertDescription>
              Nếu email có trong hệ thống, chúng tôi đã gửi liên kết đặt lại
              mật khẩu. Kiểm tra hộp thư (cả thư mục spam) và bấm vào liên kết
              để đặt mật khẩu mới.
            </AlertDescription>
          </Alert>
          <Link
            to="/login"
            className="block text-center text-base text-primary hover:underline"
          >
            ← Về đăng nhập
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" required>
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ban@example.com"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Đang gửi…" : "Gửi liên kết đặt lại"}
          </Button>

          <p className="text-center text-base text-muted-foreground">
            Nhớ ra rồi?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Về đăng nhập
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
