-- ============================================================================
-- credit_ledger — sổ cái QUYỀN LỢI (GĐ 3 của docs/plan-ai-tro-ly.md).
--
-- Ba điều cố ý, mỗi điều đều có cái giá nếu làm ngược lại:
--
-- 1. **KHÔNG có tiền tố `ai_`.** Trợ lý AI chỉ là thứ đầu tiên bán được;
--    còn dung lượng ảnh, `profiles.max_clans`, xuất sách PDF… Đặt tên
--    `ai_credits` là tự khoá mình vào một sản phẩm, sau này đối soát tách
--    hai chỗ và doanh thu phải cộng tay. Phân loại bằng cột `resource`.
--
-- 2. **Không lưu số dư thành một con số.** Số dư = tổng các bút toán chưa
--    hết hạn. Khách hỏi "sao tôi mất 5 lượt" là phải chỉ ra được từng lượt
--    đi đâu — đúng tinh thần fund_audit đã làm cho quỹ họ.
--
-- 3. **`expires_at` diễn đạt luôn hai quy tắc sản phẩm**: 10 lượt free hết
--    hạn cuối tháng (có hạn), gói mua lẻ không hết hạn (null). Không cần
--    code riêng cho từng loại.
--
-- Bảng này KHÔNG chứa nội dung câu hỏi. Trưởng họ / admin xem được ai tiêu
-- bao nhiêu mà không đọc được câu hỏi của con cháu, vì nội dung nằm ở
-- ai_messages với RLS `owner_id = auth.uid()`. Tách bảng, không phải phân
-- quyền tinh vi trên cùng một bảng.
-- ============================================================================

create table public.credit_ledger (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,

  -- Loại quyền lợi. 'ai_request' = một lượt hỏi trợ lý.
  resource   text not null,

  -- +10 free, +100 mua, -1 tiêu, +1 hoàn. Bút toán 0 là vô nghĩa.
  delta      int not null check (delta <> 0),

  reason     text not null check (reason in
               ('monthly_free', 'purchase', 'consume', 'refund', 'admin_grant')),

  -- Đơn hàng sinh ra bút toán này. Chưa đặt khoá ngoại vì billing_orders
  -- thuộc GĐ 4; thêm FK lúc dựng bảng đó.
  order_id   uuid,

  -- Khoá chống ghi trùng: 'free:2026-08', 'qa:<id>', 'refund:qa:<id>'.
  -- Nhờ nó mà cấp free mỗi tháng, tiêu một lượt và hoàn một lượt đều gọi
  -- lại được nhiều lần mà không nhân đôi — mạng chập chờn là chuyện thường.
  ref        text,

  expires_at timestamptz,             -- null = không hết hạn
  actor_id   uuid references public.profiles(id) on delete set null,
  at         timestamptz not null default now()
);

create index credit_ledger_owner_idx
  on public.credit_ledger (owner_id, resource, at desc);

-- Chỉ tính bút toán còn hiệu lực khi cộng số dư.
create index credit_ledger_live_idx
  on public.credit_ledger (owner_id, resource)
  where expires_at is null;

create unique index credit_ledger_ref_uniq
  on public.credit_ledger (owner_id, resource, reason, ref)
  where ref is not null;

comment on table public.credit_ledger is
  'Sổ cái quyền lợi (lượt trợ lý, dung lượng…). Chỉ ghi thêm, không sửa.';

-- ─── Số dư = view, chưa cần bảng cache ────────────────────────────────
-- Vài nghìn dòng thì sum() tức thì. Khi nào chậm mới thêm bảng cache do
-- trigger cập nhật — đừng tối ưu sớm, nhưng đường nâng cấp có sẵn.
--
-- security_invoker: KHÔNG có nó thì view chạy bằng quyền của postgres và
-- RLS ở bảng dưới bị bỏ qua — ai cũng đọc được số dư của người khác.
create view public.credit_balance
  with (security_invoker = true) as
select owner_id,
       resource,
       sum(delta)::int as balance
