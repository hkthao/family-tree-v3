-- Quản trị dòng họ sửa thông tin thành viên trực tiếp (không qua luồng Đóng góp):
--  * admin_set_member_display_name — đổi tên hiển thị (profiles.display_name).
--  * admin_set_member_self_person  — gắn / gỡ "Tự xưng là" cho thành viên.
-- Cả hai SECURITY DEFINER, chỉ chạy khi người gọi là admin dòng họ (hoặc platform
-- admin) và người bị sửa đang là thành viên dòng họ đó.

create or replace function public.admin_set_member_display_name(
  p_clan_id uuid,
  p_user_id uuid,
  p_name text
)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    v_name text := btrim(coalesce(p_name, ''));
  begin
    if auth.uid() is null then
      raise exception 'Not authenticated' using errcode = '42501';
    end if;
    if not public.is_clan_admin(p_clan_id) then
      raise exception 'Chỉ quản trị dòng họ mới được sửa thành viên' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.clan_members where clan_id = p_clan_id and user_id = p_user_id
    ) then
      raise exception 'Người này không phải thành viên dòng họ' using errcode = '22023';
    end if;
    if char_length(v_name) < 1 or char_length(v_name) > 100 then
      raise exception 'Tên hiển thị phải từ 1 đến 100 ký tự' using errcode = '22023';
    end if;
    update public.profiles set display_name = v_name where id = p_user_id;
  end; $$;

create or replace function public.admin_set_member_self_person(
  p_clan_id uuid,
  p_user_id uuid,
  p_person_id uuid,
  p_verified boolean default false
)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  begin
    if auth.uid() is null then
      raise exception 'Not authenticated' using errcode = '42501';
    end if;
    if not public.is_clan_admin(p_clan_id) then
      raise exception 'Chỉ quản trị dòng họ mới được sửa thành viên' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.clan_members where clan_id = p_clan_id and user_id = p_user_id
    ) then
      raise exception 'Người này không phải thành viên dòng họ' using errcode = '22023';
    end if;
    if p_person_id is not null then
      if not exists (
        select 1 from public.persons
        where id = p_person_id and clan_id = p_clan_id and deleted_at is null
      ) then
        raise exception 'Không tìm thấy người này trong dòng họ' using errcode = '22023';
      end if;
      if exists (
        select 1 from public.clan_members
        where clan_id = p_clan_id and self_person_id = p_person_id and user_id <> p_user_id
      ) then
        raise exception 'Người này đã có thành viên khác chọn' using errcode = '23505';
      end if;
    end if;
    update public.clan_members
    set self_person_id = p_person_id,
        self_person_verified = (p_person_id is not null and coalesce(p_verified, false))
    where clan_id = p_clan_id and user_id = p_user_id;
  end; $$;

grant execute on function public.admin_set_member_display_name(uuid, uuid, text) to authenticated;
grant execute on function public.admin_set_member_self_person(uuid, uuid, uuid, boolean) to authenticated;
