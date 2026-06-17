-- Per-clan generation offset cho phép một số dòng họ hiển thị
-- "Thủy tổ là Đời 0" thay vì "Đời 1" mặc định.
--
-- DB vẫn lưu generation thực (1-based qua recompute_generation_for_clan).
-- Khi render lên UI, frontend trừ offset:
--   - offset = 0 (mặc định): Đời 1 = Thủy tổ. Behavior cũ.
--   - offset = 1: Đời 0 = Thủy tổ. Con = Đời 1, Cháu = Đời 2, ...
--
-- Chỉ ảnh hưởng phần hiển thị; sort/filter ở DB vẫn dùng generation
-- thực nên không phá data hoặc query nào.

alter table public.clans
  add column generation_offset smallint not null default 0
    check (generation_offset in (0, 1));

comment on column public.clans.generation_offset is
  'Display offset: hiển thị "Đời N" = generation - generation_offset. 0 = Thủy tổ là Đời 1 (default), 1 = Thủy tổ là Đời 0.';
