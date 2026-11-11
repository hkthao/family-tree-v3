-- Lịch thuê bao (subscribe): mỗi người một đường dẫn .ics riêng cho từng dòng
-- họ, dán vào Google/Apple Calendar một lần là ngày giỗ, sinh nhật, sự kiện tự
-- cập nhật. Edge Function `calendar-feed` tra token (service role) rồi kiểm tra
-- người đó còn là thành viên. Thu hồi = xoá dòng.
create table public.calendar_feeds (
  id              uuid primary key default gen_random_uuid(),
  clan_id         uuid not null references public.clans(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  token           text not null unique,
  created_at      timestamptz not null default now(),
  last_fetched_at timestamptz,
  constraint calendar_feeds_token_len check (char_length(token) between 24 and 128),
  unique (clan_id, user_id)
);
create index calendar_feeds_token_idx on public.calendar_feeds (token);

alter table public.calendar_feeds enable row level security;

-- Chỉ chủ của đường dẫn thấy / tạo / xoá của chính mình; tạo thì phải là thành viên.
create policy calendar_feeds_select on public.calendar_feeds for select
  using (user_id = (select auth.uid()));
create policy calendar_feeds_insert on public.calendar_feeds for insert
  with check (user_id = (select auth.uid()) and public.is_clan_member(clan_id));
create policy calendar_feeds_delete on public.calendar_feeds for delete
  using (user_id = (select auth.uid()));
