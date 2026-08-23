-- ============================================================================
-- ai_usage — đo lường kỹ thuật cho trợ lý AI (GĐ 0).
--
-- CỐ TÌNH KHÔNG có cột nào chứa nội dung câu hỏi hay câu trả lời. Đây là
-- bảng admin và các job đọc được; nhét nội dung vào đây là biến nó thành
-- kho PII gia đình. Nội dung hội thoại sẽ nằm ở bảng riêng (ai_messages,
-- GĐ 2) với RLS chỉ cho chính chủ đọc.
--
-- Xem docs/plan-ai-tro-ly.md §Đánh giá lại bảo mật (mục 14).
-- ============================================================================

create table public.ai_usage (
  id          uuid primary key default gen_random_uuid(),
  clan_id     uuid references public.clans(id) on delete set null,
  user_id     uuid references public.profiles(id) on delete set null,

  -- Loại việc, KHÔNG phải nội dung việc.
  kind        text not null check (kind in ('qa', 'extract')),

  model_id    text not null,          -- id trong registry, vd 'gpt-5.6-luna'
  raw_model   text,                   -- id provider trả về (có thể khác)

  input_tokens        int not null default 0,
  cached_input_tokens int not null default 0,
  output_tokens       int not null default 0,
  cost_usd            numeric(10, 6) not null default 0,

  tool_calls  int not null default 0, -- số vòng gọi tool, để soi injection
  latency_ms  int,
  attempts    int not null default 1,
  ok          boolean not null default true,
  error_kind  text,                   -- 'rate_limit' | 'timeout' | … (phân loại, không phải message)

  at          timestamptz not null default now()
);

create index ai_usage_at_idx on public.ai_usage (at desc);
create index ai_usage_clan_idx on public.ai_usage (clan_id, at desc);
create index ai_usage_user_idx on public.ai_usage (user_id, at desc);

alter table public.ai_usage enable row level security;

-- Chỉ platform admin đọc. Người dùng thường xem lượt đã tiêu ở
-- credit_ledger (GĐ 3), không phải ở đây — token là con số vô nghĩa với
-- họ và chỉ gây lo.
create policy ai_usage_select on public.ai_usage for select
  using (public.is_platform_admin());

-- KHÔNG có policy ghi: chỉ Edge Function (service role) mới insert.
revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;

comment on table public.ai_usage is
  'Đo lường kỹ thuật trợ lý AI. Không chứa nội dung hội thoại — cố ý.';

-- ─── Cấu hình định tuyến model (đổi không cần deploy) ──────────────────
-- platform_settings ĐỌC CÔNG KHAI → chỉ để TÊN model ở đây.
-- Khoá API nằm trong env qua docker-compose.override.yml, tuyệt đối không
-- được đặt vào bảng này.
insert into public.platform_settings (key, value) values
  ('ai.enabled',       'false'),
  ('ai.model.qa',      'gpt-5.6-luna'),
  ('ai.model.extract', 'gpt-5.6-luna')
on conflict (key) do nothing;
