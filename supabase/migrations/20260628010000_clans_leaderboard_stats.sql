-- get_clans_leaderboard_stats(clan_ids[]) -----------------------------------
-- Số liệu tổng hợp theo dòng họ cho "huy hiệu chất lượng" + bảng xếp hạng ở
-- danh sách dòng họ (số đời, % có năm sinh, tăng trưởng 30 ngày).
--
-- SECURITY DEFINER: tab "Cộng đồng" thường do KHÁCH (không phải thành viên)
-- xem các họ CÔNG KHAI — RLS trên `persons` sẽ chặn họ đọc bảng gốc, nên
-- security invoker sẽ trả 0. Ở đây ta cố tình bypass RLS nhưng CHỈ trả
-- SỐ LIỆU TỔNG HỢP (đếm + max đời, không phải dữ liệu cá nhân), và chỉ cho
-- các họ caller được phép thấy: công khai, hoặc đã tham gia, hoặc platform
-- admin. person_count vốn đã public trên bảng clans nên đây không lộ gì mới.

create or replace function public.get_clans_leaderboard_stats(p_clan_ids uuid[])
  returns table (
    clan_id uuid,
    max_generation int,
    persons_total int,
    persons_with_birth int,
    persons_30d int
  )
  language sql
  stable
  security definer
  set search_path = public, pg_temp
  as $$
    select
      p.clan_id,
      max(p.generation)::int,
      count(*)::int,
      count(*) filter (where p.birth_date is not null)::int,
      count(*) filter (where p.created_at > now() - interval '30 days')::int
    from public.persons p
    where p.clan_id = any(p_clan_ids)
      and p.deleted_at is null
      and exists (
        select 1 from public.clans c
        where c.id = p.clan_id
          and (
            c.visibility = 'public'
            or public.is_clan_member(c.id)
            or public.is_platform_admin()
          )
      )
    group by p.clan_id;
  $$;

revoke execute on function public.get_clans_leaderboard_stats(uuid[]) from public;
grant execute on function public.get_clans_leaderboard_stats(uuid[]) to authenticated;
