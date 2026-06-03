import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AuthLayout } from "@/components/AuthLayout";
import { IconLogIn } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

type Mode = "password" | "magic-link";

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("magic-link");
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

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
  }

  return (
    <AuthLayout title="Đăng nhập" subtitle="Truy cập dòng họ của bạn">
      {/* Mode selector — tab-style toggle. Magic-link sits on the
          left so users with a fresh device / no-password flow see
          it first (one-tap after typing email). */}
      <div
        className="inline-flex w-full rounded-md border bg-card overflow-hidden mb-5"
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "magic-link"}
          onClick={() => switchMode("magic-link")}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 h-11 text-sm font-medium ${
            mode === "magic-link"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted/50"
          }`}
        >
          Đăng nhập nhanh (email)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "password"}
          onClick={() => switchMode("password")}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 h-11 text-sm font-medium border-l ${
            mode === "password"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted/50"
          }`}
        >
          Mật khẩu
        </button>
      </div>

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

        {mode === "magic-link" && (
          <p className="text-sm text-muted-foreground -mt-2">
            Không cần mật khẩu. Bấm gửi, vào hộp thư, bấm liên kết —
            đăng nhập ngay.
          </p>
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
          {busy ? (
            "Đang xử lý…"
          ) : (
            <>
              <IconLogIn className="h-5 w-5 mr-2" />
              {mode === "password" ? "Đăng nhập" : "Gửi liên kết qua email"}
            </>
          )}
        </Button>

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
