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
type MagicStep = "request" | "verify";

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("magic-link");
  const [step, setStep] = useState<MagicStep>("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
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
      } else if (step === "request") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) setError(error.message);
        else {
          setInfo(
            "Đã gửi email. Bấm liên kết trong thư, HOẶC nhập mã 6 số dưới đây nếu nút trong email không hoạt động.",
          );
          setStep("verify");
        }
      } else {
        // Verify OTP code directly — works even if magic-link
        // redirect flow fails (cross-device, SW cache, etc.).
        const { error } = await supabase.auth.verifyOtp({
          email,
          token: otp.trim(),
          type: "email",
        });
        if (error) setError(error.message);
        else navigate("/");
      }
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
    setStep("request");
    setOtp("");
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

        {mode === "magic-link" && step === "request" && (
          <p className="text-sm text-muted-foreground -mt-2">
            Không cần mật khẩu. Bấm gửi, vào hộp thư, bấm liên kết —
            đăng nhập ngay.
          </p>
        )}

        {mode === "magic-link" && step === "verify" && (
          <div className="space-y-2">
            <Label htmlFor="otp">Mã 6 số (lấy trong email)</Label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={8}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\s/g, ""))}
              placeholder="VD: 85384813"
              className="font-mono tracking-widest text-lg"
            />
            <button
              type="button"
              onClick={() => {
                setStep("request");
                setOtp("");
                setError(null);
                setInfo(null);
              }}
              className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              ← Gửi lại email
            </button>
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
          {busy ? (
            "Đang xử lý…"
          ) : (
            <>
              <IconLogIn className="h-5 w-5 mr-2" />
              {mode === "password"
                ? "Đăng nhập"
                : step === "request"
                  ? "Gửi liên kết qua email"
                  : "Xác nhận đăng nhập"}
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
