-- Generation propagate sang spouse.
--
-- Bug: vợ/chồng "kết hôn vào" dòng họ không có birth_family_id trong
-- clan → recompute_generation_for_clan để generation = null. Khi sắp
-- xếp theo đời, các spouse này rơi xuống cuối, không cùng đời với
-- partner.
--
-- Fix: sau BFS từ root qua birth_family (logic cũ), thêm bước lan
-- generation sang spouse trong cùng family — nếu husband có đời mà
-- wife null (hoặc ngược lại) thì copy sang. Lặp tối đa 30 vòng để
-- phủ trường hợp "spouse vừa được gán đời lại là partner trong family
-- khác có spouse chưa có đời" (đa thê, tái hôn).

create or replace function public.recompute_generation_for_clan(target_clan uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    updated_count int;
    loop_guard int := 0;
  begin
    -- Reset all non-root generations in this clan
    update public.persons
    set generation = case when is_root then 1 else null end
    where clan_id = target_clan;

    -- BFS from roots down through families (huyết thống — qua birth_family_id)
    with recursive walk(person_id, gen, depth) as (
      select id, 1, 1
      from public.persons
      where clan_id = target_clan and is_root = true and deleted_at is null

      union all

      select child.id, parent.gen + 1, parent.depth + 1
      from public.persons child
      join public.families f
        on child.birth_family_id = f.id
        and f.deleted_at is null
      join walk parent
        on parent.person_id = f.husband_id
        or parent.person_id = f.wife_id
      where parent.depth < 30
        and child.clan_id = target_clan
        and child.deleted_at is null
        and not child.is_root
    )
    update public.persons
    set generation = best.min_gen
    from (
      select person_id, min(gen) as min_gen
      from walk
      group by person_id
    ) best
    where public.persons.id = best.person_id
      and public.persons.clan_id = target_clan
      and not public.persons.is_root;

    -- Lan generation sang spouse: với mỗi family đủ 2 partner, nếu
    -- một bên có đời còn bên kia null thì copy sang. Lặp tới khi
    -- không còn update (cap 30 vòng phòng vòng lặp).
    loop
      loop_guard := loop_guard + 1;
      exit when loop_guard > 30;

      with src as (
        select
          case when ph.generation is null then ph.id else pw.id end as person_id,
          coalesce(ph.generation, pw.generation) as gen
        from public.families f
        join public.persons ph
          on ph.id = f.husband_id
          and ph.clan_id = target_clan
          and ph.deleted_at is null
        join public.persons pw
          on pw.id = f.wife_id
          and pw.clan_id = target_clan
          and pw.deleted_at is null
        where f.clan_id = target_clan
          and f.deleted_at is null
          and (ph.generation is null) <> (pw.generation is null)
      )
      update public.persons p
      set generation = src.gen
      from src
      where p.id = src.person_id
        and p.generation is null;

      get diagnostics updated_count = row_count;
      exit when updated_count = 0;
    end loop;
  end;
  $$;

-- Cập nhật dữ liệu hiện tại: gọi lại function cho tất cả clan để
-- gán đời cho các spouse đang null.
do $$
declare
  c uuid;
begin
  for c in select id from public.clans loop
    perform public.recompute_generation_for_clan(c);
  end loop;
end;
$$;
