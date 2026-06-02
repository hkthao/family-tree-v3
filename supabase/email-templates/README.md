# Supabase Auth email templates — Gia phả branding

Vietnamese-language transactional emails styled to match the
app's cream-paper + oxblood palette.

## Files

| File | Supabase template | Subject |
|---|---|---|
| `confirm-signup.html`  | Confirm signup           | Xác nhận đăng ký Gia phả |
| `magic-link.html`      | Magic Link               | Đăng nhập Gia phả |
| `reset-password.html`  | Reset Password           | Đặt lại mật khẩu Gia phả |
| `change-email.html`    | Change Email Address     | Xác nhận đổi email Gia phả |
| `invite.html`          | Invite user              | Bạn được mời vào Gia phả |
| `reauth.html`          | Reauthentication         | Mã xác thực Gia phả |

## How to install

1. Open <https://supabase.com/dashboard/project/_/auth/templates> for
   the target project.
2. Click each template (left sidebar), paste the matching subject
   string + HTML body, save.
3. Verify the variables in each — Supabase substitutes
   `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .Token }}`,
   `{{ .SiteURL }}` at send time.

## Required first

The "Site URL" in **Authentication → URL Configuration** must point
at the production host (e.g. `https://family-tree-v3.netlify.app`)
or magic links and confirmation links resolve to `localhost`. Add
`https://family-tree-v3.netlify.app/**` plus
`http://localhost:5173/**` to the redirect allowlist for dev.

## Why HTML and not Markdown

Supabase Auth templates are pure HTML. The styles below use inline
`style="..."` rather than a `<style>` block because Gmail / Outlook
strip `<style>` from the `<head>` of received messages.

## Editing tips

- The header strip is `text-transform: uppercase` "GIA PHẢ" so any
  language tweak keeps the brand cue.
- The CTA button uses background `#7A2230` (oxblood) + foreground
  `#FBF7F0` (cream). Match these if you rebrand.
- Body width capped at `max-width: 560px` for desktop Gmail; the
  outer wrapper falls back to viewport width on mobile.
