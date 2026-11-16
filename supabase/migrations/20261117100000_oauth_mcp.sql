-- OAuth 2.1 cho máy chủ MCP (ChatGPT, Claude… tự đăng ký + người dùng bấm "Cho phép" trong app), thay cho việc dán token.
--
-- Một KẾT NỐI = một dòng `api_tokens` (tên "<ứng dụng> (OAuth)", có clan_id + scope + hạn trượt 90 ngày): hiện chung trong
-- danh sách token và thu hồi ở đó là chết ngay mọi access/refresh token của kết nối. Access token (1 giờ) và refresh
-- token (xoay vòng mỗi lần dùng) nằm ở `oauth_tokens`, chỉ lưu băm SHA-256.
--
-- Cả ba bảng mới chỉ server MCP (service role) đụng tới: bật RLS, không có policy, thu hết quyền của anon/authenticated.

create table if not exists public.oauth_clients (
  client_id      text primary key,
  client_name    text not null check (char_length(client_name) between 1 and 80),
  redirect_uris  text[] not null check (cardinality(redirect_uris) between 1 and 5),
  created_at     timestamptz not null default now(),
  last_used_at   timestamptz
);

create table if not exists public.oauth_codes (
  code_hash       text primary key check (code_hash ~ '^[0-9a-f]{64}$'),
  client_id       text not null references public.oauth_clients(client_id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  clan_id         uuid not null references public.clans(id) on delete cascade,
  scope           text not null check (scope in ('read', 'propose', 'write')),
  redirect_uri    text not null,
  code_challenge  text not null,
  expires_at      timestamptz not null,
  used_at         timestamptz,
  grant_id        uuid
);

alter table public.api_tokens
  add column if not exists oauth_client_id text references public.oauth_clients(client_id) on delete set null;

create table if not exists public.oauth_tokens (
  token_hash  text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  kind        text not null check (kind in ('access', 'refresh')),
  grant_id    uuid not null references public.api_tokens(id) on delete cascade,
  client_id   text not null references public.oauth_clients(client_id) on delete cascade,
  expires_at  timestamptz not null,
  revoked_at  timestamptz
);
create index if not exists oauth_tokens_grant_idx on public.oauth_tokens (grant_id);
create index if not exists oauth_tokens_expiry_idx on public.oauth_tokens (expires_at);
create index if not exists oauth_codes_expiry_idx on public.oauth_codes (expires_at);
create index if not exists oauth_clients_created_idx on public.oauth_clients (created_at);

alter table public.oauth_clients enable row level security;
alter table public.oauth_codes enable row level security;
alter table public.oauth_tokens enable row level security;
revoke all on public.oauth_clients, public.oauth_codes, public.oauth_tokens from anon, authenticated;
