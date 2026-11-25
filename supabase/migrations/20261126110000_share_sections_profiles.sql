-- Thêm khoá 'profiles' vào clans.share_sections: "Hồ sơ người đã mất" — tiểu sử, tên hiệu / tự / húy / thụy, ngày âm, nơi sinh / an táng
-- và dấu mốc cuộc đời của người đã mất, hiện ở trang hồ sơ của website dòng họ (docs/plan-trang-dong-ho.md, mục 6d).
--
-- Payload cây của link chia sẻ cố ý KHÔNG kèm các thông tin này (chỉ link QR một người mới có), nên với link token xem cây phải do admin bật.
-- Dòng họ CÔNG KHAI không cần khoá: chi tiết người đã mất vốn đã công khai cho người xem công khai (RLS persons_public_safe).
-- Mặc định tắt (không đổi dữ liệu hiện có).

alter table public.clans drop constraint if exists clans_share_sections_check;
alter table public.clans
  add constraint clans_share_sections_check
  check (share_sections <@ array['info', 'board', 'map', 'heritage', 'graves', 'honor', 'mosaic', 'events', 'profiles']::text[]);
