-- Phase 2: lịch sử cải táng (bốc mộ / sang cát) cho một nơi an nghỉ.
-- Mỗi dòng = một lần di dời hài cốt tới nơi hiện tại: từ đâu (mô tả),
-- ngày (tuỳ chọn), ghi chú. Hiển thị dạng timeline ở chi tiết mộ.

create table public.resting_place_relocations (
  id        uuid primary key default gen_random_uuid(),
  resting_place_id uuid not null references public.resting_places(id) on delete cascade,
  clan_id   uuid not null references public.clans(id) on delete cascade, -- denormalized (synced)
  from_label text,        -- nơi cũ (mô tả tự do): "Nghĩa trang X, lô 3…"
  moved_on  date,         -- ngày cải táng (tuỳ chọn)
  note      text,
  created_at timestamptz not null default now()
);
create index resting_place_relocations_place_idx
  on public.resting_place_relocations (resting_place_id, moved_on);

-- Đồng bộ clan_id từ resting_place (tái dùng hàm có sẵn).
create trigger resting_place_relocations_sync_clan
  before insert or update of resting_place_id on public.resting_place_relocations
  for each row execute function public.resting_place_child_sync_clan();

alter table public.resting_place_relocations enable row level security;

create policy rpr_select on public.resting_place_relocations for select
  using (public.is_clan_member(clan_id) or public.is_platform_admin());
create policy rpr_insert on public.resting_place_relocations for insert
  with check (public.can_edit_clan(clan_id));
create policy rpr_update on public.resting_place_relocations for update
  using (public.can_edit_clan(clan_id)) with check (public.can_edit_clan(clan_id));
create policy rpr_delete on public.resting_place_relocations for delete
  using (public.can_edit_clan(clan_id));
