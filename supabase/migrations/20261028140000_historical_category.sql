-- Phân loại dòng họ lịch sử — không chỉ hoàng tộc mà cả quý tộc, quan lại –
-- khoa bảng, võ tướng (xem docs/plan-gia-pha-vua-chua.md).
--   royal    : hoàng tộc, vương tộc, chúa
--   noble    : quý tộc, công thần thế tộc
--   official : quan lại, khoa bảng
--   military : võ tướng
-- Chỉ có nghĩa khi kind = 'historical'. Đổi được bởi platform admin (cùng chốt
-- protect_clan_kind như kind/external_key).

alter table public.clans
  add column if not exists historical_category text
    check (historical_category in ('royal', 'noble', 'official', 'military')),
  drop constraint if exists clans_historical_category_kind,
  add constraint clans_historical_category_kind
    check (historical_category is null or kind = 'historical');

create or replace function public.protect_clan_kind()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or public.is_platform_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.kind <> 'family' or new.external_key is not null or new.historical_category is not null then
      raise exception 'Only platform admin can create historical clans';
    end if;
  elsif new.kind is distinct from old.kind
     or new.external_key is distinct from old.external_key
     or new.historical_category is distinct from old.historical_category then
    raise exception 'Only platform admin can change clan kind';
  end if;
  return new;
end;
$$;

-- Dòng họ lịch sử đã nhập (nhà Trần) → hoàng tộc.
update public.clans set historical_category = 'royal'
 where kind = 'historical' and external_key = 'tran' and historical_category is null;

-- Thứ tự trị vì / tước hiệu — trích dẫn trỏ tới "reign:<i>" / "title:<i>".
alter table public.person_reigns add column if not exists sort int not null default 0;
alter table public.person_titles add column if not exists sort int not null default 0;

-- get_person_adoptive_parents(person) ---------------------------------------
-- Cha mẹ nuôi / thừa tự của một người. Người xem công khai (không phải thành
-- viên) đọc persons qua view persons_public_safe — view đó không có
-- adoptive_family_id — nên cần đường đọc riêng. SECURITY DEFINER nhưng chỉ trả
-- cho dòng họ caller được xem (công khai / thành viên / platform admin), và
-- chỉ trả tên + id của cha mẹ nuôi đã mất (người còn sống → ẩn tên như view).
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
     and (c.visibility = 'public' or public.is_clan_member(c.id) or public.is_platform_admin());
$$;

revoke execute on function public.get_person_adoptive_parents(uuid) from public;
grant execute on function public.get_person_adoptive_parents(uuid) to authenticated;
