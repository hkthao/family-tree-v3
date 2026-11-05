-- Canvas vẽ cây gia phả kéo thả: mỗi dòng họ có thể lưu nhiều bố cục.
-- `layout` chứa vị trí từng người ({ positions: { personId: {x,y} } }) và tuỳ chọn
-- hiển thị (kiểu đường nối, nền, khung...). Đọc: thành viên; sửa: can_edit_clan.
create table if not exists public.tree_canvases (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  layout jsonb not null default '{}'::jsonb
    check (pg_column_size(layout) <= 1048576),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tree_canvases_clan_idx
  on public.tree_canvases (clan_id, updated_at desc);

create trigger tree_canvases_set_updated_at
  before update on public.tree_canvases
  for each row execute function public.set_updated_at();

alter table public.tree_canvases enable row level security;

create policy tree_canvases_select on public.tree_canvases for select
  using (public.is_clan_member(clan_id) or public.is_platform_admin());
create policy tree_canvases_insert on public.tree_canvases for insert
  with check (public.can_edit_clan(clan_id));
create policy tree_canvases_update on public.tree_canvases for update
  using (public.can_edit_clan(clan_id)) with check (public.can_edit_clan(clan_id));
create policy tree_canvases_delete on public.tree_canvases for delete
  using (public.can_edit_clan(clan_id));
