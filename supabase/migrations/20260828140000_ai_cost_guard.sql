-- ============================================================================
-- Ngắt mạch chi phí + rate limit theo IP (lớp 2 và 3 của
-- docs/plan-ai-tro-ly.md §Ba lớp khác nhau — đừng gộp làm một).
--
-- Ba lớp KHÁC MỤC ĐÍCH, và đây là hai lớp còn thiếu:
--   1. Hạn mức    — mô hình kinh doanh (credit_ledger, đã có ở GĐ 3).
--   2. Rate limit — chống spam/vòng lặp lỗi. Đã có theo NGƯỜI; thêm theo
--      IP vì tạo tài khoản mới quá dễ (plan §Bảo mật mục 17).
--   3. Ngắt mạch  — chặn hoá đơn thảm hoạ khi có bug gọi API 10.000 lần.
--      Hạn mức theo người KHÔNG cứu được ca này: mỗi người vẫn trong hạn
--      mức, mà tổng thì cháy.
-- ============================================================================

-- ─── Dấu vết IP để rate limit, KHÔNG lưu IP thật ──────────────────────
-- Băm ở Edge Function bằng khoá chỉ có ở env. Lưu IP thô là tự tạo thêm
-- một kho dữ liệu cá nhân cho một việc chỉ cần so trùng.
alter table public.ai_usage add column if not exists ip_hash text;

create index if not exists ai_usage_ip_idx
  on public.ai_usage (ip_hash, at desc)
  where ip_hash is not null;

comment on column public.ai_usage.ip_hash is
  'SHA-256 của IP + khoá ở env. Chỉ để đếm rate limit, không truy ngược được.';

-- ─── Trần chi phí toàn hệ thống ───────────────────────────────────────
-- Đổi trần không cần deploy. Đặt '0' để tắt hẳn ngắt mạch.
insert into public.platform_settings (key, value)
values ('ai.daily_cost_cap_usd', '20')
on conflict (key) do nothing;

/*
 * Đã tiêu bao nhiêu đô hôm nay.
 *
 * "Hôm nay" tính theo GIỜ VIỆT NAM, không phải UTC: người vận hành nhìn
 * bảng theo ngày của mình, mà mốc UTC thì cắt ngày vào lúc 7 giờ sáng VN
 * — đúng giữa lúc đang dùng, nhìn số liệu sẽ không hiểu nổi.
 */
create or replace function public.ai_spend_today()
  returns numeric
  language plpgsql
  stable
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_role text := coalesce(
    current_setting('request.jwt.claims', true)::json ->> 'role', '');
begin
  -- SECURITY DEFINER nên phải tự kiểm quyền: nếu không, mọi người dùng
  -- đăng nhập đều đọc được doanh số vận hành. Edge Function đi bằng
  -- service_role, màn quản trị đi bằng platform admin — ngoài hai đường
  -- đó thì không ai cần con số này.
  if v_role <> 'service_role' and not public.is_platform_admin() then
    raise exception 'ai_spend_today: không có quyền';
  end if;

  return (
    select coalesce(sum(cost_usd), 0)
    from public.ai_usage
    where at >= date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh')
              at time zone 'Asia/Ho_Chi_Minh');
end;
$$;

revoke execute on function public.ai_spend_today() from public, anon;
-- Cấp cho authenticated, nhưng bản thân hàm chỉ trả lời platform admin.
grant execute on function public.ai_spend_today() to authenticated;

comment on function public.ai_spend_today() is
  'Chi phí AI đã tiêu trong ngày (giờ VN). Dùng cho ngắt mạch chi phí.';
