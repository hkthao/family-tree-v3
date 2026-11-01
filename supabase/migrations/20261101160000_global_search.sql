-- Tìm kiếm toàn cục: một lần gọi trả về kết quả từ nhiều loại nội dung của MỌI dòng họ người gọi được phép xem.
-- SECURITY INVOKER → RLS của từng bảng quyết định người dùng thấy gì (thành viên dòng họ, admin nền tảng, dòng họ
-- lịch sử công khai…); hàm không tự nới quyền. Chỉ trả tối đa per_type dòng mỗi loại. Tính năng đã tắt ở dòng họ
-- (clans.disabled_features) thì không tìm trong tính năng đó.
create or replace function public.global_search(q text, per_type integer default 5)
returns table (
  kind text,
  id uuid,
  clan_id uuid,
  clan_name text,
  title text,
  subtitle text,
  rank real
)
language plpgsql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $$
declare
  needle text := lower(public.f_unaccent(btrim(coalesce(q, ''))));
  n text;
  lim int := greatest(1, least(coalesce(per_type, 5), 20));
begin
  if char_length(needle) < 2 then
    return;
  end if;
  n := '%' || replace(replace(replace(needle, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  (select 'person'::text, p.id, p.clan_id, c.name, p.full_name,
          nullif(concat_ws(' · ', case when p.generation is not null then 'Đời ' || p.generation end,
                           case when p.birth_date is not null then 'sinh ' || extract(year from p.birth_date)::int end,
                           p.birth_place), ''),
          (case when p.full_name_unaccent like n then 0 else 1 end)::real
     from public.persons p join public.clans c on c.id = p.clan_id
    where p.deleted_at is null and p.search_text like n
    order by 7, p.full_name limit lim)
  union all
  (select 'clan'::text, c.id, c.id, c.name, c.name,
          case when c.kind = 'historical' then 'Dòng họ lịch sử' else c.person_count || ' người' end,
          0::real
     from public.clans c
    where c.name_unaccent like n
    order by c.name limit lim)
  union all
  (select 'grave'::text, r.id, r.clan_id, c.name, r.name,
          nullif(concat_ws(' · ', r.location_name, r.address), ''), 1::real
     from public.resting_places r join public.clans c on c.id = r.clan_id
    where r.deleted_at is null and not ('graves' = any (c.disabled_features))
      and lower(public.f_unaccent(concat_ws(' ', r.name, r.location_name, r.address, r.notes))) like n
    order by r.name limit lim)
  union all
  (select 'heritage'::text, h.id, h.clan_id, c.name, h.title,
          nullif(concat_ws(' · ', h.category::text, h.location_name), ''), 1::real
     from public.heritage_items h join public.clans c on c.id = h.clan_id
    where h.deleted_at is null and not ('heritage' = any (c.disabled_features))
      and lower(public.f_unaccent(concat_ws(' ', h.title, h.summary, h.location_name, h.address, h.body))) like n
    order by h.title limit lim)
  union all
  (select 'event'::text, e.id, e.clan_id, c.name, e.title,
          nullif(concat_ws(' · ', e.event_type::text, e.date_solar::text), ''), 1::real
     from public.events e join public.clans c on c.id = e.clan_id
    where lower(public.f_unaccent(concat_ws(' ', e.title, e.notes))) like n
    order by e.title limit lim)
  union all
  (select 'post'::text, b.id, b.clan_id, c.name, coalesce(nullif(b.title, ''), left(b.body, 60)),
          left(b.body, 80), 1::real
     from public.clan_posts b join public.clans c on c.id = b.clan_id
    where b.status = 'published' and not ('board' = any (c.disabled_features))
      and lower(public.f_unaccent(concat_ws(' ', b.title, b.body))) like n
    order by b.created_at desc limit lim)
  union all
  (select 'contribution'::text, k.id, k.clan_id, c.name, 'Đề xuất từ ' || coalesce(nullif(k.submitter_name, ''), 'người ẩn danh'),
          concat_ws(' · ', k.contribution_type::text, k.status::text), 1::real
     from public.contributions k join public.clans c on c.id = k.clan_id
    where lower(public.f_unaccent(concat_ws(' ', k.submitter_name, k.submitter_note, k.proposed_data::text))) like n
    order by k.created_at desc limit lim)
  union all
  (select 'inlaw'::text, l.id, l.clan_a_id, c.name, coalesce(nullif(l.person_b_name_hint, ''), 'Liên kết thông gia'),
          l.status::text, 1::real
     from public.person_links l join public.clans c on c.id = l.clan_a_id
    where l.revoked_at is null and not ('inlaws' = any (c.disabled_features))
      and lower(public.f_unaccent(concat_ws(' ', l.person_b_name_hint, l.note))) like n
    order by l.created_at desc limit lim)
  union all
  (select 'custom'::text, s.id, null::uuid, null::text, s.title, s.short_description, 1::real
     from public.custom_entries s
    where s.deleted_at is null and (lower(public.f_unaccent(s.title)) like n or s.search_text like n)
    order by s.title limit lim);
end;
$$;

revoke execute on function public.global_search(text, integer) from public;
grant execute on function public.global_search(text, integer) to authenticated;
