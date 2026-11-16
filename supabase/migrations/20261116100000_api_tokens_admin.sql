-- Token MCP cho ADMIN HỆ THỐNG: không gắn một dòng họ, dùng được mọi chức năng quản trị nền tảng và thao tác trên mọi
-- dòng họ (truyền clan_id từng lệnh). Chỉ admin hệ thống tạo được và chỉ cho chính mình; mỗi lượt gọi server MCP kiểm
-- lại người tạo VẪN là admin hệ thống (bị gỡ quyền → token chết ngay).
--
-- Kèm bảng nhật ký `mcp_admin_log`: mọi lệnh của token admin được ghi lại (ai, token nào, tool gì, tham số, kết quả) để
-- admin hệ thống tra soát — token này mạnh hơn token dòng họ nhiều nên cần dấu vết riêng, ngoài audit_log theo dòng họ.

alter table public.api_tokens alter column clan_id drop not null;

alter table public.api_tokens drop constraint if exists api_tokens_scope;
alter table public.api_tokens add constraint api_tokens_scope
  check (scope in ('read', 'propose', 'write', 'admin'));

-- Token admin KHÔNG có clan_id; mọi gói khác BẮT BUỘC có.
alter table public.api_tokens drop constraint if exists api_tokens_admin_clan;
alter table public.api_tokens add constraint api_tokens_admin_clan
  check ((scope = 'admin') = (clan_id is null));

drop policy if exists api_tokens_insert on public.api_tokens;
create policy api_tokens_insert on public.api_tokens for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and revoked_at is null
    and expires_at > now()
    and expires_at <= now() + interval '366 days'
    and (
      -- token admin hệ thống: chỉ admin hệ thống, không gắn dòng họ
      (scope = 'admin' and clan_id is null and public.is_platform_admin())
      -- token dòng họ: admin hệ thống hoặc admin của chính dòng họ đó
      or (scope <> 'admin' and clan_id is not null
          and (public.is_platform_admin() or public.is_clan_admin(clan_id)))
    )
  );

-- ─── Nhật ký lệnh của token admin ──────────────────────────────────────────
create table if not exists public.mcp_admin_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  token_id    uuid references public.api_tokens(id) on delete set null,
  clan_id     uuid,
  tool        text not null,
  args        jsonb,
  is_error    boolean not null default false,
  result      text
);
create index if not exists mcp_admin_log_at_idx on public.mcp_admin_log (at desc);
create index if not exists mcp_admin_log_user_idx on public.mcp_admin_log (user_id, at desc);

alter table public.mcp_admin_log enable row level security;
-- Chỉ admin hệ thống ĐỌC; việc GHI do server MCP làm bằng service role (không có policy insert cho ai khác).
revoke all on public.mcp_admin_log from anon, authenticated;
grant select on public.mcp_admin_log to authenticated;
drop policy if exists mcp_admin_log_select on public.mcp_admin_log;
create policy mcp_admin_log_select on public.mcp_admin_log for select to authenticated
  using (public.is_platform_admin());
