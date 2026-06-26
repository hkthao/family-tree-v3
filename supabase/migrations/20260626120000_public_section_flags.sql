-- Cho admin dòng họ tuỳ chọn người xem CÔNG KHAI (đăng nhập, không phải
-- thành viên) được xem PHẦN NÀO: Cây gia phả & Danh bạ / Di sản / Mộ phần /
-- Sự kiện. `visibility='public'` vẫn là công tắc tổng; 4 cờ dưới chỉ có hiệu
-- lực khi public. Mặc định giữ hành vi cũ: cây BẬT, còn lại TẮT (events trước
-- đây tự public theo visibility → giờ phải bật cờ mới hiện).

alter table public.clans
  add column public_show_tree     boolean not null default true,
  add column public_show_heritage boolean not null default false,
  add column public_show_graves   boolean not null default false,
  add column public_show_events   boolean not null default false;

-- ─── Cây & Danh bạ: 2 view masked thêm điều kiện cờ public_show_tree ──
-- Member/admin vẫn thấy bất kể cờ; chỉ nhánh "public" mới gắn cờ.
drop view if exists public.persons_public_safe;
create view public.persons_public_safe
  with (security_invoker = false) as
  select
    p.id, p.clan_id, p.full_name, p.full_name_unaccent, p.gender,
    p.generation, p.branch_id, p.is_living, p.is_root,
    case when p.is_living then null else p.birth_date end as birth_date,
    case when p.is_living then null else p.birth_date_precision end as birth_date_precision,
    case when p.is_living then null else p.death_date end as death_date,
    case when p.is_living then null else p.death_date_precision end as death_date_precision,
    case when p.is_living then null else p.birth_place end as birth_place,
    case when p.is_living then null else p.burial_place end as burial_place,
    case when p.is_living then null else p.photo_path end as photo_path,
    case when p.is_living then null else p.bio end as bio,
    case when p.is_living then null else p.courtesy_name end as courtesy_name,
    case when p.is_living then null else p.posthumous_name end as posthumous_name,
    case when p.is_living then null else p.nickname end as nickname,
    case when p.is_living then null else p.birth_lunar_year end as birth_lunar_year,
    case when p.is_living then null else p.birth_lunar_month end as birth_lunar_month,
    case when p.is_living then null else p.birth_lunar_day end as birth_lunar_day,
    case when p.is_living then null else p.death_lunar_year end as death_lunar_year,
    case when p.is_living then null else p.death_lunar_month end as death_lunar_month,
    case when p.is_living then null else p.death_lunar_day end as death_lunar_day,
    case when p.is_living then null else p.death_anniv_lunar_month end as death_anniv_lunar_month,
    case when p.is_living then null else p.death_anniv_lunar_day end as death_anniv_lunar_day,
    p.death_anniv_lunar_is_leap,
    case when p.is_living then null else p.lifespan_years end as lifespan_years,
    p.birth_family_id, p.birth_order
  from public.persons p
  where p.deleted_at is null
    and exists (
      select 1 from public.clans c
      where c.id = p.clan_id
        and (
          (c.visibility = 'public' and c.public_show_tree)
          or public.is_clan_member(c.id)
          or public.is_platform_admin()
        )
    );
revoke all on public.persons_public_safe from public, anon;
grant select on public.persons_public_safe to authenticated;

create or replace view public.families_public_safe
  with (security_invoker = false) as
  select f.id, f.clan_id, f.husband_id, f.wife_id, f.union_type,
         f.spouse_order, f.created_at
  from public.families f
  where f.deleted_at is null
    and exists (
      select 1 from public.clans c
      where c.id = f.clan_id
        and (
          (c.visibility = 'public' and c.public_show_tree)
          or public.is_clan_member(c.id)
          or public.is_platform_admin()
        )
    );
revoke all on public.families_public_safe from public, anon;
grant select on public.families_public_safe to authenticated;

-- ─── Helper: clan công khai + bật cờ phần X ──────────────────────────
-- (Viết inline trong từng policy cho rõ ràng; mẫu giống events_public_select.)

-- ─── Di sản: di sản chỉ hiện cho non-member khi public_show_heritage ──
drop policy if exists heritage_items_select on public.heritage_items;
create policy heritage_items_select on public.heritage_items for select
  using (
    public.is_clan_member(clan_id) or public.is_platform_admin()
    or exists (select 1 from public.clans c
      where c.id = heritage_items.clan_id and c.visibility = 'public' and c.public_show_heritage)
  );
drop policy if exists heritage_media_select on public.heritage_media;
create policy heritage_media_select on public.heritage_media for select
  using (
    public.is_clan_member(clan_id) or public.is_platform_admin()
    or exists (select 1 from public.clans c
      where c.id = heritage_media.clan_id and c.visibility = 'public' and c.public_show_heritage)
  );
drop policy if exists heritage_people_select on public.heritage_people;
create policy heritage_people_select on public.heritage_people for select
  using (
    public.is_clan_member(clan_id) or public.is_platform_admin()
    or exists (select 1 from public.clans c
      where c.id = heritage_people.clan_id and c.visibility = 'public' and c.public_show_heritage)
  );

-- ─── Mộ phần: chỉ hiện cho non-member khi public_show_graves ─────────
drop policy if exists resting_places_select on public.resting_places;
create policy resting_places_select on public.resting_places for select
  using (
    public.is_clan_member(clan_id) or public.is_platform_admin()
    or exists (select 1 from public.clans c
      where c.id = resting_places.clan_id and c.visibility = 'public' and c.public_show_graves)
  );
drop policy if exists rpo_select on public.resting_place_occupants;
create policy rpo_select on public.resting_place_occupants for select
  using (
    public.is_clan_member(clan_id) or public.is_platform_admin()
    or exists (select 1 from public.clans c
      where c.id = resting_place_occupants.clan_id and c.visibility = 'public' and c.public_show_graves)
  );
drop policy if exists rpp_select on public.resting_place_photos;
create policy rpp_select on public.resting_place_photos for select
  using (
    public.is_clan_member(clan_id) or public.is_platform_admin()
    or exists (select 1 from public.clans c
      where c.id = resting_place_photos.clan_id and c.visibility = 'public' and c.public_show_graves)
  );

-- ─── Sự kiện: thêm điều kiện cờ vào nhánh public của events_select ───
drop policy if exists "events_select" on public.events;
create policy "events_select" on public.events for select
  using (
    public.is_clan_member(clan_id) or public.is_platform_admin()
    or exists (select 1 from public.clans c
      where c.id = events.clan_id and c.visibility = 'public' and c.public_show_events)
  );

-- ─── Storage: ảnh di sản / mộ cho non-member khi cờ bật ──────────────
-- Bucket private person-photos; path {clan_id}/heritage/... và
-- {clan_id}/graves/... → foldername[1]=clan_id, [2]=loại.
create policy "person_photos_public_heritage_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'person-photos'
    and (storage.foldername(name))[2] = 'heritage'
    and exists (select 1 from public.clans c
      where c.id = ((storage.foldername(name))[1])::uuid
        and c.visibility = 'public' and c.public_show_heritage)
  );
create policy "person_photos_public_grave_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'person-photos'
    and (storage.foldername(name))[2] = 'graves'
    and exists (select 1 from public.clans c
      where c.id = ((storage.foldername(name))[1])::uuid
        and c.visibility = 'public' and c.public_show_graves)
  );
