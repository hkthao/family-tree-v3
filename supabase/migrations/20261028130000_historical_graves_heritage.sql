-- Dòng họ lịch sử: lăng tẩm (resting_places), di sản (heritage_items) và sự
-- kiện thường niên (events — lễ hội, tế lăng; giỗ tự suy ra từ ngày mất) nhập
-- từ file nháp có trích dẫn — xem docs/plan-gia-pha-vua-chua.md.
--
-- external_key: khoá ổn định để script import chạy lại không tạo bản trùng.
-- Trích dẫn của lăng / di sản / sự kiện dùng chung person_citations (thêm cột đích).

alter table public.resting_places
  add column if not exists external_key text,
  drop constraint if exists resting_places_clan_external_key_uniq,
  add constraint resting_places_clan_external_key_uniq unique (clan_id, external_key);

alter table public.heritage_items
  add column if not exists external_key text,
  drop constraint if exists heritage_items_clan_external_key_uniq,
  add constraint heritage_items_clan_external_key_uniq unique (clan_id, external_key);

alter table public.events
  add column if not exists external_key text,
  drop constraint if exists events_clan_external_key_uniq,
  add constraint events_clan_external_key_uniq unique (clan_id, external_key);

alter table public.person_citations
  add column if not exists resting_place_id uuid
    references public.resting_places(id) on delete cascade,
  add column if not exists heritage_item_id uuid
    references public.heritage_items(id) on delete cascade,
  add column if not exists event_id uuid
    references public.events(id) on delete cascade,
  drop constraint if exists person_citations_target,
  add constraint person_citations_target check (
    num_nonnulls(person_id, family_id, resting_place_id, heritage_item_id, event_id) = 1
  );

create index if not exists person_citations_resting_place_idx
  on public.person_citations (resting_place_id) where resting_place_id is not null;
create index if not exists person_citations_heritage_item_idx
  on public.person_citations (heritage_item_id) where heritage_item_id is not null;
create index if not exists person_citations_event_idx
  on public.person_citations (event_id) where event_id is not null;

-- clan_id của trích dẫn phải khớp với đích (RLS dựa trên clan_id).
create or replace function public.check_historical_child_clan()
  returns trigger
  language plpgsql
  set search_path = public, pg_temp
as $$
declare
  owner_clan uuid;
begin
  if new.person_id is not null then
    select clan_id into owner_clan from public.persons where id = new.person_id;
  elsif tg_table_name = 'person_citations' and new.family_id is not null then
    select clan_id into owner_clan from public.families where id = new.family_id;
  elsif tg_table_name = 'person_citations' and new.resting_place_id is not null then
    select clan_id into owner_clan from public.resting_places where id = new.resting_place_id;
  elsif tg_table_name = 'person_citations' and new.heritage_item_id is not null then
    select clan_id into owner_clan from public.heritage_items where id = new.heritage_item_id;
  elsif tg_table_name = 'person_citations' and new.event_id is not null then
    select clan_id into owner_clan from public.events where id = new.event_id;
  end if;
  if owner_clan is distinct from new.clan_id then
    raise exception 'clan_id mismatch on %', tg_table_name;
  end if;
  return new;
end;
$$;
