-- updated_at cho clans + events ----------------------------------------------
-- "Ngày cập nhật gần đây" cho danh sách Dòng họ và Sự kiện. Mỗi bảng nhận
-- thêm cột updated_at + một trigger BEFORE UPDATE stamp now() khi hàng bị sửa.
--
-- Dùng CHUNG một hàm trigger `touch_updated_at()` (table-agnostic: chỉ gán
-- new.updated_at = now()). Với clans, trigger cũng bắt được thay đổi nội dung
-- cây vì bump_data_version() tự UPDATE clans mỗi khi persons/families đổi.

create or replace function public.touch_updated_at()
  returns trigger
  language plpgsql
  as $$
  begin
    new.updated_at := now();
    return new;
  end;
  $$;

-- clans -----------------------------------------------------------------------
alter table public.clans
  add column updated_at timestamptz not null default now();

-- Backfill = created_at để giá trị có nghĩa cho dữ liệu cũ.
update public.clans set updated_at = created_at;

create trigger clans_touch_updated_at
  before update on public.clans
  for each row
  execute function public.touch_updated_at();

-- events ----------------------------------------------------------------------
alter table public.events
  add column updated_at timestamptz not null default now();

update public.events set updated_at = created_at;

create trigger events_touch_updated_at
  before update on public.events
  for each row
  execute function public.touch_updated_at();
