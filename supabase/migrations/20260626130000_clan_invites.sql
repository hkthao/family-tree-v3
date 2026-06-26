-- "Mời & cùng điền": link mời 1 chạm dùng nhiều lần. Admin tạo link (chọn
-- quyền viewer/editor), gửi vào nhóm họ; người thân bấm vào → đăng nhập →
-- tự tham gia. Khác mời-qua-email (cần biết trước + đã có tài khoản).

create table public.clan_invites (
  id          uuid primary key default gen_random_uuid(),
  clan_id     uuid not null references public.clans(id) on delete cascade,
  token       text not null unique,
  role        text not null check (role in ('viewer', 'editor')),  -- KHÔNG cấp admin qua link
  created_by  uuid references public.profiles(id) on delete set null,
  expires_at  timestamptz not null,
  is_revoked  boolean not null default false,
  use_count   integer not null default 0,
  created_at  timestamptz not null default now()
);
create index clan_invites_clan_idx on public.clan_invites (clan_id);

alter table public.clan_invites enable row level security;

-- Admin của clan (hoặc platform admin) tạo / xem / thu hồi link.
create policy clan_invites_admin_all
  on public.clan_invites for all
  to authenticated
  using (public.is_clan_admin(clan_id) or public.is_platform_admin())
  with check (public.is_clan_admin(clan_id) or public.is_platform_admin());

-- ─── peek: hiện tên dòng họ + quyền trước khi đăng nhập (anon đọc) ───
create or replace function public.peek_clan_invite(p_token text)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = public, pg_temp
  as $$
  declare ci public.clan_invites; cname text;
  begin
    select * into ci from public.clan_invites where token = p_token;
    if ci.id is null then
      return jsonb_build_object('valid', false);
    end if;
    select name into cname from public.clans where id = ci.clan_id;
    return jsonb_build_object(
      'valid', (not ci.is_revoked) and ci.expires_at > now(),
      'clan_id', ci.clan_id,
      'clan_name', cname,
      'role', ci.role
    );
  end; $$;
revoke all on function public.peek_clan_invite(text) from public;
grant execute on function public.peek_clan_invite(text) to anon, authenticated;

-- ─── redeem: người đã đăng nhập dùng link để tham gia ────────────────
create or replace function public.redeem_clan_invite(p_token text)
  returns uuid
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare ci public.clan_invites; uid uuid := auth.uid();
  begin
    if uid is null then
      raise exception 'Cần đăng nhập để tham gia' using errcode = 'insufficient_privilege';
    end if;
    select * into ci from public.clan_invites where token = p_token;
    if ci.id is null then
      raise exception 'Link mời không hợp lệ';
    end if;
    if ci.is_revoked or ci.expires_at <= now() then
      raise exception 'Link mời đã hết hạn hoặc bị thu hồi';
    end if;
    -- Đã là thành viên → trả clan_id (idempotent, không tăng use_count).
    if exists (
      select 1 from public.clan_members where clan_id = ci.clan_id and user_id = uid
    ) then
      return ci.clan_id;
    end if;
    -- Trigger enforce_max_users sẽ chặn nếu đầy (bong message lên).
    insert into public.clan_members(clan_id, user_id, role, invited_by)
      values (ci.clan_id, uid, ci.role, ci.created_by);
    update public.clan_invites set use_count = use_count + 1 where id = ci.id;
    return ci.clan_id;
  end; $$;
revoke all on function public.redeem_clan_invite(text) from public, anon;
grant execute on function public.redeem_clan_invite(text) to authenticated;
