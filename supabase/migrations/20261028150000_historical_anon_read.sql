-- Khách chưa đăng nhập (anon) đọc được trị vì, tước hiệu, trích dẫn của DÒNG
-- HỌ LỊCH SỬ CÔNG KHAI — trang xem thử /xem/clans/:id (tab "Chi tiết").
-- Chỉ dòng họ lịch sử: dữ liệu ở đây là sử liệu đã công bố, không phải thông
-- tin của gia đình người dùng. Dòng họ thường không mở gì thêm cho anon.

-- anon không có quyền SELECT trên clans → policy không tự join được; dùng hàm
-- SECURITY DEFINER chỉ trả đúng/sai cho câu hỏi "dòng họ lịch sử công khai?".
create or replace function public.is_public_historical_clan(p_clan_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.clans
    where id = p_clan_id and visibility = 'public' and kind = 'historical'
  );
$$;

revoke execute on function public.is_public_historical_clan(uuid) from public;
grant execute on function public.is_public_historical_clan(uuid) to anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['person_citations', 'person_reigns', 'person_titles'] loop
    execute format('drop policy if exists "%1$s_anon_historical_select" on public.%1$s', t);
    execute format($f$
      create policy "%1$s_anon_historical_select" on public.%1$s for select
        to anon
        using (public.is_public_historical_clan(clan_id))
    $f$, t);
  end loop;
end
$$;

-- Cha mẹ nuôi: anon chỉ được hỏi trong dòng họ lịch sử công khai.
create or replace function public.get_person_adoptive_parents(p_person_id uuid)
  returns table (person_id uuid, full_name text, role text)
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  select par.id,
         case when par.is_living and not public.is_clan_member(c.id) and not public.is_platform_admin()
              then null else par.full_name end,
         case when par.id = f.husband_id then 'father' else 'mother' end
    from public.persons p
    join public.clans c on c.id = p.clan_id
    join public.families f on f.id = p.adoptive_family_id and f.deleted_at is null
    join public.persons par on par.id in (f.husband_id, f.wife_id) and par.deleted_at is null
   where p.id = p_person_id
     and p.deleted_at is null
     and (
       (auth.uid() is null and c.visibility = 'public' and c.kind = 'historical')
       or (auth.uid() is not null
           and (c.visibility = 'public' or public.is_clan_member(c.id) or public.is_platform_admin()))
     );
$$;

grant execute on function public.get_person_adoptive_parents(uuid) to anon;

-- get_historical_person_extras(person) --------------------------------------
-- share-view chỉ trả tiểu sử / tên tự-húy-thụy / nơi chôn / ngày âm cho link
-- chia sẻ "một người"; trang xem thử dòng họ thì không. Với dòng họ LỊCH SỬ
-- công khai, các trường này là sử liệu → tab "Chi tiết & nguồn" đọc qua đây.
-- Chỉ người đã mất.
create or replace function public.get_historical_person_extras(p_person_id uuid)
  returns table (
    bio text,
    courtesy_name text,
    posthumous_name text,
    nickname text,
    birth_place text,
    burial_place text,
    lifespan_years int,
    birth_lunar_year int,
    birth_lunar_month int,
    birth_lunar_day int,
    death_lunar_year int,
    death_lunar_month int,
    death_lunar_day int,
    death_anniv_lunar_month int,
    death_anniv_lunar_day int
  )
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  select p.bio, p.courtesy_name, p.posthumous_name, p.nickname, p.birth_place, p.burial_place,
         p.lifespan_years, p.birth_lunar_year, p.birth_lunar_month, p.birth_lunar_day,
         p.death_lunar_year, p.death_lunar_month, p.death_lunar_day,
         p.death_anniv_lunar_month, p.death_anniv_lunar_day
    from public.persons p
   where p.id = p_person_id
     and p.deleted_at is null
     and not p.is_living
     and public.is_public_historical_clan(p.clan_id);
$$;

revoke execute on function public.get_historical_person_extras(uuid) from public;
grant execute on function public.get_historical_person_extras(uuid) to anon, authenticated;
