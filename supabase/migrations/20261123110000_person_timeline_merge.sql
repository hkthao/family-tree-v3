-- Gộp dòng thời gian của từng người (person_timeline) vào kho dùng chung clan_timeline_milestones.
-- Bảng cũ person_timeline KHÔNG bị xoá (chỉ ngừng dùng) để có đường lui; xoá ở một migration sau khi đã kiểm chứng.
--
-- Quy tắc chuyển một dòng cũ (year, era, body):
--   title = body nếu ≤ 120 ký tự, ngược lại 117 ký tự đầu + '…' và body giữ NGUYÊN văn đầy đủ;
--   on_clan = false (mốc chi tiết của người, chưa đưa lên poster dòng họ);
--   context = rỗng (ẩn thẻ bối cảnh — mốc cuộc đời không cần thẻ thời đại cho từng dòng);
--   source_key = 'legacy:<id cũ>' để chạy lại migration không tạo trùng.

insert into public.clan_timeline_milestones
  (clan_id, person_id, on_clan, era, year, sort_order, title, body, context_title, context_body, source_key, created_at)
select
  pt.clan_id,
  pt.person_id,
  false,
  pt.era,
  pt.year,
  least(greatest(pt.sort, 0), 999),
  case when char_length(pt.body) <= 120 then pt.body else left(pt.body, 117) || '…' end,
  case when char_length(pt.body) <= 120 then null else pt.body end,
  '',
  '',
  'legacy:' || pt.id::text,
  pt.created_at
from public.person_timeline pt
where pt.year between -3000 and 9999
on conflict (clan_id, source_key) do nothing;

comment on table public.person_timeline is
  'DEPRECATED: đã gộp vào clan_timeline_milestones (person_id). Giữ lại để có đường lui; sẽ xoá ở migration sau.';
