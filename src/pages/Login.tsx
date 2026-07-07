import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { AuthLayout } from "@/components/AuthLayout";
import { IconLogIn, IconQrCode } from "@/components/icons";
import { QrScannerModal } from "@/components/QrScannerModal";
import { GoogleGlyph } from "@/components/SocialAuthButtons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { track } from "@/lib/analytics";
import { supabase } from "@/lib/supabase";

type Mode = "password" | "magic-link";

/** Chỉ nhận đường dẫn nội bộ (bắt đầu "/" nhưng không "//") để chống open-redirect. */
function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : "/signup";
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Form email/mật khẩu là phụ — mặc định ẩn để không "dội" khách mới. Người
  // đã có tài khoản bấm "Đăng nhập bằng email" để mở.
  const [showEmail, setShowEmail] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Đăng nhập bằng Google (1 chạm) — kênh chính. Sau OAuth quay lại đúng link
  // khách muốn xem (next) hoặc /clans.
  async function signInGoogle() {
    track("login_click", { method: "google" });
    setOauthError(null);
    setOauthBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: next
          ? `${window.location.origin}${next}`
          : `${window.location.origin}/clans`,
      },
    });
    // Thành công thì trình duyệt đang chuyển hướng; chỉ rơi vào đây khi lỗi.
    if (error) {
      setOauthError(error.message);
      setOauthBusy(false);
    }
  }

  function onScan(text: string) {
    setScannerOpen(false);
    // Trust only same-origin URLs (or relative). Anything else is
    // a hostile QR (sneaky phishing payload).
    try {
      const url = new URL(text, window.location.origin);
      if (url.origin !== window.location.origin) {
        setError("Mã QR không thuộc Dòng Họ Việt. Bỏ qua để bảo vệ tài khoản.");
        return;
      }
      // Hard-navigate so Supabase JS picks up the hash/code on
      // the fresh load.
      window.location.href = url.toString();
    } catch {
      setError("Mã QR không hợp lệ.");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "password") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
        else {
          track("signed_in", { method: "password" });
          navigate(next ?? "/");
        }
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}${next ?? "/clans"}`,
          },
        });
        if (error) setError(error.message);
        else {
          track("login_link_sent");
          setInfo("Đã gửi liên kết đăng nhập. Kiểm tra email của bạn.");
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Đăng nhập"
      subtitle="Xem cây gia phả và cùng vun đắp dòng họ của bạn."
    >
      <div className="space-y-5">
        {/* Google — kênh chính, nút to, 1 chạm, không cần nhớ mật khẩu. */}
        <div className="space-y-2">
          <Button
            type="button"
            onClick={signInGoogle}
            disabled={oauthBusy}
            className="w-full h-12 text-base"
          >
            {oauthBusy ? (
              "Đang chuyển tới Google…"
            ) : (
              <span className="inline-flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-white">
                  <GoogleGlyph />
                </span>
                Tiếp tục với Google
              </span>
            )}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Nhanh &amp; an toàn — không cần nhớ mật khẩu.
          </p>
          {oauthError && (
            <Alert variant="destructive">
              <AlertDescription>{oauthError}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* Đăng nhập bằng email/mật khẩu — phụ, ẩn sau một nút gạt. */}
        {!showEmail ? (
          <button
            type="button"
            onClick={() => setShowEmail(true)}
            className="block w-full text-center text-base text-primary hover:underline"
          >
            Đăng nhập bằng email &amp; mật khẩu
          </button>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5 border-t border-divider pt-5">
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

            {mode === "password" && (
              <div className="space-y-2">
                <Label htmlFor="password" required>
                  Mật khẩu
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <div className="text-right">
                  <Link
                    to="/forgot-password"
                    className="text-sm text-primary hover:underline"
                  >
                    Quên mật khẩu?
                  </Link>
                </div>
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

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? (
                "Đang xử lý…"
              ) : (
                <>
                  <IconLogIn className="h-4 w-4 mr-1.5" />
                  {mode === "password" ? "Đăng nhập" : "Gửi liên kết qua email"}
                </>
              )}
            </Button>

            {mode === "password" && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setScannerOpen(true)}
              >
                <IconQrCode className="h-4 w-4 mr-1.5" />
                Đăng nhập nhanh (quét mã QR)
              </Button>
            )}

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
          </form>
        )}

        <p className="text-center text-base text-muted-foreground">
          Chưa có tài khoản?{" "}
          <Link to={signupHref} className="text-primary hover:underline">
            Đăng ký
          </Link>
        </p>
      </div>

      <QrScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDecode={onScan}
        title="Quét mã QR"
        description="Hướng camera vào mã QR hiển thị trên thiết bị đã đăng nhập (Tài khoản → Đăng nhập trên điện thoại)."
      />
    </AuthLayout>
  );
}
