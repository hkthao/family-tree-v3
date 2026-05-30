import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AuthLayout } from "@/components/AuthLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

type Mode = "password" | "magic-link";

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "password") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
        else navigate("/");
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) setError(error.message);
        else setInfo("Đã gửi liên kết đăng nhập. Kiểm tra email của bạn.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Đăng nhập" subtitle="Truy cập dòng họ của bạn">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
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

        {mode === "password" && (
          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {info && (
          <Alert>
            <AlertDescription>{info}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy
            ? "Đang xử lý…"
            : mode === "password"
              ? "Đăng nhập"
              : "Gửi liên kết qua email"}
        </Button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "password" ? "magic-link" : "password");
            setError(null);
            setInfo(null);
          }}
          className="block w-full text-center text-base text-primary hover:underline"
        >
          {mode === "password"
            ? "Đăng nhập bằng liên kết qua email"
            : "Dùng mật khẩu"}
        </button>

        <p className="text-center text-base text-muted-foreground">
          Chưa có tài khoản?{" "}
          <Link to="/signup" className="text-primary hover:underline">
            Đăng ký
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