from public.credit_ledger
where expires_at is null or expires_at > now()
group by owner_id, resource;

-- ─── RLS ──────────────────────────────────────────────────────────────
alter table public.credit_ledger enable row level security;

-- Chính chủ xem sổ của mình; platform admin xem để đối soát khi khách
-- khiếu nại. KHÔNG có policy ghi — chỉ RPC security definer viết.
create policy credit_ledger_select on public.credit_ledger for select
  using (owner_id = auth.uid() or public.is_platform_admin());

revoke all on public.credit_ledger from anon, authenticated;
grant select on public.credit_ledger to authenticated;
revoke all on public.credit_balance from anon;
grant select on public.credit_balance to authenticated;

-- ─── Số lượt free mỗi tháng — đổi không cần deploy ────────────────────
insert into public.platform_settings (key, value)
values ('ai.free_per_month', '10')
on conflict (key) do nothing;

create or replace function public.credit_monthly_free_amount()
  returns int
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  -- Giá trị rác trong platform_settings không được làm sập việc cấp free.
  select coalesce(
    (select nullif(regexp_replace(value, '\D', '', 'g'), '')::int
       from public.platform_settings where key = 'ai.free_per_month'),
    10);
$$;

-- ─── Cấp lượt free của tháng, gọi bao nhiêu lần cũng chỉ cấp một lần ──
-- Mốc tháng tính theo GIỜ VIỆT NAM: người dùng ở VN, "đầu tháng" phải là
-- đầu tháng của họ chứ không phải của UTC (lệch 7 tiếng, đúng vào đêm
-- giao thừa dương lịch thì thành cấp sai tháng).
create or replace function public.credit_ensure_monthly_free(
  p_owner uuid,
  p_resource text default 'ai_request'
) returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_month_start timestamptz;
  v_next_month  timestamptz;
  v_amount      int := public.credit_monthly_free_amount();
begin
  if p_owner is null or v_amount <= 0 then return; end if;

  v_month_start := date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh')
                     at time zone 'Asia/Ho_Chi_Minh';
  v_next_month  := v_month_start + interval '1 month';

  insert into public.credit_ledger
    (owner_id, resource, delta, reason, ref, expires_at)
  values
    (p_owner, p_resource, v_amount, 'monthly_free',
     'free:' || to_char(v_month_start at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM'),
     v_next_month)
  on conflict do nothing;
end;
$$;

-- ─── Tiêu một lượt — ATOMIC ───────────────────────────────────────────
-- "Đếm rồi mới ghi" là có race: mở hai tab bấm cùng lúc là vượt hạn mức.
-- Khoá theo ví (advisory lock trong transaction) nên hai lời gọi cùng một
-- ví phải xếp hàng, còn ví khác nhau vẫn chạy song song.
--
-- Trả về số dư còn lại, hoặc NULL nếu không đủ — người gọi phân biệt được
-- "hết lượt" (mời mua thêm) với lỗi hệ thống.
create or replace function public.credit_consume(
  p_owner uuid,
  p_resource text,
  p_amount int,
  p_ref text
) returns int
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_balance int;
  v_id      uuid;
begin
  if p_owner is null or p_amount is null or p_amount <= 0 then
    raise exception 'credit_consume: tham số không hợp lệ';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_owner::text || ':' || p_resource, 0));

  select coalesce(sum(delta), 0) into v_balance
  from public.credit_ledger
  where owner_id = p_owner
    and resource = p_resource
    and (expires_at is null or expires_at > now());

  if v_balance < p_amount then
    return null;
  end if;

  insert into public.credit_ledger
    (owner_id, resource, delta, reason, ref)
  values
    (p_owner, p_resource, -p_amount, 'consume', p_ref)
  on conflict do nothing
  returning id into v_id;

  -- Không insert được = đã tiêu lượt này rồi (gọi lại do mạng chập chờn).
  -- Số dư đã trừ từ lần trước nên trả nguyên, không trừ thêm lần nữa.
  if v_id is null then
    return v_balance;
  end if;

  return v_balance - p_amount;
