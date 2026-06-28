-- max_users chỉ tính ghế admin/editor; viewer KHÔNG giới hạn ----------------
-- Mục tiêu: chia sẻ cho con cháu XEM qua link mời không bị chặn bởi
-- max_users (mặc định 3). Viewer là người xem (read-only) → không tốn ghế.
-- Ghế biên tập (admin/editor) vẫn bị giới hạn bởi clans.max_users.
--
-- Thêm enforce khi promote viewer→admin/editor (UPDATE role) để giới hạn ghế
-- không bị lách bằng cách join viewer rồi nâng quyền.

create or replace function public.enforce_max_users()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    current_count int;
    clan_limit int;
  begin
    -- Viewer không tính ghế → cho tham gia thoải mái.
    if new.role = 'viewer' then
      return new;
    end if;
    -- UPDATE mà vốn đã là ghế (admin/editor) → không chiếm thêm ghế mới.
    if TG_OP = 'UPDATE' and old.role in ('admin', 'editor') then
      return new;
    end if;

    perform pg_advisory_xact_lock(
      hashtext('max_users:' || new.clan_id::text)::bigint
    );

    -- Chỉ đếm ghế admin/editor (không tính viewer).
    select count(*) into current_count
    from public.clan_members
    where clan_id = new.clan_id
      and role in ('admin', 'editor');

    select max_users into clan_limit
    from public.clans
    where id = new.clan_id;

    if current_count >= coalesce(clan_limit, 3) then
      raise exception 'Clan has reached max_users limit (%)', clan_limit
        using errcode = 'check_violation';
    end if;
    return new;
  end;
  $$;

-- Trigger cũ chỉ chạy on INSERT; mở rộng sang UPDATE OF role.
drop trigger if exists enforce_max_users_trg on public.clan_members;
create trigger enforce_max_users_trg
  before insert or update of role on public.clan_members
  for each row
  execute function public.enforce_max_users();
