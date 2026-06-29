-- get_clans_inlaw_links(clan_ids[]) ------------------------------------------
-- Cho danh sách + chi tiết dòng họ biết "đã kết thông gia với những dòng họ
-- nào". Trả các dòng họ ĐỐI TÁC (qua person_links đã confirmed) cho mỗi clan
-- trong p_clan_ids, kèm tên.
--
-- SECURITY DEFINER: tên dòng họ đối tác cần đọc được kể cả khi nó riêng tư
-- (admin đã chủ động kết nối nên biết đối tác là ai — không phải bí mật).
-- Chỉ trả cho các clan nguồn mà caller được phép xem (công khai / thành viên
-- / platform admin) để tránh dò thông tin clan lạ.

create or replace function public.get_clans_inlaw_links(p_clan_ids uuid[])
  returns table (
    clan_id uuid,
    linked_clan_id uuid,
    linked_clan_name text
  )
  language sql
  stable
  security definer
  set search_path = public, pg_temp
  as $$
    select distinct
      s.cid       as clan_id,
      other.id    as linked_clan_id,
      other.name  as linked_clan_name
    from public.person_links pl
    cross join lateral (values
      (pl.clan_a_id, pl.clan_b_id),
      (pl.clan_b_id, pl.clan_a_id)
    ) as s(cid, other_id)
    join public.clans other on other.id = s.other_id
    where pl.status = 'confirmed'
      and s.cid = any(p_clan_ids)
      and s.other_id is not null
      and s.other_id <> s.cid
      and exists (
        select 1 from public.clans c
        where c.id = s.cid
          and (
            c.visibility = 'public'
            or public.is_clan_member(c.id)
            or public.is_platform_admin()
          )
      );
  $$;

revoke execute on function public.get_clans_inlaw_links(uuid[]) from public;
grant execute on function public.get_clans_inlaw_links(uuid[]) to authenticated;