end;
$$;

-- ─── Cấp lượt: mua, hoàn, admin cấp bù ────────────────────────────────
-- Hoàn tiền là BÚT TOÁN MỚI (+1), không xoá bút toán cũ — giữ nguyên lịch
-- sử để đối soát. Xoá đi thì không ai trả lời được "lượt đó đi đâu".
create or replace function public.credit_grant(
  p_owner uuid,
  p_resource text,
  p_amount int,
  p_reason text,
  p_ref text default null,
  p_expires_at timestamptz default null,
  p_order_id uuid default null,
  p_actor_id uuid default null
) returns int
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_balance int;
begin
  if p_owner is null or p_amount is null or p_amount <= 0 then
    raise exception 'credit_grant: tham số không hợp lệ';
  end if;
  if p_reason not in ('purchase', 'refund', 'admin_grant', 'monthly_free') then
    raise exception 'credit_grant: reason không hợp lệ (%)', p_reason;
  end if;

  insert into public.credit_ledger
    (owner_id, resource, delta, reason, ref, expires_at, order_id, actor_id)
  values
    (p_owner, p_resource, p_amount, p_reason, p_ref, p_expires_at,
     p_order_id, p_actor_id)
  on conflict do nothing;

  select coalesce(sum(delta), 0) into v_balance
  from public.credit_ledger
  where owner_id = p_owner
    and resource = p_resource
    and (expires_at is null or expires_at > now());

  return v_balance;
end;
$$;

-- ─── Hạn mức của CHÍNH TÔI, cho app đọc ───────────────────────────────
-- Gọi cả lúc mở khung chat: mở ra là có luôn lượt free của tháng, không
-- phải đợi hỏi câu đầu tiên mới được cấp (nếu không thì màn hình hiện
-- "còn 0 lượt" ngay lúc người dùng chưa làm gì — trông như đã hết).
create or replace function public.credit_my_quota(
  p_resource text default 'ai_request'
) returns json
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_balance int;
  v_free    int;
  v_used    int;
begin
  if v_uid is null then
    raise exception 'credit_my_quota: chưa đăng nhập';
  end if;

  perform public.credit_ensure_monthly_free(v_uid, p_resource);

  select coalesce(sum(delta), 0) into v_balance
  from public.credit_ledger
  where owner_id = v_uid and resource = p_resource
    and (expires_at is null or expires_at > now());

  select coalesce(sum(delta), 0) into v_free
  from public.credit_ledger
  where owner_id = v_uid and resource = p_resource
    and reason = 'monthly_free'
    and (expires_at is null or expires_at > now());

  select coalesce(-sum(delta), 0) into v_used
  from public.credit_ledger
  where owner_id = v_uid and resource = p_resource
    and reason = 'consume'
    and at >= date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh')
                at time zone 'Asia/Ho_Chi_Minh';

  return json_build_object(
    'balance', v_balance,
    'free_this_month', v_free,
    'used_this_month', v_used);
end;
$$;

-- ─── Quyền gọi ────────────────────────────────────────────────────────
-- consume/grant/ensure chỉ dành cho Edge Function (service role). Để
-- authenticated gọi được là tự tay đưa cho người dùng nút "cấp thêm lượt
-- cho chính tôi" — security definer nghĩa là hàm chạy với quyền chủ hàm,
-- không phải quyền người gọi.
revoke execute on function public.credit_consume(uuid, text, int, text)
  from public, anon, authenticated;
revoke execute on function
  public.credit_grant(uuid, text, int, text, text, timestamptz, uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.credit_ensure_monthly_free(uuid, text)
  from public, anon, authenticated;
revoke execute on function public.credit_monthly_free_amount()
  from public, anon;

-- Riêng hàm này an toàn cho app gọi: nó chỉ đụng tới ví của auth.uid().
grant execute on function public.credit_my_quota(text) to authenticated;
