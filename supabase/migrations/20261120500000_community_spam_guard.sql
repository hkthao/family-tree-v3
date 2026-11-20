-- Chống spam khi link chia sẻ / link mời góp bị lộ (docs/plan-dong-gop-cong-dong.md §7).
--
-- share_links.contrib_paused_at: link TỰ TẠM DỪNG nhận đóng góp khi vượt trần trong 24 giờ
-- (community-submit / submit-contribution đặt bằng service role). Link vẫn XEM được; chỉ thôi nhận
-- đóng góp. Người tạo link / admin mở lại (đặt null) hoặc thu hồi hẳn.

alter table public.share_links
  add column if not exists contrib_paused_at timestamptz;

comment on column public.share_links.contrib_paused_at is
  'Tự tạm dừng nhận đóng góp (quá nhiều trong 24h — có thể link bị lộ). null = đang nhận.';

-- Đếm nhanh đóng góp của khách theo link / theo họ trong 24 giờ (trần chống spam).
create index if not exists person_memories_guest_recent_idx
  on public.person_memories (clan_id, created_at desc) where author_user_id is null;
