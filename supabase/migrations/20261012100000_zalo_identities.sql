-- ============================================================================
-- zalo_identities — nối ID người dùng Zalo (theo Mini App) với tài khoản
-- trong auth.users, để đăng nhập từ Zalo Mini App không cần mật khẩu.
--
-- RLS bật và KHÔNG CÓ POLICY NÀO (khuôn của fb_page_credentials): chỉ edge
-- function `zalo-auth` chạy bằng service role mới đọc/ghi được. Bảng này
-- quyết định "ID Zalo nào vào được tài khoản nào" — để client ghi được vào
-- đây là ai cũng tự gắn Zalo của mình vào tài khoản người khác.
--
-- Một ID Zalo ↔ một tài khoản (khoá chính), và một tài khoản ↔ một ID Zalo
-- (unique): ID Zalo cấp theo từng Mini App nên một người chỉ có một.
-- ============================================================================

create table public.zalo_identities (
  zalo_user_id text primary key,
  user_id      uuid not null unique references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_login_at timestamptz
);

alter table public.zalo_identities enable row level security;

comment on table public.zalo_identities is
  'ID Zalo (theo Mini App) ↔ auth.users. Chỉ service role; không có policy.';
