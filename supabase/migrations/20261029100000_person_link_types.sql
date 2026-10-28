-- Liên kết hai dòng họ qua thành viên — không chỉ thông gia.
--
-- Trước đây person_links chỉ có link_type = 'same_person' (CÙNG MỘT NGƯỜI xuất
-- hiện ở hai dòng họ: thông gia). Thêm các loại liên kết khác, dùng chung bộ
-- máy đề xuất → xác nhận → thu hồi sẵn có:
--   same_person    : thông gia — cùng một người có mặt ở cả hai dòng họ
--   ancestor_of    : người ở dòng họ A là TỔ TIÊN của người ở dòng họ B
--   descendant_of  : người ở dòng họ A là HẬU DUỆ của người ở dòng họ B
--   related        : họ hàng / cùng nguồn gốc khác (ghi chú nêu rõ)
-- Các hàm hiển thị thông gia (get_clans_inlaw_links, quan hệ "ma" trên cây…)
-- chỉ xử lý same_person; loại mới đọc qua get_clans_linked_clans.

alter table public.person_links
  drop constraint if exists person_links_link_type_check;
alter table public.person_links
  add constraint person_links_link_type_check
    check (link_type in ('same_person', 'ancestor_of', 'descendant_of', 'related'));

-- Danh sách "Thông gia" ở danh sách / tổng quan dòng họ: chỉ same_person.
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
      and pl.link_type = 'same_person'
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

-- Dòng họ liên kết qua thành viên theo loại mới, nhìn từ phía từng dòng họ.
-- relation (theo góc nhìn của clan_id):
--   ancestor_of   : dòng họ này có người là TỔ TIÊN của người bên kia
--   descendant_of : dòng họ này có người là HẬU DUỆ của người bên kia
--   related       : họ hàng / cùng nguồn gốc
-- Chỉ trả các họ caller được xem (công khai / thành viên / platform admin).
create or replace function public.get_clans_linked_clans(p_clan_ids uuid[])
  returns table (
    clan_id uuid,
    linked_clan_id uuid,
    linked_clan_name text,
    relation text
  )
  language sql
  stable
  security definer
  set search_path = public, pg_temp
  as $$
    select distinct
      s.cid       as clan_id,
      other.id    as linked_clan_id,
      other.name  as linked_clan_name,
      case
        when pl.link_type = 'related' then 'related'
        when s.is_a and pl.link_type = 'ancestor_of' then 'ancestor_of'
        when s.is_a and pl.link_type = 'descendant_of' then 'descendant_of'
        when not s.is_a and pl.link_type = 'ancestor_of' then 'descendant_of'
        else 'ancestor_of'
      end         as relation
    from public.person_links pl
    cross join lateral (values
      (pl.clan_a_id, pl.clan_b_id, true),
      (pl.clan_b_id, pl.clan_a_id, false)
    ) as s(cid, other_id, is_a)
    join public.clans other on other.id = s.other_id
    where pl.status = 'confirmed'
      and pl.link_type <> 'same_person'
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

revoke execute on function public.get_clans_linked_clans(uuid[]) from public;
grant execute on function public.get_clans_linked_clans(uuid[]) to authenticated;

-- Trang xác nhận bằng mã mời cần biết loại liên kết được đề nghị.
create or replace function public.resolve_link_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l person_links;
  ca clans;
  pa persons;
begin
  select * into l from public.person_links
    where invite_token = p_token and status = 'pending';
  if not found then
    raise exception 'invalid or expired token';
  end if;

  select * into ca from public.clans where id = l.clan_a_id;
  select * into pa from public.persons where id = l.person_a_id and deleted_at is null;
  if pa.id is null then
    raise exception 'proposer person no longer available';
  end if;

  return jsonb_build_object(
    'link_id', l.id,
    'link_type', l.link_type,
    'clan_a_name', ca.name,
    'person_a_name', pa.full_name,
    'person_a_gender', pa.gender,
    'person_a_birth_year', extract(year from pa.birth_date)::int,
    'person_a_death_year', extract(year from pa.death_date)::int,
    'person_b_name_hint', l.person_b_name_hint,
    'note', l.note,
    'created_at', l.created_at
  );
end;
$$;

revoke all on function public.resolve_link_token(text) from public;
grant execute on function public.resolve_link_token(text) to anon, authenticated;
