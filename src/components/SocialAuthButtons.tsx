import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

type OAuthProvider = "google" | "facebook";

// Tạm ẩn nút Facebook: app Facebook chưa trả email về GoTrue
// ("Error getting user email from external provider") nên không tạo được
// tài khoản. Đổi thành true khi đã bật Advanced Access cho quyền `email`
// và chuyển app Facebook sang Live.
const SHOW_FACEBOOK = false;

interface Props {
  /** Where Supabase should redirect after the provider OAuth flow. */
  redirectTo?: string;
}

/**
 * "Tiếp tục với Google / Facebook / Apple" buttons.
 *
 * Each one calls `supabase.auth.signInWithOAuth` — that redirects the
 * browser to the provider, the provider redirects back to Supabase
 * (`<project>.supabase.co/auth/v1/callback`), and Supabase finally
 * redirects to `redirectTo` with a session set.
 *
 * Brand glyphs are inlined as monochrome SVGs (currentColor) for
 * theme parity. If brand-strict colour is required later (Google's
 * sign-in guidelines, e.g.), swap for the official assets per provider.
 *
 * Supabase Dashboard requirement: each provider has to be enabled in
 * Authentication → Providers and given a Client ID + Secret. Until
 * that's done, the buttons return "provider is not enabled".
 */
export function SocialAuthButtons({ redirectTo }: Props) {
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(provider: OAuthProvider) {
    setError(null);
    setBusy(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        // Redirect straight to /clans rather than `/`. The root path
        // renders `<Navigate to="/clans" replace />` synchronously
        // during the first React commit, which strips the
        // `#access_token=…` hash from window.location BEFORE
        // Supabase JS gets a chance to parse it — session never
        // hydrates, RequireAuth then bounces the user to /login.
        // Landing directly on /clans avoids the racing redirect.
        redirectTo: redirectTo ?? `${window.location.origin}/clans`,
      },
    });
    // On success the browser is already redirecting — we only fall through
    // on synchronous setup errors (provider disabled, popup blocked, etc.).
    if (error) {
      setError(error.message);
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-divider" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-3 text-xs text-muted-foreground uppercase tracking-wider">
            hoặc tiếp tục với
          </span>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className={SHOW_FACEBOOK ? "grid grid-cols-2 gap-2" : "grid grid-cols-1 gap-2"}>
        <ProviderButton
          label="Google"
          onClick={() => signIn("google")}
          busy={busy === "google"}
          disabled={busy !== null}
          icon={<GoogleGlyph />}
        />
        {SHOW_FACEBOOK && (
          <ProviderButton
            label="Facebook"
            onClick={() => signIn("facebook")}
            busy={busy === "facebook"}
            disabled={busy !== null}
            icon={<FacebookGlyph />}
          />
        )}
      </div>
    </div>
  );
}

function ProviderButton({
  label,
  onClick,
  busy,
  disabled,
  icon,
}: {
  label: string;
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Tiếp tục với ${label}`}
      title={`Tiếp tục với ${label}`}
      className="w-full"
    >
      {busy ? (
        <span className="text-sm">…</span>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          {icon}
          <span className="hidden sm:inline text-sm">{label}</span>
        </span>
      )}
    </Button>
  );
}

// ─── Brand glyphs ────────────────────────────────────────────────────

export function GoogleGlyph() {
  // Multi-coloured G — required by Google's branding guidelines for
  // "Sign in with Google" buttons. Hand-crafted so it doesn't bring a
  // dependency for one glyph.
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function FacebookGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854V15.469H7.078V12h3.047V9.356c0-3.007 1.792-4.668 4.533-4.668 1.312 0 2.686.234 2.686.234v2.953H15.83c-1.491 0-1.956.925-1.956 1.874V12h3.328l-.532 3.469h-2.796v8.385C19.612 22.954 24 17.99 24 12z"
      />
    </svg>
  );
}

