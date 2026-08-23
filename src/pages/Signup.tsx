import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { AuthLayout } from "@/components/AuthLayout";
import { IconLock, IconMail, IconUser, IconUserPlus } from "@/components/icons";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName || email.split("@")[0] },
          emailRedirectTo: `${window.location.origin}${next ?? "/clans"}`,
        },
      });
      if (error) setError(error.message);
      else navigate(next ?? "/");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Tạo tài khoản" subtitle="Bắt đầu xây dựng dòng họ">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="display_name">Tên hiển thị</Label>
          <Input
            icon={<IconUser />}
            id="display_name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Nguyễn Văn A"
            autoComplete="name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" required>
            Email
          </Label>
          <Input
            icon={<IconMail />}
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" required>
            Mật khẩu
          </Label>
          <Input
            icon={<IconLock />}
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">Tối thiểu 8 ký tự.</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? (
            "Đang tạo…"
          ) : (
            <>
              <IconUserPlus className="h-4 w-4 mr-1.5" />
              Tạo tài khoản
            </>
          )}
        </Button>

        <p className="text-center text-base text-muted-foreground">
          Đã có tài khoản?{" "}
          <Link to={loginHref} className="text-primary hover:underline">
            Đăng nhập
          </Link>
        </p>

        <SocialAuthButtons
          redirectTo={next ? `${window.location.origin}${next}` : undefined}
        />
      </form>
    </AuthLayout>
  );
}
