-- ============================================================================
-- Chấm điểm câu trả lời của trợ lý (plan §Đo lường: `ai_answer_rated`).
--
-- Vì sao lưu vào DB chứ không chỉ bắn một sự kiện analytics: sự kiện chỉ
-- nói "có người bấm không thích", không nói LƯỢT NÀO — mà lượt nào mới
-- là thứ cần để đi tìm nguyên nhân (model nào, mất bao lâu, gọi tool gì).
-- Gắn điểm vào chính dòng `ai_usage` thì mọi thứ đó nằm sẵn cùng hàng.
--
-- Vẫn KHÔNG có nội dung câu hỏi ở đây — `ai_usage` cố ý không lưu, và
-- việc chấm điểm không đổi điều đó.
-- ============================================================================

alter table public.ai_usage
  add column if not exists rating smallint
    check (rating is null or rating in (-1, 1)),
  add column if not exists rated_at timestamptz;

comment on column public.ai_usage.rating is
  '1 = hữu ích, -1 = không. NULL = người dùng chưa chấm.';

create index if not exists ai_usage_rating_idx
  on public.ai_usage (rating, at desc)
  where rating is not null;

/*
 * Chấm điểm MỘT lượt của CHÍNH MÌNH.
 *
 * Nhận `turn_ref` chứ không nhận id: client chỉ biết mã lượt do máy chủ
 * trả về, không biết id dòng trong ai_usage — mà cũng không nên biết.
 *
 * Đổi ý được (bấm lại đổi điểm, bấm cùng điểm hai lần thì bỏ chấm), nên
 * hàm nhận cả 0 với nghĩa "gỡ điểm".
 */
create or replace function public.ai_rate_turn(p_ref text, p_rating int)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'ai_rate_turn: chưa đăng nhập';
  end if;
  if p_rating not in (-1, 0, 1) then
    raise exception 'ai_rate_turn: điểm không hợp lệ';
  end if;

  -- Điều kiện user_id là thứ chặn chấm hộ lượt của người khác. Không
  -- báo lỗi khi không khớp: mã lượt lạ thì im lặng bỏ qua, đừng biến
  -- hàm này thành cách dò xem mã nào có thật.
  update public.ai_usage
     set rating = nullif(p_rating, 0),
         rated_at = case when p_rating = 0 then null else now() end
   where turn_ref = p_ref
     and user_id = v_uid;
end;
$$;

revoke execute on function public.ai_rate_turn(text, int) from public, anon;
grant execute on function public.ai_rate_turn(text, int) to authenticated;

-- ─── Đưa điểm vào báo cáo ─────────────────────────────────────────────
-- Thêm hai số vào tổng quan: bao nhiêu lượt được chấm, và bao nhiêu phần
-- trong đó là hài lòng. Tỉ lệ tính trên SỐ LƯỢT ĐƯỢC CHẤM, không phải
-- trên tổng số lượt — hầu hết người dùng không bấm gì cả, chia cho tổng
-- thì con số nào cũng ra "tệ".
create or replace function public.ai_usage_overview(p_days int default 30)
  returns json
  language plpgsql
  stable
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 365);
  v_from timestamptz := now() - make_interval(days => v_days);
  v_result json;
begin
  perform public.ai_admin_guard();

  select json_build_object(
    'days', v_days,
    'requests', count(*),
    'users', count(distinct user_id),
    'clans', count(distinct clan_id),
    'failed', count(*) filter (where not ok),
    'extracts', count(*) filter (where kind = 'extract'),
    'input_tokens', coalesce(sum(input_tokens), 0),
    'cached_tokens', coalesce(sum(cached_input_tokens), 0),
    'output_tokens', coalesce(sum(output_tokens), 0),
    'cost_usd', round(coalesce(sum(cost_usd), 0)::numeric, 4),
    'avg_latency_ms', coalesce(round(avg(latency_ms))::int, 0),
    'cached_ratio', case
      when coalesce(sum(input_tokens), 0) = 0 then 0
      else round(sum(cached_input_tokens)::numeric / sum(input_tokens), 3)
    end,
    'rated', count(*) filter (where rating is not null),
    'liked_ratio', case
      when count(*) filter (where rating is not null) = 0 then null
      else round(
        count(*) filter (where rating = 1)::numeric
          / count(*) filter (where rating is not null), 3)
    end
  ) into v_result
  from public.ai_usage
  where at >= v_from;

  return v_result;
end;
$$;
