-- ============================================================================
-- ai_usage.turn_ref — nối lượt hỏi với bút toán đã trừ trong credit_ledger.
--
-- Vì sao cần: plan §"1 lượt" là gì ghi rõ **bấm "Sửa lại" rồi bóc tách
-- lại KHÔNG tính thêm lượt** — nếu không thì các cụ sợ, không dám sửa,
-- và dữ liệu sai cứ thế vào gia phả.
--
-- Cách làm là client gửi lại `ref` của lượt cũ, `credit_consume` thấy ref
-- trùng nên không trừ lần hai. Nhưng như vậy client cũng có thể gửi mãi
-- một ref để hỏi miễn phí — nên phải ĐẾM ĐƯỢC số lần dùng lại. Cột này
-- là chỗ đếm; máy chủ cho dùng lại tối đa vài lần rồi tính lượt mới.
-- ============================================================================

alter table public.ai_usage add column if not exists turn_ref text;

create index if not exists ai_usage_turn_ref_idx
  on public.ai_usage (user_id, turn_ref)
  where turn_ref is not null;

comment on column public.ai_usage.turn_ref is
  'Mã lượt đã trừ trong credit_ledger. Dùng để đếm số lần bóc tách lại miễn phí.';
