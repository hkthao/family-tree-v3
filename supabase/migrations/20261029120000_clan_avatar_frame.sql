-- Viền avatar chọn cho CẢ DÒNG HỌ (không theo từng người): mọi avatar trong họ
-- dùng chung một khung. persons.avatar_frame (migration trước) không còn dùng.
alter table public.clans
  add column if not exists avatar_frame text
    check (avatar_frame in ('laurel', 'gold', 'silver', 'royal', 'lotus', 'fortune'));
