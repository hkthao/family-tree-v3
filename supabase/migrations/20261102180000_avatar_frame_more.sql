-- Thêm 4 khung viền avatar kiểu hoàng gia: cinnabar, imperial, jade, bronze.
-- Constraint cũ do Postgres đặt tên tự động ({table}_avatar_frame_check).
alter table public.clans drop constraint if exists clans_avatar_frame_check;
alter table public.clans
  add constraint clans_avatar_frame_check
  check (avatar_frame in ('laurel', 'gold', 'silver', 'royal', 'lotus', 'fortune',
                          'cinnabar', 'imperial', 'jade', 'bronze'));

alter table public.persons drop constraint if exists persons_avatar_frame_check;
alter table public.persons
  add constraint persons_avatar_frame_check
  check (avatar_frame in ('laurel', 'gold', 'silver', 'royal', 'lotus', 'fortune',
                          'cinnabar', 'imperial', 'jade', 'bronze'));
