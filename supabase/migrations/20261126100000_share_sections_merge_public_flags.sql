-- Gộp cờ "người xem công khai được xem phần nào" vào clans.share_sections (docs/plan-trang-dong-ho.md, mục 2.2).
--
-- Trước đây có hai hệ cờ chạy song song:
--   • clans.public_show_heritage / graves / events — chỉ đọc bởi RLS cho người xem CÔNG KHAI (đăng nhập, không phải
--     thành viên) của dòng họ visibility='public';
--   • clans.share_sections — các phần hiện ở link chia sẻ (/share/:token).
-- Từ nay share_sections là nguồn duy nhất cho cả hai. visibility + public_show_tree giữ vai trò CỬA VÀO
-- (có công khai không, có cho xem cây không), không phải cờ từng mục.
--
-- ƯU TIÊN RIÊNG TƯ khi chuyển dữ liệu: với dòng họ ĐANG công khai, heritage / graves / events trong share_sections
-- được đặt đúng bằng cờ công khai cũ (cũ bật thì bật, cũ tắt thì tắt) → không ai bị lộ thêm. Hệ quả: dòng họ
-- công khai đã tick riêng 'heritage' / 'graves' cho link mà chưa mở cờ công khai sẽ MẤT mục đó khỏi link cho tới khi
-- admin tick lại ở Cài đặt (UI có cảnh báo). Dòng họ riêng tư giữ nguyên share_sections (RLS luôn đòi visibility='public').
--
-- Ba cột public_show_heritage/graves/events GIỮ LẠI thêm một đợt phát hành (không còn được đọc), xoá ở đợt sau.

-- 1. Thêm khoá 'events' vào CHECK.
alter table public.clans drop constraint if exists clans_share_sections_check;
alter table public.clans
  add constraint clans_share_sections_check
  check (share_sections <@ array['info', 'board', 'map', 'heritage', 'graves', 'honor', 'mosaic', 'events']::text[]);

-- 2. Dòng họ công khai: ba khoá heritage / graves / events lấy từ cờ cũ.
update public.clans c
set share_sections =
  coalesce(
    array(select k from unnest(c.share_sections) as k where k not in ('heritage', 'graves', 'events')),
    '{}'::text[]
  )
  || array_remove(
    array[
      case when c.public_show_heritage then 'heritage' end,
      case when c.public_show_graves   then 'graves'   end,
      case when c.public_show_events   then 'events'   end
    ]::text[],
    null
  )
where c.visibility = 'public';

-- 3. RLS: nhánh "công khai" đọc share_sections thay cho cờ cũ (cùng cấu trúc với 20260626120000_public_section_flags).
drop policy if exists heritage_items_select on public.heritage_items;
create policy heritage_items_select on public.heritage_items for select
  using (
    public.is_clan_member(clan_id) or public.is_platform_admin()
    or exists (select 1 from public.clans c
      where c.id = heritage_items.clan_id and c.visibility = 'public' and 'heritage' = any(c.share_sections))
  );
drop policy if exists heritage_media_select on public.heritage_media;
create policy heritage_media_select on public.heritage_media for select
  using (
    public.is_clan_member(clan_id) or public.is_platform_admin()
    or exists (select 1 from public.clans c
      where c.id = heritage_media.clan_id and c.visibility = 'public' and 'heritage' = any(c.share_sections))
  );
drop policy if exists heritage_people_select on public.heritage_people;
create policy heritage_people_select on public.heritage_people for select
  using (
    public.is_clan_member(clan_id) or public.is_platform_admin()
    or exists (select 1 from public.clans c
      where c.id = heritage_people.clan_id and c.visibility = 'public' and 'heritage' = any(c.share_sections))
  );

drop policy if exists resting_places_select on public.resting_places;
create policy resting_places_select on public.resting_places for select
  using (
    public.is_clan_member(clan_id) or public.is_platform_admin()
    or exists (select 1 from public.clans c
      where c.id = resting_places.clan_id and c.visibility = 'public' and 'graves' = any(c.share_sections))
  );
drop policy if exists rpo_select on public.resting_place_occupants;
create policy rpo_select on public.resting_place_occupants for select
  using (
    public.is_clan_member(clan_id) or public.is_platform_admin()
    or exists (select 1 from public.clans c
      where c.id = resting_place_occupants.clan_id and c.visibility = 'public' and 'graves' = any(c.share_sections))
  );
drop policy if exists rpp_select on public.resting_place_photos;
create policy rpp_select on public.resting_place_photos for select
  using (
    public.is_clan_member(clan_id) or public.is_platform_admin()
    or exists (select 1 from public.clans c
      where c.id = resting_place_photos.clan_id and c.visibility = 'public' and 'graves' = any(c.share_sections))
  );

drop policy if exists "events_select" on public.events;
create policy "events_select" on public.events for select
  using (
    public.is_clan_member(clan_id) or public.is_platform_admin()
    or exists (select 1 from public.clans c
      where c.id = events.clan_id and c.visibility = 'public' and 'events' = any(c.share_sections))
  );

-- 4. Storage: ảnh di sản / mộ cho người xem công khai.
drop policy if exists "person_photos_public_heritage_select" on storage.objects;
create policy "person_photos_public_heritage_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'person-photos'
    and (storage.foldername(name))[2] = 'heritage'
    and exists (select 1 from public.clans c
      where c.id = ((storage.foldername(name))[1])::uuid
        and c.visibility = 'public' and 'heritage' = any(c.share_sections))
  );
drop policy if exists "person_photos_public_grave_select" on storage.objects;
create policy "person_photos_public_grave_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'person-photos'
    and (storage.foldername(name))[2] = 'graves'
    and exists (select 1 from public.clans c
      where c.id = ((storage.foldername(name))[1])::uuid
        and c.visibility = 'public' and 'graves' = any(c.share_sections))
  );

comment on column public.clans.share_sections is
  'Các phần dòng họ cho xem (ngoài cây gia phả): hiện ở link chia sẻ VÀ với dòng họ công khai là phần người xem công khai đọc được (RLS). Admin chọn; rỗng = chỉ cây.';
comment on column public.clans.public_show_heritage is 'DEPRECATED — không còn được đọc; dùng share_sections (''heritage'').';
comment on column public.clans.public_show_graves   is 'DEPRECATED — không còn được đọc; dùng share_sections (''graves'').';
comment on column public.clans.public_show_events   is 'DEPRECATED — không còn được đọc; dùng share_sections (''events'').';
