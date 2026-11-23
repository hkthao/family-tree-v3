-- Dòng thời gian — MỘT KHO DỮ LIỆU dùng chung cho poster dòng họ và dòng thời gian của từng người (Danh bạ).
-- Cùng cấu trúc + cùng giao diện nên sửa một chỗ. Dữ liệu RIÊNG, không phụ thuộc trực tiếp vào cây gia phả.
-- Xem docs/plan-dong-thoi-gian-dong-ho.md
--
-- Mỗi hàng là một mốc trên poster. Người dùng tự thêm / sửa / xoá, hoặc chọn từ "gợi ý từ gia phả"
-- (app dựng gợi ý từ cây, nhưng khi chọn thì SAO CHÉP thành một hàng ở đây — cây đổi sau đó không làm
-- mốc đổi hay mất).
--   person_id       = mốc nói về người nào (null = mốc chung của dòng họ). Trang người hiện các mốc có person_id của người đó.
--   on_clan         = có hiện trên poster DÒNG HỌ không. Mốc tạo từ poster dòng họ mặc định true; mốc chi tiết tạo ở trang
--                     người mặc định false (dòng họ chỉ cần tổng quan) — người dùng bật khi muốn đưa lên poster dòng họ.
--   era             = can chi của năm (vd 'Nhâm Thìn'), tự tính khi nhập; null nếu không có.
--   source_key      = khoá của gợi ý gia phả đã dùng để tạo mốc (chỉ để không gợi ý lại lần nữa), null = mốc tự thêm
--   photo_person_id = người có ảnh làm hình đại diện (null = dùng hình minh hoạ theo icon_key)
--   image_url       = hình riêng của mốc: 'lib:<id>' (thư viện hình dựng sẵn của app) hoặc link https ngoài.
--                     Có image_url thì thắng ảnh người; null = dùng ảnh người / biểu tượng.
--   sort_order      = số thứ tự trong cùng một năm (nhỏ hiện trước) để người dùng tự sắp khi một năm có nhiều mốc
--   context_title / context_body = phần "bối cảnh thời đại" (thẻ giấy ghi chú) do người dùng sửa; body mỗi dòng một ý.
--                     Cả hai null = dùng bối cảnh mặc định theo năm; cả hai chuỗi rỗng = ẩn thẻ bối cảnh.

create table public.clan_timeline_milestones (
  id               uuid primary key default gen_random_uuid(),
  clan_id          uuid not null references public.clans(id) on delete cascade,
  person_id        uuid references public.persons(id) on delete cascade,
  on_clan          boolean not null default true,
  era              text,
  year             int not null,
  sort_order       int not null default 0,
  title            text not null,
  body             text,
  icon_key         text,
  photo_person_id  uuid references public.persons(id) on delete set null,
  image_url        text,
  context_title    text,
  context_body     text,
  source_key       text,
  created_by       uuid references public.profiles(id) default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint clan_timeline_unique_source unique (clan_id, source_key),
  constraint clan_timeline_year check (year between -3000 and 9999),
  constraint clan_timeline_sort check (sort_order between 0 and 999),
  constraint clan_timeline_title check (nullif(btrim(title), '') is not null and char_length(title) <= 200),
  constraint clan_timeline_body_len check (body is null or char_length(body) <= 2000),
  constraint clan_timeline_key_len check (source_key is null or char_length(source_key) <= 100),
  constraint clan_timeline_image check (
    image_url is null
    or (char_length(image_url) <= 500 and image_url ~ '^(https://[^[:space:]]+|lib:[a-z0-9-]+)$')
  ),
  constraint clan_timeline_context_len check (
    (context_title is null or char_length(context_title) <= 200)
    and (context_body is null or char_length(context_body) <= 1000)
  ),
  constraint clan_timeline_icon_len check (icon_key is null or char_length(icon_key) <= 30)
);

create index clan_timeline_clan_year_idx on public.clan_timeline_milestones (clan_id, year);
create index clan_timeline_person_idx on public.clan_timeline_milestones (person_id, year, sort_order)
  where person_id is not null;

-- Người gắn vào mốc phải thuộc cùng dòng họ (person_id có thể null → mốc chung).
create or replace function public.check_timeline_person_clan()
  returns trigger
  language plpgsql
  set search_path = public, pg_temp
as $$
declare
  owner_clan uuid;
begin
  if new.person_id is not null then
    select clan_id into owner_clan from public.persons where id = new.person_id;
    if owner_clan is distinct from new.clan_id then
      raise exception 'clan_id mismatch on clan_timeline_milestones';
    end if;
  end if;
  return new;
end;
$$;

create trigger clan_timeline_person_clan_trg
  before insert or update on public.clan_timeline_milestones
  for each row execute function public.check_timeline_person_clan();

create trigger clan_timeline_set_updated_at
  before update on public.clan_timeline_milestones
  for each row execute function public.set_updated_at();

alter table public.clan_timeline_milestones enable row level security;

create policy clan_timeline_select on public.clan_timeline_milestones for select
  using (
    public.is_clan_member(clan_id)
    or public.is_platform_admin()
    or exists (select 1 from public.clans c where c.id = clan_id and c.visibility = 'public')
  );
create policy clan_timeline_insert on public.clan_timeline_milestones for insert
  with check (public.can_edit_clan(clan_id));
create policy clan_timeline_update on public.clan_timeline_milestones for update
  using (public.can_edit_clan(clan_id)) with check (public.can_edit_clan(clan_id));
create policy clan_timeline_delete on public.clan_timeline_milestones for delete
  using (public.can_edit_clan(clan_id));

comment on table public.clan_timeline_milestones is
  'Mốc dòng thời gian dòng họ — dữ liệu riêng, độc lập với cây gia phả (gợi ý từ cây được sao chép vào đây).';

-- Khách chưa đăng nhập xem dòng họ lịch sử công khai (như bảng person_timeline cũ).
create policy clan_timeline_anon_historical_select on public.clan_timeline_milestones for select
  to anon
  using (public.is_public_historical_clan(clan_id));
