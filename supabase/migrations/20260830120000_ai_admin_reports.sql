-- ============================================================================
-- Báo cáo sử dụng trợ lý AI cho platform admin.
--
-- Vì sao là RPC chứ không để client tự SUM: một tháng vài nghìn dòng thì
-- kéo hết về trình duyệt rồi cộng là tốn băng thông vô ích, mà lại chậm
-- đúng lúc admin cần nhìn nhanh. Postgres cộng sẵn, trả về vài chục dòng.
--
-- Mọi hàm ở đây TỰ KIỂM QUYỀN. `security definer` mà chỉ dựa vào GRANT là
-- mọi người dùng đăng nhập đọc được doanh số vận hành — xem ai_spend_today
-- (migration 20260828140000) đã vấp đúng chỗ này.
-- ============================================================================

/*
 * Chỉ Edge Function (service_role) và platform admin. Ném lỗi chứ không
 * trả rỗng: trả rỗng thì màn hình hiện "0 lượt" và người xem tưởng hệ
 * thống không ai dùng, thay vì biết mình không có quyền.
 */
create or replace function public.ai_admin_guard()
  returns void
  language plpgsql
  stable
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_role text := coalesce(
    current_setting('request.jwt.claims', true)::json ->> 'role', '');
begin
  if v_role <> 'service_role' and not public.is_platform_admin() then
    raise exception 'Không có quyền xem báo cáo trợ lý AI';
  end if;
end;
$$;

revoke execute on function public.ai_admin_guard() from public, anon;
grant execute on function public.ai_admin_guard() to authenticated;

/*
 * Tổng quan N ngày gần nhất.
 *
 * Có `failed` và `avg_latency_ms` chứ không chỉ tiền: hỏng và chậm là hai
 * thứ người dùng cảm nhận được ngay, còn tiền thì chỉ admin thấy. Bảng
 * điều khiển mà chỉ có tiền là bảng điều khiển của kế toán.
 *
 * `cached_ratio` để canh prompt caching còn chạy không — theo phân tích
 * chi phí, cache quan trọng hơn cả việc chọn model, mà nó lại hỏng âm
 * thầm (đổi system prompt là mất cache, hoá đơn tăng, không ai báo).
 */
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
    end
  ) into v_result
  from public.ai_usage
  where at >= v_from;

  return v_result;
end;
$$;

/* Theo NGÀY (giờ VN) — để vẽ cột và nhìn ra ngày bất thường. */
create or replace function public.ai_usage_daily(p_days int default 30)
  returns table (day date, requests int, failed int, cost_usd numeric)
  language plpgsql
  stable
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 365);
begin
  perform public.ai_admin_guard();

  return query
  select (u.at at time zone 'Asia/Ho_Chi_Minh')::date as day,
         count(*)::int as requests,
         count(*) filter (where not u.ok)::int as failed,
         round(coalesce(sum(u.cost_usd), 0)::numeric, 4) as cost_usd
  from public.ai_usage u
  where u.at >= now() - make_interval(days => v_days)
  group by 1
  order by 1;
end;
$$;

/* Theo MODEL — đổi model xong có rẻ đi thật không. */
create or replace function public.ai_usage_by_model(p_days int default 30)
  returns table (
    model_id text,
    requests int,
    cost_usd numeric,
    avg_latency_ms int,
    cached_ratio numeric
  )
  language plpgsql
  stable
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 365);
begin
  perform public.ai_admin_guard();

  return query
  select u.model_id,
         count(*)::int,
         round(coalesce(sum(u.cost_usd), 0)::numeric, 4),
         coalesce(round(avg(u.latency_ms))::int, 0),
         case
           when coalesce(sum(u.input_tokens), 0) = 0 then 0
           else round(sum(u.cached_input_tokens)::numeric / sum(u.input_tokens), 3)
         end
  from public.ai_usage u
  where u.at >= now() - make_interval(days => v_days)
  group by u.model_id
  order by 3 desc;
end;
$$;

/*
 * Theo DÒNG HỌ — ai đang tiêu nhiều nhất.
 *
 * Chỉ đếm lượt và tiền, KHÔNG có nội dung: ai_usage cố tình không lưu câu
 * hỏi. Admin cần biết dòng họ nào tốn tiền, không cần biết họ hỏi gì.
 */
create or replace function public.ai_usage_by_clan(p_days int default 30)
  returns table (
    clan_id uuid,
    clan_name text,
    requests int,
    users int,
    cost_usd numeric
  )
  language plpgsql
  stable
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 365);
begin
  perform public.ai_admin_guard();

  return query
  select u.clan_id,
         coalesce(c.name, '(đã xoá)') as clan_name,
         count(*)::int,
         count(distinct u.user_id)::int,
         round(coalesce(sum(u.cost_usd), 0)::numeric, 4)
  from public.ai_usage u
  left join public.clans c on c.id = u.clan_id
  where u.at >= now() - make_interval(days => v_days)
  group by u.clan_id, c.name
  order by 5 desc
  limit 50;
end;
$$;

/*
 * Sổ quyền lợi tháng này: cấp bao nhiêu, tiêu bao nhiêu, hoàn bao nhiêu,
 * và BAO NHIÊU NGƯỜI ĐANG HẾT LƯỢT.
 *
 * Con số cuối là con số sản phẩm quan trọng nhất ở đây: nó trả lời "hạn
 * mức 10 lượt/tháng có chật quá không" — thứ mà plan hẹn chạy free tier
 * vài tuần rồi mới định giá. Không đo thì lúc định giá vẫn là đoán.
 */
create or replace function public.credit_overview()
  returns json
  language plpgsql
  stable
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_month_start timestamptz := date_trunc(
    'month', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh';
  v_result json;
begin
  perform public.ai_admin_guard();

  select json_build_object(
    'granted', coalesce(sum(delta) filter (where delta > 0), 0),
    'consumed', coalesce(-sum(delta) filter (where reason = 'consume'), 0),
    'refunded', coalesce(sum(delta) filter (where reason = 'refund'), 0),
    'wallets', count(distinct owner_id),
    'exhausted', (
      select count(*) from public.credit_balance
      where resource = 'ai_request' and balance <= 0
    )
  ) into v_result
  from public.credit_ledger
  where resource = 'ai_request' and at >= v_month_start;

  return v_result;
end;
$$;

revoke execute on function public.ai_usage_overview(int) from public, anon;
revoke execute on function public.ai_usage_daily(int) from public, anon;
revoke execute on function public.ai_usage_by_model(int) from public, anon;
revoke execute on function public.ai_usage_by_clan(int) from public, anon;
revoke execute on function public.credit_overview() from public, anon;

grant execute on function public.ai_usage_overview(int) to authenticated;
grant execute on function public.ai_usage_daily(int) to authenticated;
grant execute on function public.ai_usage_by_model(int) to authenticated;
grant execute on function public.ai_usage_by_clan(int) to authenticated;
grant execute on function public.credit_overview() to authenticated;
