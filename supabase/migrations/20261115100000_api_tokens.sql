-- Token API cá nhân: cho AI bên ngoài (Claude, ChatGPT, script…) tra cứu và đề xuất
-- chỉnh sửa gia phả qua máy chủ MCP (Edge Function `mcp`).
--
-- Thiết kế:
--  - Mỗi token gắn MỘT người dùng và MỘT dòng họ; quyền của AI = quyền của người đó.
--  - Chỉ lưu BĂM SHA-256 của token. Bản rõ do trình duyệt sinh, chỉ hiện đúng một lần
--    lúc tạo — mất thì tạo lại, không khôi phục được.
--  - scope 'read'    : chỉ tra cứu.
--    scope 'propose' : tra cứu + gửi ĐỀ XUẤT vào hàng chờ `contributions`; admin duyệt
--                      trong app mới ghi thật.
--    scope 'write'   : tra cứu + GHI THẲNG, nhưng bằng danh tính chủ token (JWT ngắn hạn
--                      do hàm `mcp` ký) → RLS, trigger audit, quyền xoá y như người đó tự làm.
--    Quyền thật = min(gói, vai trò HIỆN TẠI của chủ token): hạ vai trò là token hạ theo.
--  - Thu hồi = đặt revoked_at (giữ dấu vết); token hết hạn theo expires_at.
create table public.api_tokens (
  id            uuid primary key default gen_random_uuid(),
  clan_id       uuid not null references public.clans(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  token_hash    text not null unique,
  token_prefix  text not null,
  scope         text not null default 'read',
  expires_at    timestamptz not null,
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now(),
  constraint api_tokens_scope check (scope in ('read', 'propose', 'write')),
  constraint api_tokens_name_len check (char_length(name) between 1 and 80),
  constraint api_tokens_hash_fmt check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint api_tokens_prefix_len check (char_length(token_prefix) between 4 and 16)
);
create index api_tokens_user_idx on public.api_tokens (user_id, clan_id);

alter table public.api_tokens enable row level security;

-- Chủ token thấy / thu hồi token của chính mình. TẠO token chỉ dành cho admin dòng họ hoặc
-- admin hệ thống: token cho AI đi vào dữ liệu thật nên không mở cho thành viên thường.
create policy api_tokens_select on public.api_tokens for select to authenticated
  using (user_id = (select auth.uid()));
create policy api_tokens_insert on public.api_tokens for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (public.is_platform_admin() or public.is_clan_admin(clan_id))
    and revoked_at is null
    and expires_at > now()
    and expires_at <= now() + interval '366 days'
  );
-- Chỉ cho đặt revoked_at; cột khác bị chặn bằng grant theo cột bên dưới.
create policy api_tokens_update on public.api_tokens for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.api_tokens from anon, authenticated;
grant select (id, clan_id, user_id, name, token_prefix, scope, expires_at,
              last_used_at, revoked_at, created_at)
  on public.api_tokens to authenticated;
grant insert (clan_id, user_id, name, token_hash, token_prefix, scope, expires_at)
  on public.api_tokens to authenticated;
grant update (revoked_at) on public.api_tokens to authenticated;

-- Quản trị nền tảng: xem mọi token (không có bản băm — đã chặn bằng grant theo cột) và
-- thu hồi bất kỳ token nào, phòng khi token bị lộ mà chủ không biết.
create policy api_tokens_admin_select on public.api_tokens for select to authenticated
  using (public.is_platform_admin());
create policy api_tokens_admin_update on public.api_tokens for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
