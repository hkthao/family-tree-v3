-- Một kết nối (token) có thể mang NHIỀU dòng họ với một gói quyền chung — dành cho người quản trị nhiều họ cấp quyền cho AI một lần.
-- `api_tokens.clan_id` vẫn là họ chính (kết nối một họ thì chỉ có cột này); các họ của kết nối nhiều họ nằm ở `api_token_clans`
-- (gồm cả họ chính). Quyền thật vẫn tính riêng từng họ ở MỖI lượt gọi (server MCP kiểm vai trò hiện tại của chủ token ở họ đó).

create table if not exists public.api_token_clans (
  token_id  uuid not null references public.api_tokens(id) on delete cascade,
  clan_id   uuid not null references public.clans(id) on delete cascade,
  primary key (token_id, clan_id)
);
create index if not exists api_token_clans_clan_idx on public.api_token_clans (clan_id);

alter table public.api_token_clans enable row level security;
revoke all on public.api_token_clans from anon, authenticated;
grant select on public.api_token_clans to authenticated;
-- Chỉ ĐỌC, và chỉ cho admin của họ đó / admin hệ thống. Việc GHI do server MCP (service role) làm khi cấp quyền OAuth.
-- Không tham chiếu ngược api_tokens → không đệ quy RLS.
drop policy if exists api_token_clans_select on public.api_token_clans;
create policy api_token_clans_select on public.api_token_clans for select to authenticated
  using (public.is_clan_admin(clan_id) or public.is_platform_admin());

-- Admin của BẤT KỲ họ nào trong kết nối được thấy và thu hồi kết nối đó (thu hồi là dừng quyền ở mọi họ của kết nối).
drop policy if exists api_tokens_clan_admin_select on public.api_tokens;
create policy api_tokens_clan_admin_select on public.api_tokens for select to authenticated
  using (
    clan_id is not null
    and (
      public.is_clan_admin(clan_id)
      or exists (select 1 from public.api_token_clans c where c.token_id = api_tokens.id and public.is_clan_admin(c.clan_id))
    )
  );
drop policy if exists api_tokens_clan_admin_update on public.api_tokens;
create policy api_tokens_clan_admin_update on public.api_tokens for update to authenticated
  using (
    clan_id is not null
    and (
      public.is_clan_admin(clan_id)
      or exists (select 1 from public.api_token_clans c where c.token_id = api_tokens.id and public.is_clan_admin(c.clan_id))
    )
  )
  with check (clan_id is not null);

-- Mã cấp quyền OAuth mang danh sách họ đã chọn (clan_id = họ đầu tiên).
alter table public.oauth_codes add column if not exists clan_ids uuid[];

notify pgrst, 'reload schema';
